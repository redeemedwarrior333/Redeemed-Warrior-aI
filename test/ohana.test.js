const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

process.env.OWNER_EMAILS = 'owner@example.com';
process.env.RATE_LIMIT_MAX = '100000';

const app = require('../src/app');

let emailCounter = 0;
function uniq(base) {
  emailCounter += 1;
  return base.replace('@', '+' + emailCounter + '@');
}

async function registerOrLogin(server, email, password = 'password123') {
  const reg = await req(server, 'POST', '/api/auth/register', null, { email, password });
  if (reg.status === 201) return reg.body;
  const login = await req(server, 'POST', '/api/auth/login', null, { email, password });
  return login.body;
}

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function url(server, p) {
  return `http://localhost:${server.address().port}${p}`;
}

async function req(server, method, p, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url(server, p), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, body: data };
}

async function register(server, email, password = 'password123') {
  return req(server, 'POST', '/api/auth/register', null, { email, password });
}

const APP_PATH = path.join(__dirname, '..', 'public', 'apps', 'ohana', 'index.html');

function appHtml() {
  return fs.readFileSync(APP_PATH, 'utf8');
}

test('ohana welcome screen copy and family identity', () => {
  const html = appHtml();
  assert.ok(html.includes('Welcome Home, Sister.'), 'welcome headline');
  assert.ok(html.includes('One faith. One family. One Ohana.'), 'tagline');
  assert.ok(html.includes('Ohana by Redeemed Warrior'), 'brand name');
});

test('ohana family wall has the five faith reactions', () => {
  const html = appHtml();
  for (const label of ['Sending Love', 'Praying for You', 'Here for You', 'Celebrating You', 'Amen']) {
    assert.ok(html.includes(label), `reaction: ${label}`);
  }
});

test('ohana ships all ten sisterhood circles', async () => {
  const server = await startServer();
  try {
    const a = (await registerOrLogin(server, uniq('circles@ohana.test'))).token;
    const res = await req(server, 'GET', '/api/ohana/circles', a);
    assert.equal(res.status, 200);
    const names = res.body.circles.map(c => c.name);
    for (const name of ['Women of the Bible', 'Healing After the Hurt', 'Faith and Encouragement', 'Christian Motherhood', 'Marriage and Relationships', 'Business and Entrepreneurship', 'Creator Support', 'Prayer Warriors', 'Single Women of Faith', 'Personal Growth and Purpose']) {
      assert.ok(names.includes(name), `circle: ${name}`);
    }
  } finally { server.close(); }
});

test('ohana healing room carries the not-therapy disclaimer and AI guardrails', () => {
  const html = appHtml();
  assert.ok(html.includes('not therapy'), 'healing disclaimer');
  assert.ok(html.includes('mental-health advice'), 'AI guardrail: therapist');
  assert.ok(html.includes('impersonate God'), 'AI guardrail: God');
  assert.ok(html.includes('divine revelation'), 'AI guardrail: revelation');
});

test('ohana navigation: five bottom tabs, more sheet, live gathering entry', () => {
  const html = appHtml();
  const navs = [...html.matchAll(/data-nav="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(navs.includes('home') && navs.includes('wall') && navs.includes('prayer') && navs.includes('sisterhood') && navs.includes('profile'), 'bottom nav tabs');
  assert.ok(html.includes('data-more'), 'more button');
  const mitems = [...html.matchAll(/data-mact="([a-z]+)"/g)].map(m => m[1]);
  assert.ok(mitems.length >= 14, `more sheet items (${mitems.length})`);
  assert.ok(mitems.includes('live'), 'live gathering in menu');
  assert.ok(mitems.includes('admin'), 'admin in menu');
  assert.ok(html.includes('view-live'), 'live view section');
  assert.ok(html.includes('meet.jit.si'), 'live video room embed');
});

test('ohana server: bootstrap, profile, directory', async () => {
  const server = await startServer();
  try {
    const a = await registerOrLogin(server, 'a@ohana.test');
    assert.ok(a.token, 'register or login returned a token');
    const token = a.token;

    const boot = await req(server, 'GET', '/api/ohana/bootstrap', token);
    assert.equal(boot.status, 200);
    assert.ok(boot.body.profile);
    assert.equal(boot.body.membership.level, 'free');
    assert.equal(boot.body.circles.length, 10);
    assert.ok(Array.isArray(boot.body.live));

    const put = await req(server, 'PUT', '/api/ohana/profile', token, { displayName: 'Sister A', intro: 'Hello family', verse: 'Proverbs 31:25', interests: 'prayer' });
    assert.equal(put.status, 200);

    const dir = await req(server, 'GET', '/api/ohana/directory?search=Sister', token);
    assert.equal(dir.status, 200);
    assert.ok(dir.body.members.some(m => m.displayName === 'Sister A'));
  } finally { server.close(); }
});

test('ohana server: wall posts, reactions, comments, delete', async () => {
  const server = await startServer();
  try {
    const a = (await registerOrLogin(server, uniq('a2@ohana.test'))).token;
    const b = (await registerOrLogin(server, uniq('b2@ohana.test'))).token;

    const post = await req(server, 'POST', '/api/ohana/wall', a, { text: 'Good morning family!', kind: 'post' });
    assert.equal(post.status, 200);
    const id = post.body.post.id;

    const react = await req(server, 'POST', `/api/ohana/posts/${id}/react`, b, { reaction: 'praying' });
    assert.equal(react.status, 200);
    assert.equal(react.body.reactions.praying, 1);

    const reactOff = await req(server, 'POST', `/api/ohana/posts/${id}/react`, b, { reaction: 'praying' });
    assert.equal(reactOff.body.reactions.praying, 0);

    const bad = await req(server, 'POST', `/api/ohana/posts/${id}/react`, b, { reaction: 'thumbsup' });
    assert.equal(bad.status, 400);

    const comment = await req(server, 'POST', `/api/ohana/posts/${id}/comments`, b, { text: 'Amen sister!' });
    assert.equal(comment.status, 200);
    assert.equal(comment.body.comments.length, 1);

    const wall = await req(server, 'GET', '/api/ohana/wall', a);
    assert.equal(wall.status, 200);
    assert.ok(wall.body.posts.some(p => p.id === id));

    const del = await req(server, 'DELETE', `/api/ohana/posts/${id}`, b);
    assert.equal(del.status, 403);

    const delMine = await req(server, 'DELETE', `/api/ohana/posts/${id}`, a);
    assert.equal(delMine.status, 200);

    const notifA = await req(server, 'GET', '/api/ohana/notifications', a);
    assert.ok(notifA.body.notifications.length >= 2, 'author got reaction and comment notifications');
  } finally { server.close(); }
});

test('ohana server: prayers, prayed-for, answered', async () => {
  const server = await startServer();
  try {
    const a = (await registerOrLogin(server, uniq('a3@ohana.test'))).token;
    const b = (await registerOrLogin(server, uniq('b3@ohana.test'))).token;

    const pr = await req(server, 'POST', '/api/ohana/prayers', a, { text: 'Please pray for my family.' });
    assert.equal(pr.status, 200);

    const list0 = await req(server, 'GET', '/api/ohana/prayers', a);
    const mine = list0.body.prayers.find(p => p.mine);
    assert.ok(mine, 'my prayer request is listed');
    const id = mine.id;

    const prayed = await req(server, 'POST', `/api/ohana/prayers/${id}/prayed`, b);
    assert.equal(prayed.status, 200);
    assert.equal(prayed.body.prayerCount, 1);

    const answer = await req(server, 'POST', `/api/ohana/prayers/${id}/answer`, a, { praise: 'God came through!' });
    assert.equal(answer.status, 200);

    const list = await req(server, 'GET', '/api/ohana/prayers', b);
    const answered = list.body.prayers.find(p => p.id === id);
    assert.equal(answered.answered, true);
    assert.equal(answered.praise, 'God came through!');
  } finally { server.close(); }
});

test('ohana server: circles join/leave with premium gate', async () => {
  const server = await startServer();
  try {
    const admin = await registerOrLogin(server, 'owner@example.com');
    const emailA = uniq('a4@ohana.test');
    const a = (await registerOrLogin(server, emailA)).token;

    const free = await req(server, 'POST', '/api/ohana/circles/healing/join', a);
    assert.equal(free.status, 200);

    const grant = await req(server, 'POST', '/api/ohana/admin/grant-premium', admin.token, { email: emailA });
    assert.equal(grant.status, 200, 'premium granted');
    const premiumCircle = await req(server, 'POST', '/api/ohana/admin/circles', admin.token, { name: 'Royal Circle', desc: 'Premium only', premium: true });
    assert.equal(premiumCircle.status, 200);

    const joined = await req(server, 'POST', `/api/ohana/circles/${premiumCircle.body.id}/join`, a);
    assert.equal(joined.status, 200);

    const leave = await req(server, 'POST', '/api/ohana/circles/healing/leave', a);
    assert.equal(leave.status, 200);
  } finally { server.close(); }
});

test('ohana server: events, rsvp, live rooms', async () => {
  const server = await startServer();
  try {
    const admin = await registerOrLogin(server, 'owner@example.com');
    const a = (await registerOrLogin(server, uniq('a5@ohana.test'))).token;

    const ev = await req(server, 'POST', '/api/ohana/events', admin.token, { title: 'Tuesday Prayer Circle', when: 'Tuesday 7pm', desc: 'Family prayer', link: '' });
    assert.equal(ev.status, 200);

    const denied = await req(server, 'POST', '/api/ohana/events', a, { title: 'My event', when: '', desc: '', link: '' });
    assert.equal(denied.status, 403);

    const rsvp = await req(server, 'POST', `/api/ohana/events/${ev.body.event.id}/rsvp`, a);
    assert.equal(rsvp.status, 200);
    assert.equal(rsvp.body.rsvpCount, 1);

    const deniedLive = await req(server, 'POST', '/api/ohana/live', a, { title: 'Test' });
    assert.equal(deniedLive.status, 403);

    const live = await req(server, 'POST', '/api/ohana/live', admin.token, { title: 'Prayer Circle Live' });
    assert.equal(live.status, 200);
    const roomId = live.body.room.id;
    assert.ok(live.body.room.room.startsWith('RWOhana-'));

    const hb = await req(server, 'POST', `/api/ohana/live/${roomId}/heartbeat`, a);
    assert.equal(hb.status, 200);
    assert.equal(hb.body.here, 2, 'host and joining sister both counted');

    const boot = await req(server, 'GET', '/api/ohana/bootstrap', a);
    assert.ok(boot.body.live.some(r => r.id === roomId), 'live room in bootstrap');

    const endDenied = await req(server, 'POST', `/api/ohana/live/${roomId}/end`, a);
    assert.equal(endDenied.status, 403);

    const end = await req(server, 'POST', `/api/ohana/live/${roomId}/end`, admin.token);
    assert.equal(end.status, 200);

    const hbGone = await req(server, 'POST', `/api/ohana/live/${roomId}/heartbeat`, a);
    assert.equal(hbGone.status, 404);
  } finally { server.close(); }
});

test('ohana server: direct messages, block, report', async () => {
  const server = await startServer();
  try {
    const a = await registerOrLogin(server, uniq('a6@ohana.test'));
    const b = await registerOrLogin(server, uniq('b6@ohana.test'));

    const send = await req(server, 'POST', `/api/ohana/messages/${b.member.memberId}`, a.token, { text: 'Hi sister!' });
    assert.equal(send.status, 200);

    const convoA = await req(server, 'GET', '/api/ohana/conversations', a.token);
    assert.ok(convoA.body.conversations.length >= 1);

    const read = await req(server, 'GET', `/api/ohana/messages/${a.member.memberId}`, b.token);
    assert.ok(read.body.messages.some(m => m.text === 'Hi sister!'));

    const block = await req(server, 'POST', `/api/ohana/block/${a.member.memberId}`, b.token);
    assert.equal(block.status, 200);

    const blockedSend = await req(server, 'POST', `/api/ohana/messages/${b.member.memberId}`, a.token, { text: 'Hello?' });
    assert.equal(blockedSend.status, 403);

    const report = await req(server, 'POST', '/api/ohana/report', b.token, { targetType: 'post', targetId: 'x', reason: 'test' });
    assert.equal(report.status, 200);

    const admin = await registerOrLogin(server, 'owner@example.com');
    const overview = await req(server, 'GET', '/api/ohana/admin/overview', admin.token);
    assert.equal(overview.status, 200);
    assert.ok(overview.body.reports.length >= 1);
  } finally { server.close(); }
});

test('ohana server: announcements notify the family; admin endpoints are owner-only', async () => {
  const server = await startServer();
  try {
    const admin = await registerOrLogin(server, 'owner@example.com');
    const a = (await registerOrLogin(server, uniq('a7@ohana.test'))).token;

    const denied = await req(server, 'GET', '/api/ohana/admin/overview', a);
    assert.equal(denied.status, 403);

    const ann = await req(server, 'POST', '/api/ohana/admin/announcements', admin.token, { text: 'Welcome to the family!' });
    assert.equal(ann.status, 200);

    const boot = await req(server, 'GET', '/api/ohana/bootstrap', a);
    assert.ok(boot.body.announcements.some(x => x.text === 'Welcome to the family!'));
    assert.ok(boot.body.unread >= 1);
  } finally { server.close(); }
});
