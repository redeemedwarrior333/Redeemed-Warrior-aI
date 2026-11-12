const express = require('express');

const config = require('../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'redeemed-warrior-ai-api',
    version: '0.1.0',
    model: config.aiModel,
    aiConfigured: Boolean(config.aiApiKey),
    fallbackConfigured: Boolean(config.aiFallbackApiKey),
    authRequired: Boolean(config.apiKey),
    uptimeSeconds: Math.round(process.uptime())
  });
});

module.exports = router;
