const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.AI_BASE_URL = 'http://localhost:9';
process.env.AI_API_KEY = 'test-primary-key';
process.env.AI_MODEL = 'test-model';
process.env.AI_FALLBACK_BASE_URL = '';
process.env.AI_FALLBACK_API_KEY = '';
process.env.AI_FALLBACK_MODEL = '';

const app = require('../src/app');
const aiClient = require('../src/services/aiClient');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function startMockProvider() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'backup AI answered' } }],
          usage: { total_tokens: 5 }
        }));
      });
    });
    server.listen(0, () => resolve(server));
  });
}

test('no providers configured returns a friendly 503', async () => {
  const saved = { key: process.env.AI_API_KEY, fb: process.env.AI_FALLBACK_API_KEY };
  process.env.AI_API_KEY = '';
  process.env.AI_FALLBACK_API_KEY = '';
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/aiClient')];
  const freshClient = require('../src/services/aiClient');
  await assert.rejects(
    () => freshClient.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] }),
    /not configured/
  );
  process.env.AI_API_KEY = saved.key;
  process.env.AI_FALLBACK_API_KEY = saved.fb;
});

test('when the primary provider is unreachable, the fallback answers automatically', async () => {
  const mock = await startMockProvider();
  process.env.AI_FALLBACK_BASE_URL = `http://localhost:${mock.address().port}`;
  process.env.AI_FALLBACK_API_KEY = 'test-fallback-key';
  process.env.AI_FALLBACK_MODEL = 'backup-model';
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/aiClient')];
  const freshClient = require('../src/services/aiClient');

  try {
    const reply = await freshClient.chatCompletion({ messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(reply.content, 'backup AI answered');
  } finally {
    mock.close();
  }
});

test('a provider 400 error surfaces the upstream reason in the public message', async () => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ error: { code: 400, message: 'Model bad-model not found', status: 'INVALID_ARGUMENT' } }]));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const saved = {
    base: process.env.AI_BASE_URL,
    fbBase: process.env.AI_FALLBACK_BASE_URL,
    fbKey: process.env.AI_FALLBACK_API_KEY
  };
  process.env.AI_BASE_URL = `http://localhost:${server.address().port}`;
  process.env.AI_FALLBACK_BASE_URL = '';
  process.env.AI_FALLBACK_API_KEY = '';
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/aiClient')];
  const freshClient = require('../src/services/aiClient');

  try {
    await assert.rejects(
      () => freshClient.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] }),
      /Provider said: Model bad-model not found/
    );
  } finally {
    server.close();
    process.env.AI_BASE_URL = saved.base;
    process.env.AI_FALLBACK_BASE_URL = saved.fbBase;
    process.env.AI_FALLBACK_API_KEY = saved.fbKey;
  }
});

test('chat endpoint still works end-to-end through the primary provider', async () => {
  const mock = await startMockProvider();
  const saved = { base: process.env.AI_BASE_URL, key: process.env.AI_API_KEY };
  process.env.AI_BASE_URL = `http://localhost:${mock.address().port}`;
  ['../src/config', '../src/services/aiClient', '../src/routes/chat', '../src/middleware/auth', '../src/app']
    .forEach((m) => delete require.cache[require.resolve(m)]);
  const freshApp = require('../src/app');
  const config = require('../src/config');
  config.publicChatEnabled = true;

  const server = await new Promise((resolve) => {
    const s = freshApp.listen(0, () => resolve(s));
  });
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.reply, 'backup AI answered');
  } finally {
    server.close();
    mock.close();
    process.env.AI_BASE_URL = saved.base;
    process.env.AI_API_KEY = saved.key;
  }
});
