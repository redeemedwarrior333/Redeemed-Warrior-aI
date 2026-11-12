const express = require('express');

const { providers, chatWithProvider } = require('../services/aiClient');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const list = providers();
    if (!list.length) {
      return res.json({ providers: [], note: 'No AI providers are configured yet.' });
    }
    const results = [];
    for (const provider of list) {
      const entry = { name: provider.name, model: provider.model, baseUrl: provider.baseUrl };
      try {
        await chatWithProvider(provider, { messages: [{ role: 'user', content: 'ping' }] });
        entry.ok = true;
      } catch (err) {
        entry.ok = false;
        entry.error = err.publicMessage || err.message;
      }
      results.push(entry);
    }
    res.json({ providers: results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
