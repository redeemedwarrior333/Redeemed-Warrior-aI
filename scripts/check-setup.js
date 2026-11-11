const fs = require('fs');
const path = require('path');

require('dotenv').config();

const config = require('../src/config');

const repoRoot = path.join(__dirname, '..');

const results = [];

function report(ok, message, fix) {
  results.push({ ok, message, fix });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok && fix) {
    console.log(`      Fix: ${fix}`);
  }
}

async function main() {
  console.log('\nRedeemed Warrior AI — Setup Check\n=================================\n');

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  report(
    nodeMajor >= 18,
    `Node.js version ${process.versions.node}`,
    'Install Node.js 18 or newer from https://nodejs.org and run this command again.'
  );

  const envPath = path.join(repoRoot, '.env');
  const envTxtPath = path.join(repoRoot, '.env.txt');
  if (fs.existsSync(envPath)) {
    report(true, '.env file found');
  } else if (fs.existsSync(envTxtPath)) {
    report(
      false,
      'Found a file called .env.txt instead of .env',
      'Windows Notepad added ".txt" to the name. Rename the file to exactly ".env" (no .txt at the end), then run this check again.'
    );
  } else {
    report(
      false,
      'No .env file found in this folder',
      'In this folder, copy .env.example to a new file named exactly ".env", then fill in your keys and run this check again.'
    );
  }

  if (config.aiApiKey) {
    report(true, `AI_API_KEY is set (starts with "${config.aiApiKey.slice(0, 4)}...")`);
  } else {
    report(
      false,
      'AI_API_KEY is missing or empty in your .env file',
      'This is the key from your AI provider (Mistral, OpenAI, etc.). Get one at https://console.mistral.ai (API Keys page), paste it into .env as AI_API_KEY=your-key, then run this check again.'
    );
  }

  if (config.apiKey) {
    report(true, 'API_KEY is set (this protects your API)');
  } else {
    report(
      false,
      'API_KEY is missing or empty in your .env file',
      'Invent a long random password (for example: rw_9f2kx7... ) and put it in .env as API_KEY=your-invented-password. Anyone who knows this key can use your API.'
    );
  }

  const promptPath = path.join(repoRoot, 'MASTER_PROMPT.md');
  report(
    fs.existsSync(promptPath),
    'MASTER_PROMPT.md found (the AI\'s instructions)',
    'This file should be in the same folder as package.json. If it is missing, download it from the GitHub repository.'
  );

  if (!config.aiApiKey) {
    console.log('\nResult: 2 problems found. Fix the items above and run "npm run check" again.\n');
    process.exit(1);
  }

  console.log(`\nTesting your AI key against ${config.aiBaseUrl} (model: ${config.aiModel})...`);

  let response;
  try {
    response = await fetch(`${config.aiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.aiApiKey}`
      },
      body: JSON.stringify({
        model: config.aiModel,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5
      })
    });
  } catch (err) {
    report(
      false,
      `Could not reach the AI provider at ${config.aiBaseUrl}`,
      'Check your internet connection, and check AI_BASE_URL in .env for typos. For Mistral it must be exactly: https://api.mistral.ai/v1'
    );
    finish();
    return;
  }

  if (response.ok) {
    report(true, `Your AI key works! The AI responded successfully using "${config.aiModel}".`);
    console.log('\nResult: Everything is set up correctly. Run "npm start" and start building!\n');
    process.exit(0);
  }

  if (response.status === 401 || response.status === 403) {
    report(
      false,
      'Your AI provider rejected the key (invalid or expired)',
      'Go back to your provider\'s API Keys page, create a NEW key, and copy the whole thing carefully into .env: no spaces, no quotes, nothing missing at the end. Make sure it is on the AI_API_KEY line (not API_KEY). Then run this check again.'
    );
  } else if (response.status === 404) {
    report(
      false,
      `The model "${config.aiModel}" was not found on your AI provider`,
      'Check AI_MODEL in .env for typos. For Mistral, use: mistral-small-latest'
    );
  } else if (response.status === 429) {
    report(
      false,
      'Your AI provider rate-limited or quota-limited this key',
      'Free plans have per-minute limits. Wait a minute and run this check again. If it keeps failing, check your plan and billing on your provider\'s website.'
    );
  } else {
    const detail = await response.text().catch(() => '');
    report(
      false,
      `The AI provider returned an unexpected error (HTTP ${response.status})`,
      detail ? `Provider said: ${detail.slice(0, 300)}` : 'Try again in a few minutes.'
    );
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nResult: ${failed} problem${failed === 1 ? '' : 's'} found. Fix the FAIL items above and run "npm run check" again.\n`);
  process.exit(1);
}

main();
