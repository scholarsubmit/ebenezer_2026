// api/speakers-delete.js
// Password-protected: removes a speaker record and its photo.

const { del } = require('@vercel/blob');
const { readIndex, writeIndex } = require('../lib/speakers-store');

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
};
