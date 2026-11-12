const express = require('express');
const path = require('path');

const router = express.Router();

router.use('/apps', express.static(path.join(__dirname, '..', '..', 'public', 'apps')));

router.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'chat.html'));
});

router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'dashboard.html'));
});

router.get('/autopilot', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'autopilot.html'));
});

module.exports = router;
