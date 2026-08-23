// api/upload.js
// Receives an image file (already compressed client-side, see admin.js)
// as the raw request body, checks the admin password, and stores it in
// Vercel Blob under gallery/<album>/<file>.
// The browser sends: POST /api/upload?album=day-1-opening&filename=IMG_01.jpg

const { put } = require('@vercel/blob');

module.exports.config = {
  api: { bodyParser: false },
};

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

  const album = String(req.query.album || '').toLowerCase().trim();
  const filename = String(req.query.filename || '').trim();

  const safeAlbum = album.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');

  if (!safeAlbum) return res.status(400).json({ error: 'Missing or invalid album name.' });
  if (!safeFilename) return res.status(400).json({ error: 'Missing or invalid file name.' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'File is empty.' });
    }
    // Vercel serverless functions cap request bodies at 4.5MB — the
    // browser compresses photos before sending, so this should rarely
    // trip, but we check anyway with a clear message.
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'File is still too large after compression (max 4MB). Try a smaller photo.' });
    }

    const key = `gallery/${safeAlbum}/${Date.now()}-${safeFilename}`;
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: req.headers['content-type'] || 'application/octet-stream',
    });

    return res.status(200).json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed. Please try again.' });
  }
};
