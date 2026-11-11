const app = require('./src/app');
const config = require('./src/config');

if (!config.apiKey) {
  console.warn('WARNING: API_KEY is not set. Anyone who can reach this server can use it. Set API_KEY in your .env file before going live.');
}
if (!config.aiApiKey) {
  console.warn('WARNING: AI_API_KEY is not set. Chat and app planning endpoints will return an error until you add it.');
}

app.listen(config.port, () => {
  console.log(`Redeemed Warrior AI API listening on http://localhost:${config.port}`);
  console.log(`Model: ${config.aiModel} | Provider: ${config.aiBaseUrl}`);
});
