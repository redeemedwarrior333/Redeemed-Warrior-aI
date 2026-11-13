const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const app = require('../src/app');

const APP_PATH = path.join(__dirname, '..', 'public', 'apps', 'ad-studio', 'index.html');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function inlineScript() {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  const match = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  return match ? match[1] : '';
}

test('ad studio app is served at /apps/ad-studio/', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const res = await fetch(`http://localhost:${port}/apps/ad-studio/`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(body, /Ad Studio/);
    assert.match(body, /Faith-Fueled Advertising/);
  } finally {
    server.close();
  }
});

test('ad studio inline script is syntactically valid', () => {
  const script = inlineScript();
  assert.ok(script.length > 10000);
  new Function(script);
});

test('ad studio defines seven ad types with unique ids and markers', () => {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  const ids = [...html.matchAll(/id:'([a-z]+)', name:/g)].map(m => m[1]);
  assert.deepEqual([...new Set(ids)].sort(), ['email', 'google', 'pack', 'product', 'slogan', 'social', 'video']);
  assert.match(html, /Social Media Caption/);
  assert.match(html, /Complete Ad Pack/);
});

test('ad studio parser extracts labeled sections from ai replies', () => {
  const script = inlineScript();
  const start = script.indexOf('function parseSections');
  const end = script.indexOf('function isOwner');
  assert.ok(start > 0 && end > start);
  const parseSections = new Function(script.slice(start, end) + '; return parseSections;')();
  const reply = 'CAPTION: Grace looks good on you.\nHASHTAGS: #faith #candles\nCTA: Shop now';
  const out = parseSections(reply, { caption: 'CAPTION', hashtags: 'HASHTAGS', cta: 'CTA' });
  assert.equal(out.caption, 'Grace looks good on you.');
  assert.equal(out.hashtags, '#faith #candles');
  assert.equal(out.cta, 'Shop now');
});

test('ad studio parser keeps hashtags intact and handles markdown labels', () => {
  const script = inlineScript();
  const start = script.indexOf('function parseSections');
  const end = script.indexOf('function isOwner');
  const parseSections = new Function(script.slice(start, end) + '; return parseSections;')();
  const reply = '**CAPTION:** Bold test line\n**HASHTAGS:** **#bold #test**\nCTA: Buy';
  const out = parseSections(reply, { caption: 'CAPTION', hashtags: 'HASHTAGS', cta: 'CTA' });
  assert.equal(out.caption, 'Bold test line');
  assert.equal(out.hashtags, '#bold #test');
  assert.equal(out.cta, 'Buy');
});

test('ad studio api line auto-connects when hosted off the apps domain', () => {
  const script = inlineScript();
  assert.match(script, /const API = \(location\.hostname === 'apps\.godsredeemedwarrior\.org'/);
  assert.match(script, /https:\/\/apps\.godsredeemedwarrior\.org/);
});
