const { test } = require('node:test');
const assert = require('node:assert');

const app = require('../src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('member registration creates an account and returns a token', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'warrior@example.com', password: 'strong-pass-1' })
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.member.email, 'warrior@example.com');
    assert.match(body.token, /^[0-9a-f]{64}$/);
  } finally {
    server.close();
  }
});

test('duplicate registration is rejected and login works', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const reg = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@example.com', password: 'strong-pass-1' })
    });
    assert.equal(reg.status, 201);

    const dupe = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@example.com', password: 'strong-pass-1' })
    });
    assert.equal(dupe.status, 400);

    const badLogin = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@example.com', password: 'wrong-password' })
    });
    assert.equal(badLogin.status, 401);

    const login = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dupe@example.com', password: 'strong-pass-1' })
    });
    const body = await login.json();
    assert.equal(login.status, 200);
    assert.match(body.token, /^[0-9a-f]{64}$/);
  } finally {
    server.close();
  }
});

test('store routes require a member token', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const redeem = await fetch(`http://localhost:${port}/api/store/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'RW-TEST-CODE' })
    });
    assert.equal(redeem.status, 401);

    const myApps = await fetch(`http://localhost:${port}/api/store/my-apps`);
    assert.equal(myApps.status, 401);
  } finally {
    server.close();
  }
});

test('redeem with an empty code returns 400', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const reg = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'empty@example.com', password: 'strong-pass-1' })
    });
    const { token } = await reg.json();

    const res = await fetch(`http://localhost:${port}/api/store/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: '  ' })
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('redeem without a configured Store key returns a friendly 503', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const reg = await fetch(`http://localhost:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nokey@example.com', password: 'strong-pass-1' })
    });
    const { token } = await reg.json();

    const res = await fetch(`http://localhost:${port}/api/store/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: 'RW-TEST-CODE' })
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.match(body.error.message, /RW_STORE_API_KEY/);
  } finally {
    server.close();
  }
});

test('member dashboard page is served at /dashboard', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/dashboard`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /Redeem Store Purchase/);
    assert.match(body, /My Apps/);
  } finally {
    server.close();
  }
});
