const http = require('http');
const crypto = require('crypto');

const MOCK_KEY = 'e2e-mock-store-key';

const codes = new Map();

function issueCode(code, app, extra) {
  codes.set(code, Object.assign({ code, app, status: 'active', claimedBy: null, accessUntil: null }, extra));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (_) {
        resolve({});
      }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function startMockStore() {
  const server = http.createServer(async (req, res) => {
    if (req.headers['x-rw-key'] !== MOCK_KEY) {
      return json(res, 401, { error: 'Invalid X-RW-Key' });
    }
    const body = await readBody(req);
    const record = codes.get(body.code);

    if (req.url === '/api/rw/redeem/check') {
      if (!body.account) return json(res, 400, { error: 'account required' });
      if (!record) return json(res, 200, { valid: false, message: 'Code not found', purchaseStatus: 'not_found' });
      const valid = record.status === 'active';
      return json(res, 200, {
        valid,
        message: valid ? 'Code is valid.' : 'Code is not redeemable.',
        product: record.app,
        purchaseStatus: record.status,
        accessUntil: record.accessUntil || null,
        customer: record.claimedBy ? 'cu***@mail.com' : 'ab***@mail.com'
      });
    }

    if (req.url === '/api/rw/redeem/claim') {
      if (!body.account) return json(res, 400, { error: 'account required' });
      if (!record) return json(res, 200, { success: false, purchaseStatus: 'not_found' });
      if (body.confirm !== true) return json(res, 400, { error: 'confirm:true required' });
      if (record.claimedBy && record.claimedBy !== body.account) {
        return json(res, 200, { success: false, purchaseStatus: 'already_claimed' });
      }
      if (record.status !== 'active') return json(res, 200, { success: false, purchaseStatus: record.status });
      record.claimedBy = body.account;
      return json(res, 200, {
        success: true,
        purchaseStatus: 'active',
        product: record.app,
        accessUntil: record.accessUntil || null,
        customer: 'ab***@mail.com',
        redemptionId: 'store-' + crypto.randomUUID()
      });
    }

    json(res, 404, { error: 'unknown path' });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const results = [];
  const step = (n, name, pass, detail) => {
    results.push(pass);
    console.log(`${pass ? 'PASS' : 'FAIL'}  Step ${n}: ${name}${detail ? ' — ' + detail : ''}`);
  };

  const mock = await startMockStore();
  const mockPort = mock.address().port;

  process.env.RW_STORE_BASE_URL = `http://127.0.0.1:${mockPort}`;
  process.env.RW_STORE_API_KEY = MOCK_KEY;

  const app = require('../src/app');
  const api = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const port = api.address().port;
  const url = `http://127.0.0.1:${port}`;

  const post = async (path, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(url + path, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const get = async (path, token) => {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(url + path, { headers });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };

  const APP = { id: 'warrior-planner', title: 'Warrior Planner Pro', appType: 'web_app', pricing: 'one_time' };

  console.log('\nRedeemed Warrior — Store Integration End-to-End Test\n=====================================================\n');

  const reg = await post('/api/auth/register', { email: 'e2e@example.com', password: 'strong-pass-1' });
  const memberToken = reg.data.token;
  step(0, 'Member account created', reg.status === 201 && Boolean(memberToken));

  const reg2 = await post('/api/auth/register', { email: 'e2e-b@example.com', password: 'strong-pass-1' });
  const memberTokenB = reg2.data.token;
  step(0, 'Second member account created (for security checks)', reg2.status === 201);

  issueCode('RW-E2E-0001', APP, { accessUntil: null });
  step(1, 'Store purchase (simulated): code RW-E2E-0001 issued for "Warrior Planner Pro"', codes.has('RW-E2E-0001'));

  const wrongKeyRes = await fetch(`${process.env.RW_STORE_BASE_URL}/api/rw/redeem/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RW-Key': 'wrong-key' },
    body: JSON.stringify({ code: 'RW-E2E-0001' })
  });
  step(2, 'Code verification rejects a wrong server key', wrongKeyRes.status === 401);

  const badCode = await post('/api/store/redeem', { code: 'RW-NOPE-9999' }, memberToken);
  step(2, 'Redeeming an unknown code fails with a helpful message', badCode.status === 400 && /not found/i.test(badCode.data.error.message));

  const preview = await post('/api/store/redeem', { code: 'RW-E2E-0001' }, memberToken);
  step(
    3,
    'Code check shows the app and masked customer, nothing linked yet',
    preview.status === 200 && preview.data.readyForConfirm === true && preview.data.app && preview.data.app.name === APP.title && /\*\*\*/.test(preview.data.customer || '')
  );

  const nothingLinked = await get('/api/store/my-apps', memberToken);
  step(3, 'My Apps still empty before confirmation', (nothingLinked.data.apps || []).length === 0);

  const redeem = await post('/api/store/redeem', { code: 'RW-E2E-0001', confirm: true }, memberToken);
  step(3, 'Code claimed with confirm:true', redeem.status === 200 && redeem.data.redeemed === true, redeem.data.app && redeem.data.app.name);

  const myApps = await get('/api/store/my-apps', memberToken);
  const appEntry = (myApps.data.apps || []).find((a) => a.appId === APP.id);
  step(4, 'App appears in My Apps', Boolean(appEntry), appEntry && appEntry.name);

  const access = await get(`/api/store/my-apps/${APP.id}/access`, memberToken);
  step(5, 'Access granted', access.status === 200 && access.data.hasAccess === true);

  const steal = await post('/api/store/redeem', { code: 'RW-E2E-0001' }, memberTokenB);
  step(5, 'Same code rejected on another account', steal.status === 409);

  codes.get('RW-E2E-0001').status = 'refunded';
  const record = require('../src/services/redemptions').findByCode('RW-E2E-0001');
  record.lastCheckedAt = Date.now() - 25 * 60 * 60 * 1000;

  const revoked = await get(`/api/store/my-apps/${APP.id}/access`, memberToken);
  step(
    6,
    'Access revoked after refund, with a friendly reason',
    revoked.status === 200 && revoked.data.hasAccess === false && revoked.data.status === 'refunded' && /refunded/i.test(revoked.data.reason || '')
  );

  const myAppsAfter = await get('/api/store/my-apps', memberToken);
  const appAfter = (myAppsAfter.data.apps || []).find((a) => a.appId === APP.id);
  step(6, 'My Apps shows the revoked status', Boolean(appAfter) && appAfter.hasAccess === false && appAfter.status === 'refunded');

  const redemptionsList = await get('/api/store/redemptions', memberToken);
  const masked = (redemptionsList.data.redemptions || [])[0];
  step(6, 'Redemption status visible with the code masked', Boolean(masked) && /\*/.test(masked.code));

  mock.close();
  api.close();

  const passed = results.filter(Boolean).length;
  console.log(`\nResult: ${passed}/${results.length} checks passed.\n`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('E2E test crashed:', err);
  process.exit(1);
});
