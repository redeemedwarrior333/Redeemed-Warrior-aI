const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

function startMockProvider() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'mock reply' } }]
        }));
      });
    });
    server.listen(0, () => resolve(server));
  });
}

function clearModuleCache() {
  ['../src/config', '../src/services/aiClient', '../src/routes/aiStatus', '../src/app']
    .forEach((m) => delete require.cache[require.resolve(m)]);
}

test('ai-status reports a healthy provider as ok', async () => {
  const mock = await startMockProvider();
  process.env.AI_BASE_URL = `http://localhost:${mock.address().port}`;
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL = 'mock-model';
  process.env.AI_FALLBACK_API_KEY = '';
  clearModuleCache();
  const app = require('../src/app');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/ai-status`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.providers.length, 1);
    assert.equal(body.providers[0].name, 'primary');
    assert.equal(body.providers[0].ok, true);
  } finally {
    server.close();
    mock.close();
  }
});

test('ai-status reports a broken provider with the reason', async () => {
  process.env.AI_BASE_URL = 'http://localhost:9';
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL = 'mock-model';
  process.env.AI_FALLBACK_API_KEY = '';
  clearModuleCache();
  const app = require('../src/app');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/ai-status`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.providers[0].ok, false);
    assert.match(body.providers[0].error, /Could not reach the AI provider/);
  } finally {
    server.close();
  }
});

test('ai-status reports each provider separately when both are configured', async () => {
  const mock = await startMockProvider();
  process.env.AI_BASE_URL = 'http://localhost:9';
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL = 'mock-model';
  process.env.AI_FALLBACK_BASE_URL = `http://localhost:${mock.address().port}`;
  process.env.AI_FALLBACK_API_KEY = 'fb-key';
  process.env.AI_FALLBACK_MODEL = 'fb-model';
  clearModuleCache();
  const app = require('../src/app');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/ai-status`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.providers.length, 2);
    assert.equal(body.providers[0].name, 'primary');
    assert.equal(body.providers[0].ok, false);
    assert.equal(body.providers[1].name, 'fallback');
    assert.equal(body.providers[1].ok, true);
  } finally {
    server.close();
    mock.close();
  }
});
