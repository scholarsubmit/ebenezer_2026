// api/speakers.js — public GET, returns the current speaker list.
const { readIndex } = require('../lib/speakers-store');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const speakers = await readIndex();
  return res.status(200).json({ speakers });
};
