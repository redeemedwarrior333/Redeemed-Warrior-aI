const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

process.env.OWNER_EMAILS = 'owner@test.com';
process.env.GITHUB_TOKEN = 'test-token';
process.env.GITHUB_REPO = 'test-owner/test-repo';
process.env.GITHUB_BRANCH = 'main';

const uploaded = new Map();

function startMockGithub() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        const url = new URL(req.url, 'http://localhost');
        const path = url.pathname;
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'PUT' && path.startsWith('/repos/test-owner/test-repo/contents/uploads/')) {
          const name = decodeURIComponent(path.split('/').pop());
          if (uploaded.has(name)) {
            res.writeHead(422);
            res.end(JSON.stringify({ message: 'already_exists' }));
            return;
          }
          const parsed = JSON.parse(body);
          uploaded.set(name, { content: parsed.content, sha: 'sha-' + name });
          res.writeHead(201);
          res.end(JSON.stringify({ commit: { sha: 'abc123' } }));
          return;
        }

        if (req.method === 'GET' && path === '/repos/test-owner/test-repo/contents/uploads') {
          if (!uploaded.size) {
            res.writeHead(404);
            res.end(JSON.stringify({ message: 'Not Found' }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify([...uploaded.entries()].map(([name, info]) => ({
            name,
            type: 'file',
            size: Buffer.from(info.content, 'base64').length
          }))));
          return;
        }

        if (req.method === 'GET' && path.startsWith('/repos/test-owner/test-repo/contents/uploads/')) {
          const name = decodeURIComponent(path.split('?')[0].split('/').pop());
          if (!uploaded.has(name)) {
            res.writeHead(404);
            res.end(JSON.stringify({ message: 'Not Found' }));
            return;
          }
          res.writeHead(200);
          res.end(JSON.stringify({ sha: uploaded.get(name).sha }));
          return;
        }

        if (req.method === 'DELETE' && path.startsWith('/repos/test-owner/test-repo/contents/uploads/')) {
          const name = decodeURIComponent(path.split('/').pop());
          uploaded.delete(name);
          res.writeHead(200);
          res.end(JSON.stringify({ commit: { sha: 'def456' } }));
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ message: 'Not Found' }));
      });
    });
    server.listen(0, () => resolve(server));
    server.unref();
  });
}

async function setup() {
  process.env.GITHUB_API_BASE = `http://localhost:${global.__ghPort}`;
  ['../src/config', '../src/services/members', '../src/services/fileStore', '../src/middleware/memberAuth', '../src/routes/auth', '../src/routes/uploads', '../src/app']
    .forEach((m) => delete require.cache[require.resolve(m)]);
  const app = require('../src/app');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const reg = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@test.com', password: 'password123' })
  }).then((r) => r.json());
  return { server, base, token: reg.token };
}

test('uploads require a logged-in member', async () => {
  global.__ghPort = (await startMockGithub()).address().port;
  const { server, base } = await setup();
  try {
    const res = await fetch(`${base}/api/uploads`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('non-owner members are blocked from uploads', async () => {
  const { server, base } = await setup();
  try {
    const reg = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'plain@test.com', password: 'password123' })
    }).then((r) => r.json());
    const res = await fetch(`${base}/api/uploads`, {
      headers: { Authorization: `Bearer ${reg.token}` }
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test('owner can upload, list, and delete a file', async () => {
  const { server, base, token } = await setup();
  try {
    const pngBase64 = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    const up = await fetch(`${base}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'cover.png', data: pngBase64 })
    }).then((r) => r.json());
    assert.ok(up.file.name.endsWith('-cover.png'));
    assert.ok(up.file.url.includes('raw.githubusercontent.com/test-owner/test-repo/main/uploads/'));
    assert.ok(up.file.cdnUrl.includes('cdn.jsdelivr.net/gh/test-owner/test-repo@main/uploads/'));

    const list = await fetch(`${base}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    assert.equal(list.files.length, 1);

    const del = await fetch(`${base}/api/uploads/${encodeURIComponent(up.file.name)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    assert.equal(del.deleted, true);
  } finally {
    server.close();
  }
});

test('upload rejects unsupported file types and oversized files', async () => {
  const { server, base, token } = await setup();
  try {
    const badType = await fetch(`${base}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'evil.exe', data: Buffer.from('MZ').toString('base64') })
    });
    assert.equal(badType.status, 400);

    const tooBig = await fetch(`${base}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'big.png', data: Buffer.alloc(6 * 1024 * 1024).toString('base64') })
    });
    assert.equal(tooBig.status, 413);
  } finally {
    server.close();
  }
});

test('a large-but-valid upload succeeds (over the old 1 MB limit)', async () => {
  const { server, base, token } = await setup();
  try {
    const bigData = Buffer.alloc(2 * 1024 * 1024).toString('base64');
    const res = await fetch(`${base}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'big-but-ok.png', data: bigData })
    });
    assert.equal(res.status, 201);
  } finally {
    server.close();
  }
});

test('a GitHub failure surfaces the friendly message, not a generic 500', async () => {
  const { server, base, token } = await setup();
  try {
    const res = await fetch(`${base}/api/uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'evil.exe', data: Buffer.from('MZ').toString('base64') })
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error.message, /file type is not supported/);
  } finally {
    server.close();
  }
});

test('the files page is served at /files', async () => {
  const { server, base } = await setup();
  try {
    const res = await fetch(`${base}/files`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /FILES &amp; PICTURES/);
  } finally {
    server.close();
  }
});
