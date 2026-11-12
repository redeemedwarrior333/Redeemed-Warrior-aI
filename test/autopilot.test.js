const http = require('http');
const { test, before, after } = require('node:test');
const assert = require('node:assert');

process.env.API_KEY = 'autopilot-test-key';
delete process.env.STRIPE_SECRET_KEY;

const mock = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    items: [
      { id: 'p1', title: 'Warrior Planner', price: 9.99, category: 'Apps & Software', published: true, checkoutUrl: '' },
      { id: 'p2', title: 'Free Guide', price: 0, category: 'Ebooks', published: true, checkoutUrl: '' },
      { id: 'p3', title: 'Journal', price: 12, category: 'Journals & Workbooks', published: true, checkoutUrl: 'https://buy.stripe.com/abc' }
    ]
  }));
});

let app;

before(async () => {
  await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
  process.env.RW_STORE_BASE_URL = `http://127.0.0.1:${mock.address().port}`;
  app = require('../src/app');
});

after(() => new Promise((resolve) => mock.close(resolve)));

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('autopilot endpoints are owner-only', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const noKey = await fetch(`http://localhost:${port}/api/autopilot/products`);
    assert.equal(noKey.status, 401);

    const badKey = await fetch(`http://localhost:${port}/api/autopilot/products`, {
      headers: { Authorization: 'Bearer wrong-key' }
    });
    assert.equal(badKey.status, 401);

    const page = await fetch(`http://localhost:${port}/autopilot`);
    const body = await page.text();
    assert.equal(page.status, 200);
    assert.match(body, /Pay-Link Auto-Pilot/);
  } finally {
    server.close();
  }
});

test('create-link returns a friendly 503 when Stripe is not connected', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/autopilot/create-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer autopilot-test-key' },
      body: JSON.stringify({ productId: 'p1' })
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.match(body.error.message, /STRIPE_SECRET_KEY/);
  } finally {
    server.close();
  }
});

test('products endpoint reads the Store catalog', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/api/autopilot/products`, {
      headers: { Authorization: 'Bearer autopilot-test-key' }
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.products.length, 3);
    const planner = body.products.find((p) => p.id === 'p1');
    assert.equal(planner.needsLink, true);
    assert.equal(planner.isApp, true);
    const free = body.products.find((p) => p.id === 'p2');
    assert.equal(free.needsLink, false);
    const journal = body.products.find((p) => p.id === 'p3');
    assert.equal(journal.needsLink, false);
  } finally {
    server.close();
  }
});
