// api/submissions-reject.js — password-protected. Deletes a pending photo
// without adding it to the public gallery.

const { del } = require('@vercel/blob');
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
    if (target) {
      try { await del(target.pathname); } catch (e) { /* already gone — ignore */ }
    }
    const remaining = submissions.filter((s) => s.id !== id);
    await writeIndex(remaining);
    return res.status(200).json({ ok: true, submissions: remaining });
  } catch (err) {
    console.error('Submission reject error:', err);
    return res.status(500).json({ error: `Could not reject submission: ${err && err.message ? err.message : 'unknown server error'}` });
  }
};
