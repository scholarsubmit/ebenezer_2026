// api/upload.js
// Receives a compressed image as base64 inside a normal JSON body (the
// most reliably auto-parsed request type on Vercel — no manual stream
// reading, no bodyParser config needed), checks the admin password, and
// stores the decoded image in Vercel Blob under gallery/<album>/<file>.

const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = req.headers['x-admin-password'];

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({
      error: 'Server is missing ADMIN_PASSWORD. Set it in Vercel → Settings → Environment Variables, then redeploy.',
    });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({
      error: 'Blob storage is not connected to this project. Connect it in Vercel → Storage, then redeploy.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid request body.' });
  }

  const { album, filename, contentType, dataBase64 } = body;

  const safeAlbum = String(album || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9._-]/g, '-');

  if (!safeAlbum) return res.status(400).json({ error: 'Missing or invalid album name.' });
  if (!safeFilename) return res.status(400).json({ error: 'Missing or invalid file name.' });
  if (!dataBase64) return res.status(400).json({ error: 'No image data received.' });

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'Could not decode image data.' });
  }

  if (buffer.length === 0) {
    return res.status(400).json({ error: 'File is empty.' });
  }
  if (buffer.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: 'File is still too large after compression (max 4MB). Try a smaller photo.' });
  }

  try {
    const key = `gallery/${safeAlbum}/${Date.now()}-${safeFilename}`;
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });
    return res.status(200).json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: `Upload failed: ${err && err.message ? err.message : 'unknown server error'}` });
  }
};
