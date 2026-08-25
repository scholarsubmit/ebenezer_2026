// lib/speakers-store.js
// Speaker metadata (name, title, tag, photo reference) is kept as one small
// JSON file in Blob storage at speakers/index.json — read-modify-write.
// Photos themselves are separate Blob objects under speakers/photos/.

const { put, list, del } = require('@vercel/blob');

const INDEX_PATH = 'speakers/index.json';

async function readIndex() {
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.speakers) ? data.speakers : [];
  } catch (err) {
    console.error('speakers-store readIndex error:', err);
    return [];
  }
}

async function writeIndex(speakers) {
  const payload = JSON.stringify({ speakers }, null, 2);
  try {
    await put(INDEX_PATH, payload, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    // Older @vercel/blob versions may not support allowOverwrite — fall
    // back to delete-then-recreate so this still works either way.
    try { await del(INDEX_PATH); } catch (e2) { /* ignore if it didn't exist */ }
    await put(INDEX_PATH, payload, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  }
}

module.exports = { readIndex, writeIndex };
