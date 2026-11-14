const { test } = require('node:test');
const assert = require('node:assert');

process.env.PUBLIC_CHAT_ENABLED = 'true';
process.env.RATE_LIMIT_MAX = '50';
process.env.PUBLIC_RATE_LIMIT_MAX = '2';
process.env.API_KEY = 'test-key';

const config = require('../src/config');
const rateLimit = require('../src/middleware/rateLimit');

function mockReq(path, forwardedFor) {
  const headers = forwardedFor ? { 'x-forwarded-for': forwardedFor } : {};
  return { path, headers, ip: '10.0.0.1' };
}

function run(req) {
  return new Promise((resolve) => {
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      getHeader(k) { return this.headers[k]; },
      status(code) { this.statusCode = code; return this; },
      json() { this.responded = true; }
    };
    const next = () => resolve({ nextCalled: true, res });
    rateLimit(req, res, next);
  });
}

test('non-chat endpoints get the general limit, not the tight chat limit', async () => {
  const r = await run(mockReq('/api/ohana/bootstrap', '1.2.3.4'));
  assert.ok(r.nextCalled, 'request passes through');
  assert.equal(Number(r.res.getHeader('X-RateLimit-Limit')), config.rateLimitMax);
});

test('chat keeps the tight public limit', async () => {
  const r = await run(mockReq('/api/chat', '1.2.3.4'));
  assert.ok(r.nextCalled);
  assert.equal(Number(r.res.getHeader('X-RateLimit-Limit')), config.publicRateLimitMax);
});

test('different visitors get separate buckets via x-forwarded-for', async () => {
  const first = await run(mockReq('/api/auth/login', '5.6.7.8'));
  const second = await run(mockReq('/api/auth/login', '9.8.7.6'));
  const remaining1 = Number(first.res.getHeader('X-RateLimit-Remaining'));
  const remaining2 = Number(second.res.getHeader('X-RateLimit-Remaining'));
  assert.equal(remaining1, config.rateLimitMax - 1);
  assert.equal(remaining2, config.rateLimitMax - 1, 'second visitor has a fresh bucket');
});

test('same visitor shares one bucket across requests', async () => {
  await run(mockReq('/api/ohana/wall', '11.22.33.44'));
  const again = await run(mockReq('/api/ohana/wall', '11.22.33.44'));
  assert.equal(Number(again.res.getHeader('X-RateLimit-Remaining')), config.rateLimitMax - 2);
});
