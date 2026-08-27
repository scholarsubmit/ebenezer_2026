// api/featured-toggle.js — password-protected. Adds or removes a photo
// from the homepage highlights list.

const { readIndex, writeIndex } = require('../lib/featured-store');

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
  const pathname = body && body.pathname;
  if (!pathname) return res.status(400).json({ error: 'Missing pathname.' });

  try {
    const pathnames = await readIndex();
    const idx = pathnames.indexOf(pathname);
    let featured;
    if (idx > -1) {
      pathnames.splice(idx, 1);
      featured = false;
    } else {
      pathnames.push(pathname);
      featured = true;
    }
    await writeIndex(pathnames);
    return res.status(200).json({ featured });
  } catch (err) {
    console.error('Featured toggle error:', err);
    return res.status(500).json({ error: `Could not update highlight: ${err && err.message ? err.message : 'unknown error'}` });
  }
};
