// api/delete.js
// Removes a single photo from Vercel Blob storage. Password protected.
// Client sends: POST /api/delete  { "pathname": "gallery/day-1-opening/173-IMG.jpg" }

const { del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server is not configured with ADMIN_PASSWORD yet.' });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const pathname = body && body.pathname;

  if (!pathname || !pathname.startsWith('gallery/')) {
    return res.status(400).json({ error: 'Missing or invalid pathname.' });
  }

  try {
    await del(pathname);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: `Delete failed: ${err && err.message ? err.message : 'unknown server error'}` });
  }
};
