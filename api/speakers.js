// api/speakers.js
// Merged endpoint (GET/POST/DELETE dispatched by HTTP method) — combines
// what used to be three separate files. This is purely to stay under
// Vercel's 12-serverless-function cap on the free Hobby plan; the logic
// for each action is unchanged from before.
//
//   GET    /api/speakers          -> public, lists all speakers
//   POST   /api/speakers          -> admin, adds a speaker (+ photo)
//   DELETE /api/speakers          -> admin, removes a speaker (+ photo)

const { put, del } = require('@vercel/blob');
const { readIndex, writeIndex } = require('../lib/speakers-store');

async function handleGet(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const speakers = await readIndex();
  return res.status(200).json({ speakers });
}

async function handlePost(req, res) {
  const password = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server is missing ADMIN_PASSWORD. Set it in Vercel → Settings → Environment Variables, then redeploy.' });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob storage is not connected to this project. Connect it in Vercel → Storage, then redeploy.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid request body.' });
  }

  const name = String(body.name || '').trim();
  const title = String(body.title || '').trim();
  const tag = String(body.tag || '').trim() || 'Guest Minister';
  const bio = String(body.bio || '').trim();
  const sessionSlug = String(body.sessionSlug || '').trim();
  const { contentType, dataBase64 } = body;

  if (!name) return res.status(400).json({ error: 'Speaker name is required.' });
  if (!dataBase64) return res.status(400).json({ error: 'No photo received.' });

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'Could not decode photo.' });
  }
  if (buffer.length === 0) return res.status(400).json({ error: 'Photo is empty.' });
  if (buffer.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: 'Photo is still too large after compression (max 4MB). Try a smaller photo.' });
  }

  try {
    const fileSafe = name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    const key = `speakers/photos/${Date.now()}-${fileSafe}.jpg`;
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: contentType || 'image/jpeg',
    });

    const speakers = await readIndex();
    const record = {
      id: `spk-${Date.now()}`,
      name,
      title,
      tag,
      bio,
      sessionSlug,
      photoUrl: blob.url,
      photoPathname: blob.pathname,
    };
    speakers.push(record);
    await writeIndex(speakers);

    return res.status(200).json({ speakers });
  } catch (err) {
    console.error('Speaker save error:', err);
    return res.status(500).json({ error: `Could not save speaker: ${err && err.message ? err.message : 'unknown server error'}` });
  }
}

async function handleDelete(req, res) {
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
  if (!id) return res.status(400).json({ error: 'Missing speaker id.' });

  try {
    const speakers = await readIndex();
    const target = speakers.find((s) => s.id === id);
    const remaining = speakers.filter((s) => s.id !== id);

    if (target && target.photoPathname) {
      try { await del(target.photoPathname); } catch (e) { /* photo already gone — ignore */ }
    }

    await writeIndex(remaining);
    return res.status(200).json({ speakers: remaining });
  } catch (err) {
    console.error('Speaker delete error:', err);
    return res.status(500).json({ error: `Could not delete speaker: ${err && err.message ? err.message : 'unknown server error'}` });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  if (req.method === 'DELETE') return handleDelete(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};
