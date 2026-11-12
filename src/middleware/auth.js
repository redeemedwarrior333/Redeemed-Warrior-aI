const crypto = require('crypto');

const config = require('../config');

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isValidKey(req) {
  if (!config.apiKey) return true;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return Boolean(token) && safeEqual(token, config.apiKey);
}



module.exports = function requireApiKey(req, res, next) {
  if (isValidKey(req)) return next();
  if (config.publicChatEnabled) return next();
  res.status(401).json({
    error: {
      message: 'Missing or invalid API key. Send it as a header: Authorization: Bearer <your-key>'
    }
  });
};

function requireApiKeyStrict(req, res, next) {
  if (!config.apiKey) {
    return res.status(503).json({
      error: { message: 'This server has no API_KEY configured. Set one in the environment and restart.' }
    });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token && safeEqual(token, config.apiKey)) return next();
  res.status(401).json({
    error: { message: 'Missing or invalid API key. This area is owner-only.' }
  });
}

module.exports.requireApiKeyStrict = requireApiKeyStrict;

module.exports.isValidKey = isValidKey;
