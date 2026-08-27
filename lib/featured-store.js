// lib/featured-store.js
// Tracks which photo pathnames the admin has pinned as homepage highlights.
// Same read-modify-write JSON-index pattern as speakers/submissions.

const { put, list, del } = require('@vercel/blob');

const INDEX_PATH = 'featured/index.json';

async function readIndex() {
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.pathnames) ? data.pathnames : [];
  } catch (err) {
    console.error('featured-store readIndex error:', err);
    return [];
  }
}

async function writeIndex(pathnames) {
  const payload = JSON.stringify({ pathnames }, null, 2);
  try {
    await put(INDEX_PATH, payload, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    try { await del(INDEX_PATH); } catch (e2) { /* ignore if it didn't exist */ }
    await put(INDEX_PATH, payload, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  }
}

module.exports = { readIndex, writeIndex };
