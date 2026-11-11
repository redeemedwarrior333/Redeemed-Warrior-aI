process.env.API_KEY = 'test-secret-key';
process.env.PUBLIC_CHAT_ENABLED = 'true';

const { test } = require('node:test');
const assert = require('node:assert');

const app = require('../src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('chat page is served at /chat as HTML', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/chat`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /REDEEMED WARRIOR AI/);
  } finally {
    server.close();
  }
});

test('with PUBLIC_CHAT_ENABLED, visitors without a key can reach the chat handler', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('with PUBLIC_CHAT_ENABLED, a valid key still works normally', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-key'
      },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});
