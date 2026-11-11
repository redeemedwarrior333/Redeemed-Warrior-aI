const config = require('../config');
const storeClient = require('./storeClient');
const redemptions = require('./redemptions');

async function recheckAll() {
  const due = redemptions.listActiveForRecheck();
  for (const record of due) {
    try {
      const check = await storeClient.checkCode(record.code);
      const result = redemptions.applyStatus(record, check.status);
      if (result !== 'active') {
        console.log(`Access revoked for ${record.accountId} (${record.app.name}): ${result}`);
      }
    } catch (err) {
      if (!err.expected) {
        console.error('Access recheck failed for', record.redemptionId, err.message);
      }
    }
  }
}

function start() {
  setInterval(() => {
    recheckAll().catch(() => {});
  }, config.accessRecheckIntervalMs).unref();
}

module.exports = { start, recheckAll };
