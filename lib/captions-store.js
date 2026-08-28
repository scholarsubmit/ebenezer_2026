// lib/captions-store.js
// Optional "testimony" captions submitters can attach to a photo — kept
// as one small JSON object (pathname -> text) in Blob storage, the same
// read-modify-write pattern used by speakers/featured/submissions.

const { put, list, del } = require('@vercel/blob');

const INDEX_PATH = 'captions/index.json';

async function readIndex() {
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    if (!blobs.length) return {};
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data.captions === 'object' ? data.captions : {};
  } catch (err) {
    console.error('captions-store readIndex error:', err);
    return {};
  }
}

async function writeIndex(captions) {
  const payload = JSON.stringify({ captions }, null, 2);
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
