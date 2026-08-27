// api/featured.js — PUBLIC. Returns the admin's pinned highlight photos,
// cross-referenced against the live gallery so a deleted photo never
// shows up as a stale highlight.

const { list } = require('@vercel/blob');
const { readIndex } = require('../lib/featured-store');

function titleCase(slug) {
  return slug.replace(/[-_]+/g, ' ').trim().split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

module.exports = async function handler(req, res) {
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
};
