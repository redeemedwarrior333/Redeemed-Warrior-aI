const { test } = require('node:test');
const assert = require('node:assert');

const app = require('../src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('GET /health returns ok status', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'redeemed-warrior-ai-api');
    assert.equal(typeof body.model, 'string');
  } finally {
    server.close();
  }
});

test('POST /api/chat with empty body returns 400', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error.message, /message/);
  } finally {
    server.close();
  }
});

test('POST /api/chat without AI key configured returns 503', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello!' })
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.match(body.error.message, /AI_API_KEY/);
  } finally {
    server.close();
  }
});

test('POST /api/apps/plan with empty idea returns 400', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/apps/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: '' })
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('unknown route returns 404 JSON', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/nope`);
    const body = await res.json();
    assert.equal(res.status, 404);
    assert.match(body.error.message, /not found/i);
  } finally {
    server.close();
  }
});
