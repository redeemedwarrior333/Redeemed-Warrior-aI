const { test } = require('node:test');
const assert = require('node:assert');

const app = require('../src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

test('devotional bible app is served at /apps/devotional-bible/', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/apps/devotional-bible/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /Devotional Bible/);
    assert.match(body, /Redeemed by Grace/);
  } finally {
    server.close();
  }
});
