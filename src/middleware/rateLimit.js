const config = require('../config');
const { isValidKey } = require('./auth');

const hits = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
}, config.rateLimitWindowMs).unref();

function limitFor(req) {
  if (isValidKey(req)) return config.rateLimitMax;
  if (req.path === '/api/chat' || req.path.startsWith('/api/chat/')) {
    return config.publicChatEnabled ? config.publicRateLimitMax : 0;
  }
  return config.rateLimitMax;
}

module.exports = function rateLimit(req, res, next) {
  const max = limitFor(req);
  if (max === 0) {
    return next();
  }
  const now = Date.now();
  const forwarded = req.headers['x-forwarded-for'];
  const key = (forwarded ? String(forwarded).split(',')[0].trim() : req.ip) || 'unknown';
  const entry = hits.get(key) || { count: 0, resetAt: now + config.rateLimitWindowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + config.rateLimitWindowMs;
  }
  entry.count += 1;
  hits.set(key, entry);
  res.setHeader('X-RateLimit-Limit', String(max));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
  if (entry.count > max) {
    return res.status(429).json({
      error: {
        message: 'Too many requests. Please wait a moment and try again.'
      }
    });
  }
  next();
};
