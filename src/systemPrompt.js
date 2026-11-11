const fs = require('fs');

const config = require('./config');

let cachedPrompt = '';

function getSystemPrompt() {
  if (!cachedPrompt) {
    cachedPrompt = fs.readFileSync(config.masterPromptPath, 'utf8');
  }
  return cachedPrompt;
}

module.exports = { getSystemPrompt };
