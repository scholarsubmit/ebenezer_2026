// api/submissions.js — password-protected, lists all pending submissions
// for the admin review panel.

const { readIndex } = require('../lib/submissions-store');

module.exports = async function handler(req, res) {
  const password = req.headers['x-admin-password'];
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'Server is missing ADMIN_PASSWORD.' });
  }
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  const submissions = await readIndex();
  submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return res.status(200).json({ submissions });
};
