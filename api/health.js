// api/health.js
// Visit /api/health in your browser to check the server's configuration
// directly — no upload attempt needed. Reports true/false only, never
// the actual secret values.

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
    blobTokenConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    note: 'Both should say true. If either says false, fix it in Vercel → Settings → Environment Variables (or Storage, for the blob token), then redeploy.',
  });
};
