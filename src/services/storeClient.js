const config = require('../config');

class StoreError extends Error {
  constructor(status, publicMessage, cause) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.cause = cause;
  }
}

function requireStoreConfig() {
  if (!config.rwStoreApiKey) {
    const err = new StoreError(
      503,
      'The Store connection is not configured yet. Add RW_STORE_API_KEY to the server environment and restart.'
    );
    err.expected = true;
    throw err;
  }
}

async function storeRequest(path, body) {
  requireStoreConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.storeTimeoutMs);

  let response;
  try {
    response = await fetch(`${config.rwStoreBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RW-Key': config.rwStoreApiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new StoreError(504, 'The Store took too long to answer. Please try again in a moment.');
    }
    throw new StoreError(502, 'Could not reach the Redeemed Warrior Store. Please try again in a moment.', err);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new StoreError(502, 'The Store rejected this server\'s key (X-RW-Key). Check RW_STORE_API_KEY on both sides.');
    }
    if (response.status === 404) {
      throw new StoreError(502, 'The Store redemption API was not found at this address. Confirm the Store has deployed its /api/rw/redeem endpoints.');
    }
    const message = data && data.error ? String(data.error) : `The Store returned an error (HTTP ${response.status}).`;
    throw new StoreError(502, message);
  }

  return data || {};
}

function normalizeStatus(raw) {
  const status = String(raw || '').toLowerCase();
  if (['active', 'valid', 'paid', 'complete', 'completed'].includes(status)) return 'active';
  if (['refunded'].includes(status)) return 'refunded';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  if (['expired'].includes(status)) return 'expired';
  if (['already_claimed', 'claimed', 'redeemed'].includes(status)) return 'already_claimed';
  if (['not_found', 'unknown', 'invalid'].includes(status)) return 'not_found';
  return status || 'unknown';
}

function pickApp(data) {
  const app = data && (data.app || data.product || data.item);
  if (!app || typeof app !== 'object') return null;
  const id = app.id || app.appId || app.productId || app.slug;
  if (!id) return null;
  return {
    id: String(id),
    name: String(app.name || app.title || 'Purchased app'),
    type: app.type ? String(app.type) : undefined
  };
}

async function checkCode(code) {
  const data = await storeRequest('/api/rw/redeem/check', { code });
  return {
    valid: Boolean(data && (data.valid === true || data.valid === 'true' || data.ok === true)),
    status: normalizeStatus(data && (data.status || (data.valid ? 'active' : 'not_found'))),
    app: pickApp(data),
    raw: data
  };
}

async function claimCode(code, accountId) {
  const data = await storeRequest('/api/rw/redeem/claim', {
    code,
    confirm: true,
    accountId
  });
  return {
    success: Boolean(data && (data.success === true || data.ok === true || data.claimed === true)),
    status: normalizeStatus(data && data.status),
    app: pickApp(data),
    redemptionId: data && (data.redemptionId || data.id) ? String(data.redemptionId || data.id) : undefined,
    raw: data
  };
}

module.exports = { checkCode, claimCode, StoreError };
