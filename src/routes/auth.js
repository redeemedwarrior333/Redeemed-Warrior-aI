const express = require('express');

const members = require('../services/members');
const requireMember = require('../middleware/memberAuth');

const router = express.Router();

function publicMember(member) {
  return { memberId: member.memberId, email: member.email, role: members.isOwner(member) ? 'owner' : 'member' };
}

router.post('/register', (req, res) => {
  const { email, password } = req.body || {};
  const result = members.register(email, password);
  if (result.error) {
    return res.status(400).json({ error: { message: result.error } });
  }
  const token = members.issueToken(result.member);
  res.status(201).json({ member: publicMember(result.member), token });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const result = members.login(email, password);
  if (result.error) {
    return res.status(401).json({ error: { message: result.error } });
  }
  const token = members.issueToken(result.member);
  res.json({ member: publicMember(result.member), token });
});

router.get('/me', requireMember, (req, res) => {
  res.json({ member: publicMember(req.member) });
});

router.post('/forgot', (req, res) => {
  const email = req.body && typeof req.body.email === 'string' ? req.body.email : '';
  members.requestReset(email);
  res.json({
    message: 'If that email has an account, your request was sent to the platform owner, who will give you a temporary password.'
  });
});

router.post('/change-password', requireMember, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const result = members.changePassword(req.member.memberId, currentPassword, newPassword);
  if (result.error) {
    return res.status(400).json({ error: { message: result.error } });
  }
  res.json({ message: 'Your password has been updated.' });
});

module.exports = router;
