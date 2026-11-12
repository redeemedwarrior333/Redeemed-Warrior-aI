const crypto = require('crypto');

const ACTIVE_STATUSES = new Set(['active', 'already_claimed']);
const REVOKED_STATUSES = new Set(['refunded', 'cancelled', 'expired', 'not_found']);

const redemptions = new Map();
const ACCESS_TTL_MS = 24 * 60 * 60 * 1000;

function newId() {
  return crypto.randomUUID();
}

function recordClaim({ code, accountId, app, redemptionId, status, accessUntil }) {
  const existing = findByCode(code);
  if (existing) {
    existing.status = status || existing.status;
    existing.app = app || existing.app;
    existing.accessUntil = accessUntil !== undefined ? accessUntil : existing.accessUntil;
    existing.lastCheckedAt = Date.now();
    return existing;
  }
  const record = {
    redemptionId: redemptionId || newId(),
    code,
    accountId,
    app: app || { id: 'unknown-' + newId(), name: 'Purchased app' },
    status: status || 'active',
    accessUntil: accessUntil || null,
    claimedAt: Date.now(),
    lastCheckedAt: Date.now()
  };
  redemptions.set(record.redemptionId, record);
  return record;
}

function findByCode(code) {
  for (const record of redemptions.values()) {
    if (record.code === code) return record;
  }
  return null;
}

function findById(redemptionId) {
  return redemptions.get(redemptionId) || null;
}

function listByMember(accountId) {
  return Array.from(redemptions.values())
    .filter((r) => r.accountId === accountId)
    .sort((a, b) => b.claimedAt - a.claimedAt);
}

function hasAccess(accountId, appId) {
  return listByMember(accountId).some(
    (r) => r.app.id === appId && ACTIVE_STATUSES.has(r.status) && !accessExpired(r)
  );
}

function accessExpired(record) {
  return Boolean(record.accessUntil && record.accessUntil <= Date.now());
}

function applyStatus(record, storeStatus, accessUntil) {
  record.lastCheckedAt = Date.now();
  if (accessUntil !== undefined) {
    record.accessUntil = accessUntil;
  }
  if (accessExpired(record) && ACTIVE_STATUSES.has(storeStatus)) {
    record.status = 'expired';
    return 'expired';
  }
  if (ACTIVE_STATUSES.has(storeStatus)) {
    record.status = 'active';
    return 'active';
  }
  if (REVOKED_STATUSES.has(storeStatus)) {
    record.status = storeStatus;
    return storeStatus;
  }
  return record.status;
}

function needsRecheck(record) {
  return ACTIVE_STATUSES.has(record.status) && Date.now() - record.lastCheckedAt > ACCESS_TTL_MS;
}

function listActiveForRecheck() {
  return Array.from(redemptions.values()).filter((r) => needsRecheck(r));
}

module.exports = {
  redemptions,
  recordClaim,
  findByCode,
  findById,
  listByMember,
  hasAccess,
  accessExpired,
  applyStatus,
  needsRecheck,
  listActiveForRecheck,
  ACTIVE_STATUSES,
  REVOKED_STATUSES
};
