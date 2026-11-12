const express = require('express');

const requireMember = require('../middleware/memberAuth');
const members = require('../services/members');
const redemptions = require('../services/redemptions');

const router = express.Router();

router.use(requireMember);
router.use((req, res, next) => {
  if (!members.isOwner(req.member)) {
    return res.status(403).json({ error: { message: 'Owner access only.' } });
  }
  next();
});

router.get('/reset-requests', (req, res) => {
  res.json({
    requests: members.listResetRequests().map((r) => ({
      id: r.id,
      email: r.email,
      requestedAt: new Date(r.requestedAt).toISOString()
    }))
  });
});

router.post('/reset-requests/:id/resolve', (req, res) => {
  const result = members.resolveResetRequest(req.params.id);
  if (!result) {
    return res.status(404).json({ error: { message: 'That request is no longer pending.' } });
  }
  res.json({
    email: result.request.email,
    tempPassword: result.tempPassword,
    message: `Temporary password created for ${result.request.email}. Give it to the member \u2014 they can change it under Account.`
  });
});

router.get('/stats', (req, res) => {
  const allRedemptions = redemptions.listAll();
  res.json({
    members: members.members.size,
    activeTokens: members.tokens.size,
    resetRequests: members.resetRequests.size,
    redemptions: allRedemptions.length,
    activeRedemptions: allRedemptions.filter((r) => redemptions.ACTIVE_STATUSES.has(r.status) && !redemptions.accessExpired(r)).length,
    uptimeSeconds: Math.round(process.uptime())
  });
});

router.get('/members', (req, res) => {
  res.json({
    members: [...members.members.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200)
      .map((m) => ({
        email: m.email,
        role: members.isOwner(m) ? 'owner' : 'member',
        createdAt: new Date(m.createdAt).toISOString()
      }))
  });
});

router.get('/redemptions', (req, res) => {
  res.json({
    redemptions: redemptions.listAll().slice(0, 200).map((r) => ({
      code: r.code.replace(/.(?=.{4})/g, '*'),
      app: r.app,
      status: r.status,
      hasAccess: redemptions.ACTIVE_STATUSES.has(r.status) && !redemptions.accessExpired(r),
      claimedAt: new Date(r.claimedAt).toISOString()
    }))
  });
});

module.exports = router;
