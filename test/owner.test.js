const { test } = require('node:test');
const assert = require('node:assert');

process.env.OWNER_EMAILS = 'owner@example.com';

const app = require('../src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function register(server, email, password) {
  const res = await fetch(`http://localhost:${server.address().port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return { status: res.status, body: await res.json() };
}

async function login(server, email, password) {
  const res = await fetch(`http://localhost:${server.address().port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return { status: res.status, body: await res.json() };
}

test('owner email registers with owner role; ordinary email does not', async () => {
  const server = await startServer();
  try {
    const owner = await register(server, 'owner@example.com', 'password123');
    assert.equal(owner.status, 201);
    assert.equal(owner.body.member.role, 'owner');

    const member = await register(server, 'member@example.com', 'password123');
    assert.equal(member.status, 201);
    assert.equal(member.body.member.role, 'member');
  } finally {
    server.close();
  }
});

test('GET /api/auth/me returns the owner role', async () => {
  const server = await startServer();
  try {
    const { body } = await login(server, 'owner@example.com', 'password123');
    const res = await fetch(`http://localhost:${server.address().port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${body.token}` }
    });
    const me = await res.json();
    assert.equal(res.status, 200);
    assert.equal(me.member.role, 'owner');
    assert.equal(me.member.email, 'owner@example.com');
  } finally {
    server.close();
  }
});

test('owner has access to any app without a redemption code', async () => {
  const server = await startServer();
  try {
    const { body } = await login(server, 'owner@example.com', 'password123');
    const res = await fetch(`http://localhost:${server.address().port}/api/store/my-apps/warrior-premium/access`, {
      headers: { Authorization: `Bearer ${body.token}` }
    });
    const access = await res.json();
    assert.equal(res.status, 200);
    assert.equal(access.hasAccess, true);
    assert.equal(access.owner, true);
    assert.equal(access.accessUntil, null);
  } finally {
    server.close();
  }
});

test('non-owner without a redemption still gets 404', async () => {
  const server = await startServer();
  try {
    const { body } = await login(server, 'member@example.com', 'password123');
    const res = await fetch(`http://localhost:${server.address().port}/api/store/my-apps/warrior-premium/access`, {
      headers: { Authorization: `Bearer ${body.token}` }
    });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
