// api/gallery.js
// Lists every photo currently stored in Vercel Blob under gallery/,
// groups them by album folder, and returns the same JSON shape the
// front-end gallery expects. This runs on every page load, so newly
// uploaded photos appear immediately — no rebuild, no redeploy.

const { list } = require('@vercel/blob');
const { readIndex: readCaptions } = require('../lib/captions-store');

function titleCase(slug) {
  return slug
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

module.exports = async function handler(req, res) {
  try {
    let cursor;
    const all = [];
    do {
      const result = await list({ prefix: 'gallery/', cursor, limit: 1000 });
      all.push(...result.blobs);
      cursor = result.cursor;
    } while (cursor);

    const captions = await readCaptions();
    const albumsMap = new Map();

    for (const b of all) {
      const parts = b.pathname.split('/'); // gallery/<slug>/<file>
      if (parts.length < 3) continue;
      const slug = parts[1];
      if (!albumsMap.has(slug)) albumsMap.set(slug, []);
      albumsMap.get(slug).push({
        src: b.url,
        alt: `${titleCase(slug)} photo`,
        pathname: b.pathname,
        uploadedAt: b.uploadedAt,
        size: b.size || 0,
        testimony: captions[b.pathname] || null,
      });
    }

    const albums = Array.from(albumsMap.entries())
      .map(([slug, photos]) => ({
        slug,
        title: titleCase(slug),
        count: photos.length,
        photos: photos.sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)),
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ albums });
  } catch (err) {
    console.error('Gallery list error:', err);
    return res.status(500).json({ error: `Could not load the gallery: ${err && err.message ? err.message : 'unknown server error'}` });
  }
};
