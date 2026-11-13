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

test('ad studio includes video ad generator with recording support', () => {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(html, /Make the Video/);
  assert.match(html, /function buildScenes/);
  assert.match(html, /async function makeVideoAd/);
  assert.match(html, /MediaRecorder/);
  assert.match(html, /captureStream/);
  assert.match(html, /startMusicBed/);
  assert.match(html, /Download My Video/);
});

test('ad studio video engine draws animated frames with crossfades and sparkles', () => {
  const script = inlineScript();
  const start = script.indexOf('function wrapCanvasText');
  const end = script.indexOf('async function makeVideoAd');
  assert.ok(start > 0 && end > start);
  const engine = new Function(script.slice(start, end) + '; return { drawVideoFrame, VIDEO_FADE, drawSceneBackground, sparkleStar, drawVignette, drawProgressBar };')();
  assert.equal(engine.VIDEO_FADE, 0.6);
  assert.equal(typeof engine.drawSceneBackground, 'function');
  assert.equal(typeof engine.sparkleStar, 'function');
  const calls = { fillText: 0, fillRect: 0 };
  const grad = { addColorStop() {} };
  const ctx = {
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, moveTo() {},
    quadraticCurveTo() {}, arcTo() {}, closePath() {}, fill() {}, clip() {}, rect() {},
    strokeRect() {}, fillRect: () => { calls.fillRect++; },
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    measureText: (s) => ({ width: String(s).length * 12 }),
    fillText: () => { calls.fillText++; },
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '',
    shadowColor: '', shadowBlur: 0, globalAlpha: 1
  };
  const scenes = [
    { label: 'HOOK', text: 'Stop scrolling warrior.' },
    { label: 'CALL TO ACTION', text: 'Start today', cta: true }
  ];
  const times = [0, 4, 8];
  engine.drawVideoFrame(ctx, 720, 1280, scenes, times, 0.2, 'REDEEMED WARRIOR');
  engine.drawVideoFrame(ctx, 720, 1280, scenes, times, 3.8, 'REDEEMED WARRIOR');
  engine.drawVideoFrame(ctx, 720, 1280, scenes, times, 7.9, 'REDEEMED WARRIOR');
  assert.ok(calls.fillText > 0);
  assert.ok(calls.fillRect > 0);
  assert.equal(ctx.globalAlpha, 1);
});

test('ad studio music bed layers an arpeggio over the chord pad', () => {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(html, /arpFreqs/);
  assert.match(html, /type = 'triangle'/);
});

test('ad studio video offers a slides editor with add, remove, reorder and preview', () => {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(html, /data-scenes="auto"/);
  assert.match(html, /data-scenes="edit"/);
  assert.match(html, /id="slideEditor"/);
  assert.match(html, /id="btnAddSlide"/);
  assert.match(html, /id="slidePrev"/);
  assert.match(html, /function renderSlideEditor/);
  assert.match(html, /function slideBase/);
  assert.match(html, /function drawSlidePreview/);
  assert.match(html, /data-aiphoto/);
  assert.match(html, /btnAIAll/);
  assert.match(html, /data-bg="wine"/);
  assert.match(html, /SLIDE_PALETTES/);
  assert.match(html, /function getSlideImage/);
  assert.match(html, /function pollinationsUrl/);
  assert.match(html, /image\.pollinations\.ai/);
  assert.match(html, /function generateSlidePhoto/);
  assert.match(html, /function generateAllSlidePhotos/);
  const script = inlineScript();
  const start = script.indexOf('function buildScenes');
  const end = script.indexOf('async function makeVideoAd');
  assert.ok(start > 0 && end > start);
  const slideBase = new Function(script.slice(start, script.indexOf('function drawSlidePreview')) + '; return slideBase;')();
  const base = slideBase({ id: 'video' }, { hook: 'Stop scrolling.', sc1: 'One.', cta: 'Start today' });
  assert.equal(base.length, 3);
  assert.equal(base[0].cta, false);
  assert.equal(base[2].cta, true);
  assert.ok(base[0].dur >= 1.5 && base[0].dur <= 10);
});

test('ad studio video offers no-voice, ai-voice and my-voice options', () => {
  const html = fs.readFileSync(APP_PATH, 'utf8');
  assert.match(html, /data-voice="none"/);
  assert.match(html, /data-voice="ai"/);
  assert.match(html, /data-voice="mic"/);
  const script = inlineScript();
  assert.match(script, /data-voice\]\.sel/);
  assert.match(script, /getUserMedia/);
  assert.match(script, /speechSynthesis/);
  assert.match(script, /SpeechSynthesisUtterance/);
});

test('ad studio records hd video with a high bitrate', () => {
  const script = inlineScript();
  assert.match(script, /const W = 1080/);
  assert.match(script, /1080 : 1920/);
  assert.match(script, /videoBitsPerSecond: 10000000/);
  assert.match(script, /audioBitsPerSecond: 128000/);
});

test('ad studio video scene builder creates timed scenes from script', () => {
  const script = inlineScript();
  const start = script.indexOf('function buildScenes');
  const end = script.indexOf('function sceneDuration');
  assert.ok(start > 0 && end > start);
  const buildScenes = new Function(script.slice(start, end) + '; return buildScenes;')();
  const scenes = buildScenes({ id: 'video' }, { hook: 'Stop scrolling.', sc1: 'One.', sc2: 'Two.', sc3: 'Three.', cta: 'Start today' });
  assert.equal(scenes.length, 5);
  assert.equal(scenes[0].text, 'Stop scrolling.');
  assert.equal(scenes[4].cta, true);
  const short = buildScenes({ id: 'video' }, { hook: 'Hook only', cta: 'Go' });
  assert.equal(short.length, 2);
});
