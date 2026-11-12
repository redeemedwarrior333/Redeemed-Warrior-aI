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

router.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'owner.html'));
});

router.get('/files', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'files.html'));
});

module.exports = router;
