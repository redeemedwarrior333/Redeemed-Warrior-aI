process.env.API_KEY = 'test-secret-key';

const { test } = require('node:test');
const assert = require('node:assert');

const app = require('../src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('requests without a valid API key are rejected with 401', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello!' })
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.match(body.error.message, /API key/);
  } finally {
    server.close();
  }
});

test('requests with the correct API key pass auth and reach the handler', async () => {
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

test('health endpoint stays public even when API key is required', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.authRequired, true);
  } finally {
    server.close();
  }
});
