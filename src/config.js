const path = require('path');

require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3000,
  apiKey: process.env.API_KEY || '',
  aiBaseUrl: (process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, ''),
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gemini-flash-latest',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 60,
  publicChatEnabled: process.env.PUBLIC_CHAT_ENABLED === 'true',
  publicRateLimitMax: Number(process.env.PUBLIC_RATE_LIMIT_MAX) || 10,
  rwStoreBaseUrl: (process.env.RW_STORE_BASE_URL || 'https://godsredeemedwarrior.store/.sfs-be').replace(/\/+$/, ''),
  rwStoreApiKey: process.env.RW_STORE_API_KEY || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  ownerEmails: new Set((process.env.OWNER_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)),
  storeTimeoutMs: Number(process.env.STORE_TIMEOUT_MS) || 15000,
  accessRecheckIntervalMs: Number(process.env.ACCESS_RECHECK_INTERVAL_MS) || 24 * 60 * 60 * 1000,
  rateLimitWindowMs: 60 * 1000,
  maxHistoryMessages: 20,
  masterPromptPath: path.join(__dirname, '..', 'MASTER_PROMPT.md')
};

module.exports = config;
