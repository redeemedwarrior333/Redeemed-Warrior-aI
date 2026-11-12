const express = require('express');

const requireMember = require('../middleware/memberAuth');
const storeClient = require('../services/storeClient');
const redemptions = require('../services/redemptions');

const router = express.Router();

const FRIENDLY_STATUS = {
  not_found: 'That code was not found. Double-check it against your purchase email — codes look like RW-XXXX-XXXX.',
  refunded: 'This purchase was refunded, so its access has been removed. If you believe this is a mistake, contact store support.',
  cancelled: 'This purchase was cancelled, so its access has been removed. If you believe this is a mistake, contact store support.',
  expired: 'This purchase has expired. Renew it in the Store to regain access.',
  already_claimed: 'This code has already been used. Each code unlocks apps on one account only.'
};

function friendlyStatus(status) {
  return FRIENDLY_STATUS[status] || `This code cannot be redeemed right now (status: ${status}).`;
}

router.use(requireMember);

router.post('/redeem', async (req, res, next) => {
  try {
    const code = req.body && typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!code) {
      return res.status(400).json({
        error: { message: 'Please enter your redemption code from your Store purchase email.' }
      });
    }

    const existing = redemptions.findByCode(code);
    if (existing && existing.accountId !== req.member.memberId) {
      return res.status(409).json({
        error: { message: 'This code has already been used on another account. Each code belongs to one account only.' }
      });
    }

    const confirmed = Boolean(req.body && req.body.confirm === true);
    const check = await storeClient.checkCode(code, req.member.memberId);

    if (!check.valid || check.status !== 'active') {
      return res.status(400).json({ error: { message: friendlyStatus(check.status) } });
    }

    const app = check.app || { id: 'unknown', name: 'Purchased app' };

    if (!confirmed) {
      return res.json({
        readyForConfirm: true,
        code,
        app,
        purchaseStatus: check.status,
        accessUntil: check.accessUntil ? new Date(check.accessUntil).toISOString() : null,
        customer: check.customer || null,
        message: `Add "${app.name}" to your account? Nothing is linked yet — confirm to finish.`
      });
    }

    const claim = await storeClient.claimCode(code, req.member.memberId);
    if (!claim.success || (claim.status && claim.status !== 'active' && claim.status !== 'already_claimed')) {
      return res.status(400).json({ error: { message: friendlyStatus(claim.status || 'unknown') } });
    }

    const record = redemptions.recordClaim({
      code,
      accountId: req.member.memberId,
      app: claim.app || app,
      redemptionId: claim.redemptionId,
      status: 'active',
      accessUntil: claim.accessUntil
    });

    res.json({
      redeemed: true,
      app: record.app,
      redemptionId: record.redemptionId,
      message: `Success! "${record.app.name}" has been added to My Apps.`
    });
  } catch (err) {
    next(err);
  }
});

router.get('/my-apps', (req, res) => {
  const records = redemptions.listByMember(req.member.memberId);
  res.json({
    apps: records.map((r) => ({
      appId: r.app.id,
      name: r.app.name,
      status: r.status,
      hasAccess: redemptions.ACTIVE_STATUSES.has(r.status),
      claimedAt: new Date(r.claimedAt).toISOString()
    }))
  });
});

router.get('/my-apps/:appId/access', async (req, res, next) => {
  try {
    const record = redemptions
      .listByMember(req.member.memberId)
      .find((r) => r.app.id === req.params.appId);

    if (!record) {
      return res.status(404).json({
        error: { message: 'This app is not in your library. Redeem its purchase code first.' }
      });
    }

    if (redemptions.needsRecheck(record)) {
      try {
        const check = await storeClient.checkCode(record.code, req.member.memberId);
        redemptions.applyStatus(record, check.status, check.accessUntil);
      } catch (err) {
        if (!err.expected) throw err;
      }
    }

    const hasAccess = redemptions.ACTIVE_STATUSES.has(record.status) && !redemptions.accessExpired(record);
    res.json({
      appId: record.app.id,
      name: record.app.name,
      hasAccess,
      status: record.status,
      accessUntil: record.accessUntil ? new Date(record.accessUntil).toISOString() : null,
      reason: hasAccess ? null : friendlyStatus(record.status)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/redemptions', (req, res) => {
  const records = redemptions.listByMember(req.member.memberId);
  res.json({
    redemptions: records.map((r) => ({
      redemptionId: r.redemptionId,
      code: r.code.replace(/.(?=.{4})/g, '*'),
      app: r.app,
      status: r.status,
      hasAccess: redemptions.ACTIVE_STATUSES.has(r.status),
      claimedAt: new Date(r.claimedAt).toISOString(),
      lastCheckedAt: new Date(r.lastCheckedAt).toISOString()
    }))
  });
});

module.exports = router;
