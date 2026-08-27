// lib/submissions-store.js
// Pending (unapproved) photo submissions are tracked the same way as
// speakers: one small JSON index file in Blob storage, read-modify-write.
// The actual photo bytes live separately under pending/<album>/.

const { list, del } = require('@vercel/blob');

const INDEX_PATH = 'pending/index.json';

async function readIndex() {
  try {
    const { blobs } = await list({ prefix: INDEX_PATH, limit: 1 });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.submissions) ? data.submissions : [];
  } catch (err) {
    console.error('submissions-store readIndex error:', err);
    return [];
  }
}

async function writeIndex(submissions) {
  const { put } = require('@vercel/blob');
  const payload = JSON.stringify({ submissions }, null, 2);
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
