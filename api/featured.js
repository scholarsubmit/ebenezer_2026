// api/featured.js
// Merged endpoint (GET/POST dispatched by method) — combines what used
// to be two separate files, purely to stay under Vercel's
// 12-serverless-function cap on the free Hobby plan. Logic unchanged.
//
//   GET  /api/featured  -> public, lists pinned highlight photos
//   POST /api/featured  { pathname } -> admin, pins/unpins a photo

const { list } = require('@vercel/blob');
const { readIndex, writeIndex } = require('../lib/featured-store');

function titleCase(slug) {
  return slug.replace(/[-_]+/g, ' ').trim().split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

async function handleGet(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const [featuredPathnames, { blobs }] = await Promise.all([
      readIndex(),
      list({ prefix: 'gallery/' }),
    ]);

    const bySet = new Set(featuredPathnames);
    const photos = blobs
      .filter((b) => bySet.has(b.pathname))
      .map((b) => {
        const parts = b.pathname.split('/');
        const slug = parts[1] || '';
        return { src: b.url, alt: `${titleCase(slug)} photo`, pathname: b.pathname, uploadedAt: b.uploadedAt };
      });

    return res.status(200).json({ photos });
  } catch (err) {
    console.error('Featured list error:', err);
    return res.status(500).json({ error: 'Could not load highlights.' });
  }
}

async function handlePost(req, res) {
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
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
};
