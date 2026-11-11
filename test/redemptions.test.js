const { test } = require('node:test');
const assert = require('node:assert');

const redemptions = require('../src/services/redemptions');

test('a claimed code grants access to one account', () => {
  const record = redemptions.recordClaim({
    code: 'RW-UNIT-0001',
    accountId: 'member-a',
    app: { id: 'app-1', name: 'Test App' },
    status: 'active'
  });
  assert.equal(redemptions.hasAccess('member-a', 'app-1'), true);
  assert.equal(redemptions.hasAccess('member-b', 'app-1'), false);
  assert.equal(record.status, 'active');
});

test('revocation removes access but keeps the record visible', () => {
  const record = redemptions.recordClaim({
    code: 'RW-UNIT-0002',
    accountId: 'member-c',
    app: { id: 'app-2', name: 'Refund App' },
    status: 'active'
  });
  assert.equal(redemptions.hasAccess('member-c', 'app-2'), true);

  const result = redemptions.applyStatus(record, 'refunded');
  assert.equal(result, 'refunded');
  assert.equal(record.status, 'refunded');
  assert.equal(redemptions.hasAccess('member-c', 'app-2'), false);

  const listed = redemptions.listByMember('member-c');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].status, 'refunded');
});

test('reclaiming after a store-side reset reactivates access', () => {
  const record = redemptions.recordClaim({
    code: 'RW-UNIT-0003',
    accountId: 'member-d',
    app: { id: 'app-3', name: 'Cycle App' },
    status: 'active'
  });
  redemptions.applyStatus(record, 'cancelled');
  assert.equal(redemptions.hasAccess('member-d', 'app-3'), false);

  redemptions.recordClaim({
    code: 'RW-UNIT-0003',
    accountId: 'member-d',
    app: { id: 'app-3', name: 'Cycle App' },
    status: 'active'
  });
  assert.equal(redemptions.hasAccess('member-d', 'app-3'), true);
});

test('records due for recheck are found and fresh ones are skipped', () => {
  const record = redemptions.recordClaim({
    code: 'RW-UNIT-0004',
    accountId: 'member-e',
    app: { id: 'app-4', name: 'Fresh App' },
    status: 'active'
  });
  assert.equal(redemptions.needsRecheck(record), false);
  record.lastCheckedAt = Date.now() - 25 * 60 * 60 * 1000;
  assert.equal(redemptions.needsRecheck(record), true);
  assert.ok(redemptions.listActiveForRecheck().some((r) => r.code === 'RW-UNIT-0004'));
});
