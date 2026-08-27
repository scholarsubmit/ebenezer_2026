// api/submissions-approve.js — password-protected. Moves a pending photo
// into the real public gallery (Blob has no native "move", so we fetch
// the bytes, re-store them under gallery/, then remove the pending copy).

const { put, del } = require('@vercel/blob');
const { readIndex, writeIndex } = require('../lib/submissions-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const password = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server is missing ADMIN_PASSWORD.' });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  const id = body && body.id;
  if (!id) return res.status(400).json({ error: 'Missing submission id.' });

  try {
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

    try { await del(target.pathname); } catch (e) { /* already gone — ignore */ }

    const remaining = submissions.filter((s) => s.id !== id);
    await writeIndex(remaining);

    return res.status(200).json({ ok: true, submissions: remaining });
  } catch (err) {
    console.error('Submission approve error:', err);
    return res.status(500).json({ error: `Could not approve submission: ${err && err.message ? err.message : 'unknown server error'}` });
  }
};
