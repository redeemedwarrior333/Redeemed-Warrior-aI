const crypto = require('crypto');

const config = require('../config');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = function requireApiKey(req, res, next) {
  if (!config.apiKey) return next();
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token && safeEqual(token, config.apiKey)) return next();
  res.status(401).json({
    error: {
      message: 'Missing or invalid API key. Send it as a header: Authorization: Bearer <your-key>'
    }
  });
};
