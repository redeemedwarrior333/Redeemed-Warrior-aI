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

test('forgot password always answers politely, even for unknown emails', async () => {
  const server = await startServer();
  try {
    const res = await fetch(`http://localhost:${server.address().port}/api/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com' })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.match(body.message, /owner/i);
  } finally {
    server.close();
  }
});

test('owner routes reject non-owners with 403', async () => {
  const server = await startServer();
  try {
    const { body } = await login(server, 'member@example.com', 'password123');
    const res = await fetch(`http://localhost:${server.address().port}/api/owner/stats`, {
      headers: { Authorization: `Bearer ${body.token}` }
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test('full password reset flow: request, owner resolves, member signs in with temp password', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    await register(server, 'member@example.com', 'password123');

    const forgot = await fetch(`http://localhost:${port}/api/auth/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'member@example.com' })
    });
    assert.equal(forgot.status, 200);

    const owner = await login(server, 'owner@example.com', 'password123');
    const list = await fetch(`http://localhost:${port}/api/owner/reset-requests`, {
      headers: { Authorization: `Bearer ${owner.body.token}` }
    });
    const { requests } = await list.json();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].email, 'member@example.com');

    const resolve = await fetch(`http://localhost:${port}/api/owner/reset-requests/${requests[0].id}/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.body.token}` }
    });
    const resolved = await resolve.json();
    assert.equal(resolve.status, 200);
    assert.match(resolved.tempPassword, /^[\w-]{10}$/);

    const relogin = await login(server, 'member@example.com', resolved.tempPassword);
    assert.equal(relogin.status, 200);

    const oldLogin = await login(server, 'member@example.com', 'password123');
    assert.equal(oldLogin.status, 401);
  } finally {
    server.close();
  }
});

test('member can change their own password', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    await register(server, 'changer@example.com', 'password123');
    const { body } = await login(server, 'changer@example.com', 'password123');

    const bad = await fetch(`http://localhost:${port}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.token}` },
      body: JSON.stringify({ currentPassword: 'wrong-pass', newPassword: 'new-password-1' })
    });
    assert.equal(bad.status, 400);

    const good = await fetch(`http://localhost:${port}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${body.token}` },
      body: JSON.stringify({ currentPassword: 'password123', newPassword: 'new-password-1' })
    });
    assert.equal(good.status, 200);

    const relogin = await login(server, 'changer@example.com', 'new-password-1');
    assert.equal(relogin.status, 200);
  } finally {
    server.close();
  }
});

test('owner stats and lists are visible to the owner', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const owner = await login(server, 'owner@example.com', 'password123');
    const headers = { Authorization: `Bearer ${owner.body.token}` };

    const stats = await fetch(`http://localhost:${port}/api/owner/stats`, { headers });
    const statsBody = await stats.json();
    assert.equal(stats.status, 200);
    assert.equal(typeof statsBody.members, 'number');
    assert.ok(statsBody.members >= 2);

    const members = await fetch(`http://localhost:${port}/api/owner/members`, { headers });
    const membersBody = await members.json();
    assert.equal(members.status, 200);
    assert.ok(membersBody.members.some((m) => m.role === 'owner'));

    const redemptions = await fetch(`http://localhost:${port}/api/owner/redemptions`, { headers });
    assert.equal(redemptions.status, 200);
  } finally {
    server.close();
  }
});

test('owner dashboard page is served at /owner', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/owner`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /Owner Dashboard/);
  } finally {
    server.close();
  }
});
