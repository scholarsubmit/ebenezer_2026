// api/submissions.js
// Merged endpoint (GET/POST dispatched by method + an `action` field on
// POST) — combines what used to be three separate files, purely to stay
// under Vercel's 12-serverless-function cap on the free Hobby plan. The
// logic for each action is unchanged from before.
//
//   GET  /api/submissions                          -> admin, lists pending submissions
//   POST /api/submissions  { id, action: 'approve' } -> admin, moves photo into gallery
//   POST /api/submissions  { id, action: 'reject'  } -> admin, discards photo

const { put, del } = require('@vercel/blob');
const { readIndex, writeIndex } = require('../lib/submissions-store');
const captionsStore = require('../lib/captions-store');

function checkPassword(req, res) {
  const password = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: 'Server is missing ADMIN_PASSWORD.' });
    return false;
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Incorrect password.' });
    return false;
  }
  return true;
}

async function handleGet(req, res) {
  if (!checkPassword(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  const submissions = await readIndex();
  submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return res.status(200).json({ submissions });
}

async function approve(id, res) {
  const submissions = await readIndex();
  const target = submissions.find((s) => s.id === id);
  if (!target) return res.status(404).json({ error: 'Submission not found — it may have already been reviewed.' });

  const fetchRes = await fetch(target.url);
  if (!fetchRes.ok) throw new Error('Could not read the submitted photo.');
  const arrayBuffer = await fetchRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const filename = target.pathname.split('/').pop();
  const key = `gallery/${target.album}/${filename}`;
  await put(key, buffer, {
    access: 'public',
    contentType: target.contentType || 'application/octet-stream',
  });

  if (target.testimony) {
    try {
      const captions = await captionsStore.readIndex();
      captions[key] = target.testimony;
      await captionsStore.writeIndex(captions);
    } catch (e) {
      console.error('Could not carry over testimony:', e);
    }
  }

  try { await del(target.pathname); } catch (e) { /* already gone — ignore */ }

  const remaining = submissions.filter((s) => s.id !== id);
  await writeIndex(remaining);
  return res.status(200).json({ ok: true, submissions: remaining });
}

async function reject(id, res) {
  const submissions = await readIndex();
  const target = submissions.find((s) => s.id === id);
  if (target) {
    try { await del(target.pathname); } catch (e) { /* already gone — ignore */ }
  }
  const remaining = submissions.filter((s) => s.id !== id);
  await writeIndex(remaining);
  return res.status(200).json({ ok: true, submissions: remaining });
}

async function handlePost(req, res) {
  if (!checkPassword(req, res)) return;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const id = body && body.id;
  const action = body && body.action;
  if (!id) return res.status(400).json({ error: 'Missing submission id.' });
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'Missing or invalid action (expected "approve" or "reject").' });
  }

  try {
    if (action === 'approve') return await approve(id, res);
    return await reject(id, res);
  } catch (err) {
    console.error(`Submission ${action} error:`, err);
    return res.status(500).json({ error: `Could not ${action} submission: ${err && err.message ? err.message : 'unknown server error'}` });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};
