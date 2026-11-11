const path = require('path');

require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  apiKey: process.env.API_KEY || '',
  aiBaseUrl: (process.env.AI_BASE_URL || 'https://api.mistral.ai/v1').replace(/\/+$/, ''),
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'mistral-small-latest',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 60,
  rateLimitWindowMs: 60 * 1000,
  maxHistoryMessages: 20,
  masterPromptPath: path.join(__dirname, '..', 'MASTER_PROMPT.md')
};

module.exports = config;
