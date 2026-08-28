// api/submit.js
// PUBLIC endpoint. Anyone can submit a photo, which lands in a pending
// queue for the media team to approve or reject before it appears on the
// public gallery. A simple honeypot field filters out naive bots.
//
// Optional access code: if you set a SUBMIT_PASSWORD environment variable
// in Vercel, submitters must enter it (e.g. printed on a flyer at camp)
// before their photo is accepted. If SUBMIT_PASSWORD is not set, anyone
// with the link can submit — this is the default, unchanged behavior.

const { put } = require('@vercel/blob');
const { readIndex, writeIndex } = require('../lib/submissions-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Photo storage is not configured on this site yet. Please try again later.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing or invalid request body.' });
  }

  // Honeypot — real visitors never see or fill this field.
  if (body.website) {
    return res.status(200).json({ ok: true }); // pretend success, drop silently
  }

  // Optional access code — only enforced if the site owner has set one.
  if (process.env.SUBMIT_PASSWORD) {
    const submittedCode = String(body.password || '');
    if (submittedCode !== process.env.SUBMIT_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect access code.' });
    }
  }

  const album = String(body.album || '').toLowerCase().trim();
  const filename = String(body.filename || '').trim();
  const submitterName = String(body.submitterName || '').trim().slice(0, 80);
  const testimony = String(body.testimony || '').trim().slice(0, 500);
  const { contentType, dataBase64 } = body;

  const safeAlbum = album.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');

  if (!safeAlbum) return res.status(400).json({ error: 'Please choose or name a session for this photo.' });
  if (!safeFilename) return res.status(400).json({ error: 'Missing or invalid file name.' });
  if (!dataBase64) return res.status(400).json({ error: 'No photo data received.' });

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (e) {
    return res.status(400).json({ error: 'Could not decode photo.' });
  }
  if (buffer.length === 0) return res.status(400).json({ error: 'Photo is empty.' });
  if (buffer.length > 4 * 1024 * 1024) {
    return res.status(400).json({ error: 'Photo is still too large after compression. Try a smaller photo.' });
  }

  try {
    const key = `pending/${safeAlbum}/${Date.now()}-${safeFilename}`;
    const blob = await put(key, buffer, {
      access: 'public',
      contentType: contentType || 'application/octet-stream',
    });

    const submissions = await readIndex();
    submissions.push({
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      album: safeAlbum,
      submitterName,
      testimony,
      pathname: blob.pathname,
      url: blob.url,
      contentType: contentType || 'application/octet-stream',
      submittedAt: new Date().toISOString(),
    });
    await writeIndex(submissions);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: `Could not submit photo: ${err && err.message ? err.message : 'unknown server error'}` });
  }
};
