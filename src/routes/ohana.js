const express = require('express');

const members = require('../services/members');

const router = express.Router();

const profiles = new Map();
const posts = [];
const prayers = [];
const circleMembers = new Map();
const events = [];
const dms = new Map();
const blocks = new Map();
const reports = [];
const announcements = [];
const notifications = new Map();
const premium = new Set();
const rsvps = new Map();
const liveRooms = [];

const REACTIONS = ['love', 'praying', 'here', 'celebrating', 'amen'];

const CIRCLE_SEEDS = [
  { id: 'women-bible', name: 'Women of the Bible', desc: 'Learn from the women who walked before us.', premium: false },
  { id: 'healing', name: 'Healing After the Hurt', desc: 'A gentle circle for wounded hearts.', premium: false },
  { id: 'faith', name: 'Faith and Encouragement', desc: 'Everyday faith, shared out loud.', premium: false },
  { id: 'motherhood', name: 'Christian Motherhood', desc: 'Raising little hearts with grace.', premium: false },
  { id: 'marriage', name: 'Marriage and Relationships', desc: 'Love that lasts, built on faith.', premium: false },
  { id: 'business', name: 'Business and Entrepreneurship', desc: 'Kingdom dreams and honest work.', premium: false },
  { id: 'creator', name: 'Creator Support', desc: 'Writers, makers and artists uplifting each other.', premium: false },
  { id: 'prayer-warriors', name: 'Prayer Warriors', desc: 'Standing in the gap for one another.', premium: false },
  { id: 'single-faith', name: 'Single Women of Faith', desc: 'Whole, hopeful and held by God.', premium: false },
  { id: 'growth', name: 'Personal Growth and Purpose', desc: 'Becoming who God made you to be.', premium: false }
];

const circles = CIRCLE_SEEDS.map(c => ({ ...c, createdAt: Date.now() }));

CIRCLE_SEEDS.forEach(c => circleMembers.set(c.id, new Set()));

function clean(text, max) {
  return String(text || '').trim().slice(0, max);
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const member = members.memberForToken(token);
  if (!member) return res.status(401).json({ error: { message: 'Please sign in to enter Ohana.' } });
  req.member = member;
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  req.member = members.memberForToken(token);
  next();
}

function isOwner(member) {
  return members.isOwner(member);
}

function nameOf(memberId) {
  const p = profiles.get(memberId);
  if (p && p.displayName) return p.displayName;
  const m = members.get(memberId);
  if (!m) return 'Ohana Sister';
  return m.email.split('@')[0];
}

function notify(memberId, kind, text) {
  if (!notifications.has(memberId)) notifications.set(memberId, []);
  const list = notifications.get(memberId);
  list.unshift({ id: Math.random().toString(36).slice(2), kind, text, at: Date.now(), read: false });
  if (list.length > 100) list.length = 100;
}

function publicProfile(memberId) {
  const p = profiles.get(memberId) || {};
  const m = members.get(memberId);
  return {
    memberId,
    displayName: p.displayName || (m ? m.email.split('@')[0] : 'Ohana Sister'),
    intro: p.intro || '',
    verse: p.verse || '',
    interests: p.interests || '',
    photo: p.photo || '',
    joinedAt: m ? m.createdAt : Date.now(),
    premium: premium.has(memberId),
    circles: [...circleMembers.entries()].filter(([, set]) => set.has(memberId)).map(([id]) => id)
  };
}

function postOut(post) {
  return {
    id: post.id,
    memberId: post.memberId,
    name: nameOf(post.memberId),
    text: post.text,
    image: post.image || '',
    kind: post.kind,
    circleId: post.circleId || null,
    createdAt: post.createdAt,
    reactions: Object.fromEntries(REACTIONS.map(r => [r, post.reactions[r].size])),
    comments: post.comments.map(c => ({ id: c.id, name: nameOf(c.memberId), text: c.text, at: c.at }))
  };
}

router.use(optionalAuth);

router.get('/bootstrap', auth, (req, res) => {
  res.json({
    profile: publicProfile(req.member.memberId),
    membership: { level: premium.has(req.member.memberId) ? 'premium' : 'free', owner: isOwner(req.member) },
    circles: circles.map(c => ({ ...c, members: circleMembers.get(c.id).size, joined: circleMembers.get(c.id).has(req.member.memberId) })),
    announcements: announcements.slice(0, 10),
    live: liveRooms.filter(r => !r.endedAt).map(r => ({ id: r.id, title: r.title, hostName: nameOf(r.host), room: r.room, startedAt: r.startedAt, here: liveHereCount(r) })),
    unread: (notifications.get(req.member.memberId) || []).filter(n => !n.read).length
  });
});

router.put('/profile', auth, (req, res) => {
  const body = req.body || {};
  const p = profiles.get(req.member.memberId) || {};
  p.displayName = clean(body.displayName, 40);
  p.intro = clean(body.intro, 400);
  p.verse = clean(body.verse, 200);
  p.interests = clean(body.interests, 200);
  if (body.photo !== undefined) {
    if (body.photo && String(body.photo).length > 900000) {
      return res.status(413).json({ error: { message: 'That photo is too large. Please choose a smaller one.' } });
    }
    p.photo = body.photo ? String(body.photo) : '';
  }
  profiles.set(req.member.memberId, p);
  res.json({ profile: publicProfile(req.member.memberId) });
});

router.get('/directory', auth, (req, res) => {
  const q = clean(req.query.search, 40).toLowerCase();
  const list = [...profiles.keys()].map(publicProfile)
    .filter(p => !q || p.displayName.toLowerCase().includes(q) || p.interests.toLowerCase().includes(q));
  res.json({ members: list.slice(0, 100) });
});

router.get('/wall', auth, (req, res) => {
  const circleId = clean(req.query.circle, 40);
  const kind = clean(req.query.kind, 20);
  let list = posts.filter(p => !p.hidden);
  if (circleId) list = list.filter(p => p.circleId === circleId);
  if (kind) list = list.filter(p => p.kind === kind);
  res.json({ posts: list.slice(-100).reverse().map(postOut) });
});

router.post('/wall', auth, (req, res) => {
  const body = req.body || {};
  const text = clean(body.text, 4000);
  const kind = ['post', 'testimony', 'praise'].includes(body.kind) ? body.kind : 'post';
  const circleId = clean(body.circleId, 40) || null;
  if (!text && !body.image) return res.status(400).json({ error: { message: 'Write a little something first, sister.' } });
  if (body.image && String(body.image).length > 900000) {
    return res.status(413).json({ error: { message: 'That picture is too large. Please choose a smaller one.' } });
  }
  if (circleId && !circleMembers.get(circleId)) return res.status(400).json({ error: { message: 'That circle does not exist.' } });
  const post = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    memberId: req.member.memberId,
    text,
    image: body.image ? String(body.image) : '',
    kind,
    circleId,
    createdAt: Date.now(),
    hidden: false,
    reactions: Object.fromEntries(REACTIONS.map(r => [r, new Set()])),
    comments: []
  };
  posts.push(post);
  if (posts.length > 2000) posts.shift();
  res.json({ post: postOut(post) });
});

router.post('/posts/:id/react', auth, (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: { message: 'That post is no longer here.' } });
  const reaction = String((req.body || {}).reaction || '');
  if (!REACTIONS.includes(reaction)) return res.status(400).json({ error: { message: 'Unknown reaction.' } });
  const set = post.reactions[reaction];
  const me = req.member.memberId;
  if (set.has(me)) set.delete(me);
  else {
    set.add(me);
    if (post.memberId !== me) notify(post.memberId, 'reaction', nameOf(me) + ' reacted to your post');
  }
  res.json({ reactions: Object.fromEntries(REACTIONS.map(r => [r, post.reactions[r].size])) });
});

router.post('/posts/:id/comments', auth, (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: { message: 'That post is no longer here.' } });
  const text = clean((req.body || {}).text, 1000);
  if (!text) return res.status(400).json({ error: { message: 'Write a comment first, sister.' } });
  post.comments.push({ id: Math.random().toString(36).slice(2), memberId: req.member.memberId, text, at: Date.now() });
  if (post.memberId !== req.member.memberId) notify(post.memberId, 'comment', nameOf(req.member.memberId) + ' commented on your post');
  res.json({ comments: post.comments.map(c => ({ id: c.id, name: nameOf(c.memberId), text: c.text, at: c.at })) });
});

router.delete('/posts/:id', auth, (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: { message: 'That post is no longer here.' } });
  if (post.memberId !== req.member.memberId && !isOwner(req.member)) {
    return res.status(403).json({ error: { message: 'Only the author or the family admin can remove a post.' } });
  }
  post.hidden = true;
  res.json({ ok: true });
});

router.get('/prayers', auth, (req, res) => {
  res.json({
    prayers: prayers.filter(p => !p.hidden).slice(-100).reverse().map(p => ({
      id: p.id,
      name: nameOf(p.memberId),
      text: p.text,
      answered: p.answered,
      praise: p.praise || '',
      prayerCount: p.prayedBy.size,
      mine: p.memberId === req.member.memberId,
      prayed: p.prayedBy.has(req.member.memberId),
      at: p.at
    }))
  });
});

router.post('/prayers', auth, (req, res) => {
  const text = clean((req.body || {}).text, 2000);
  if (!text) return res.status(400).json({ error: { message: 'Write your prayer request first, sister.' } });
  const prayer = {
    id: Math.random().toString(36).slice(2),
    memberId: req.member.memberId,
    text,
    answered: false,
    praise: '',
    prayedBy: new Set(),
    hidden: false,
    at: Date.now()
  };
  prayers.push(prayer);
  if (prayers.length > 2000) prayers.shift();
  res.json({ ok: true });
});

router.post('/prayers/:id/prayed', auth, (req, res) => {
  const prayer = prayers.find(p => p.id === req.params.id);
  if (!prayer) return res.status(404).json({ error: { message: 'That prayer request is no longer here.' } });
  const me = req.member.memberId;
  if (prayer.memberId !== me && !prayer.prayedBy.has(me)) {
    prayer.prayedBy.add(me);
    notify(prayer.memberId, 'prayer', nameOf(me) + ' prayed for your request');
  }
  res.json({ prayerCount: prayer.prayedBy.size });
});

router.post('/prayers/:id/answer', auth, (req, res) => {
  const prayer = prayers.find(p => p.id === req.params.id);
  if (!prayer) return res.status(404).json({ error: { message: 'That prayer request is no longer here.' } });
  if (prayer.memberId !== req.member.memberId) {
    return res.status(403).json({ error: { message: 'Only the sister who asked can mark it answered.' } });
  }
  prayer.answered = true;
  prayer.praise = clean((req.body || {}).praise, 1000);
  res.json({ ok: true });
});

router.get('/circles', auth, (req, res) => {
  res.json({
    circles: circles.map(c => ({ ...c, members: circleMembers.get(c.id) ? circleMembers.get(c.id).size : 0, joined: circleMembers.get(c.id) ? circleMembers.get(c.id).has(req.member.memberId) : false }))
  });
});

router.post('/circles/:id/join', auth, (req, res) => {
  const circle = circles.find(c => c.id === req.params.id);
  if (!circle) return res.status(404).json({ error: { message: 'That circle does not exist.' } });
  if (circle.premium && !premium.has(req.member.memberId) && !isOwner(req.member)) {
    return res.status(403).json({ error: { message: 'This is a Premium circle. Visit Membership to learn more.' } });
  }
  circleMembers.get(circle.id).add(req.member.memberId);
  res.json({ ok: true });
});

router.post('/circles/:id/leave', auth, (req, res) => {
  const set = circleMembers.get(req.params.id);
  if (set) set.delete(req.member.memberId);
  res.json({ ok: true });
});

router.get('/events', auth, (req, res) => {
  res.json({
    events: events.slice().reverse().map(e => ({
      id: e.id, title: e.title, desc: e.desc, when: e.when, link: e.link || '',
      rsvpCount: rsvps.get(e.id) ? rsvps.get(e.id).size : 0,
      rsvped: rsvps.get(e.id) ? rsvps.get(e.id).has(req.member.memberId) : false
    }))
  });
});

router.post('/events', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Only the family admin can create events.' } });
  const body = req.body || {};
  const title = clean(body.title, 120);
  if (!title) return res.status(400).json({ error: { message: 'Give the event a title first.' } });
  const event = { id: Math.random().toString(36).slice(2), title, desc: clean(body.desc, 2000), when: clean(body.when, 40), link: clean(body.link, 300), createdAt: Date.now() };
  events.push(event);
  rsvps.set(event.id, new Set());
  res.json({ event });
});

router.post('/events/:id/rsvp', auth, (req, res) => {
  const event = events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: { message: 'That event is no longer on the calendar.' } });
  if (!rsvps.has(event.id)) rsvps.set(event.id, new Set());
  const set = rsvps.get(event.id);
  const me = req.member.memberId;
  if (set.has(me)) set.delete(me); else set.add(me);
  res.json({ rsvpCount: set.size, rsvped: set.has(me) });
});

router.get('/conversations', auth, (req, res) => {
  const me = req.member.memberId;
  const list = [];
  for (const [key, msgs] of dms) {
    const ids = key.split('|');
    if (!ids.includes(me) || msgs.length === 0) continue;
    const other = ids.find(id => id !== me);
    const last = msgs[msgs.length - 1];
    list.push({ memberId: other, name: nameOf(other), last: last.text.slice(0, 80), at: last.at });
  }
  list.sort((a, b) => b.at - a.at);
  res.json({ conversations: list });
});

router.get('/messages/:memberId', auth, (req, res) => {
  const me = req.member.memberId;
  const other = String(req.params.memberId || '');
  if (!members.get(other)) return res.status(404).json({ error: { message: 'That sister is not part of Ohana.' } });
  if ((blocks.get(other) || new Set()).has(me)) return res.status(403).json({ error: { message: 'You cannot message this sister right now.' } });
  const key = [me, other].sort().join('|');
  res.json({
    messages: (dms.get(key) || []).filter(m => !m.hidden).map(m => ({ id: m.id, mine: m.from === me, text: m.text, at: m.at })),
    name: nameOf(other)
  });
});

router.post('/messages/:memberId', auth, (req, res) => {
  const me = req.member.memberId;
  const other = String(req.params.memberId || '');
  if (!members.get(other)) return res.status(404).json({ error: { message: 'That sister is not part of Ohana.' } });
  if (other === me) return res.status(400).json({ error: { message: 'You cannot message yourself, sister.' } });
  if ((blocks.get(other) || new Set()).has(me)) return res.status(403).json({ error: { message: 'You cannot message this sister right now.' } });
  const text = clean((req.body || {}).text, 2000);
  if (!text) return res.status(400).json({ error: { message: 'Write your message first.' } });
  const key = [me, other].sort().join('|');
  if (!dms.has(key)) dms.set(key, []);
  dms.get(key).push({ id: Math.random().toString(36).slice(2), from: me, to: other, text, at: Date.now(), hidden: false });
  notify(other, 'message', nameOf(me) + ' sent you a message');
  res.json({ ok: true });
});

router.post('/block/:memberId', auth, (req, res) => {
  const me = req.member.memberId;
  if (!blocks.has(me)) blocks.set(me, new Set());
  blocks.get(me).add(String(req.params.memberId || ''));
  res.json({ ok: true });
});

router.post('/report', auth, (req, res) => {
  const body = req.body || {};
  reports.push({
    id: Math.random().toString(36).slice(2),
    by: req.member.memberId,
    targetType: clean(body.targetType, 20),
    targetId: clean(body.targetId, 60),
    reason: clean(body.reason, 500),
    resolved: false,
    at: Date.now()
  });
  res.json({ ok: true, message: 'Thank you, sister. The family admin will review this with care.' });
});

router.get('/notifications', auth, (req, res) => {
  res.json({ notifications: (notifications.get(req.member.memberId) || []).slice(0, 50) });
});

router.post('/notifications/read', auth, (req, res) => {
  const list = notifications.get(req.member.memberId) || [];
  list.forEach(n => { n.read = true; });
  res.json({ ok: true });
});

router.get('/admin/overview', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Family admin only.' } });
  res.json({
    members: members.members.size,
    posts: posts.filter(p => !p.hidden).length,
    prayers: prayers.filter(p => !p.hidden).length,
    circles: circles.length,
    events: events.length,
    premium: premium.size,
    reports: reports.filter(r => !r.resolved).map(r => ({ id: r.id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, at: r.at }))
  });
});

router.post('/admin/announcements', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Family admin only.' } });
  const text = clean((req.body || {}).text, 1000);
  if (!text) return res.status(400).json({ error: { message: 'Write the announcement first.' } });
  const a = { id: Math.random().toString(36).slice(2), text, at: Date.now() };
  announcements.unshift(a);
  if (announcements.length > 50) announcements.length = 50;
  for (const memberId of members.members.keys()) {
    const m = members.members.get(memberId);
    notify(m.memberId, 'announcement', 'Family announcement: ' + text.slice(0, 80));
  }
  res.json({ announcement: a });
});

router.post('/admin/grant-premium', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Family admin only.' } });
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const target = members.members.get(email);
  if (!target) return res.status(404).json({ error: { message: 'No Ohana member found with that email.' } });
  premium.add(target.memberId);
  notify(target.memberId, 'membership', 'Welcome to Premium Ohana Family, sister!');
  res.json({ ok: true, email });
});

router.post('/admin/circles', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Family admin only.' } });
  const body = req.body || {};
  const name = clean(body.name, 60);
  if (!name) return res.status(400).json({ error: { message: 'Give the circle a name first.' } });
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  circles.push({ id, name, desc: clean(body.desc, 200), premium: body.premium === true, createdAt: Date.now() });
  circleMembers.set(id, new Set());
  res.json({ ok: true, id });
});

router.delete('/admin/reports/:id', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Family admin only.' } });
  const r = reports.find(x => x.id === req.params.id);
  if (r) r.resolved = true;
  res.json({ ok: true });
});

const LIVE_PRESENCE_MS = 65000;

function liveHereCount(room) {
  const now = Date.now();
  let n = 0;
  for (const [, ts] of room.presence) if (now - ts < LIVE_PRESENCE_MS) n++;
  return n;
}

function liveOut(room) {
  return {
    id: room.id,
    title: room.title,
    host: room.host,
    hostName: nameOf(room.host),
    room: room.room,
    startedAt: room.startedAt,
    endedAt: room.endedAt || null,
    here: liveHereCount(room),
    mine: room.host === (room._viewerId || '')
  };
}

router.get('/live', auth, (req, res) => {
  const active = liveRooms.filter(r => !r.endedAt).slice(-5).reverse();
  res.json({ rooms: active.map(r => liveOut({ ...r, _viewerId: req.member.memberId })) });
});

router.post('/live', auth, (req, res) => {
  if (!isOwner(req.member)) return res.status(403).json({ error: { message: 'Only the family admin can start a live gathering.' } });
  const title = clean((req.body || {}).title, 80) || 'Ohana Live Gathering';
  if (liveRooms.filter(r => !r.endedAt).length >= 3) {
    return res.status(400).json({ error: { message: 'A live gathering is already running. Please end it first.' } });
  }
  const id = 'live' + Math.random().toString(36).slice(2, 8);
  const room = { id, title, host: req.member.memberId, room: 'RWOhana-' + id + '-' + Math.random().toString(36).slice(2, 6), startedAt: Date.now(), endedAt: null, presence: new Map() };
  room.presence.set(req.member.memberId, Date.now());
  liveRooms.push(room);
  if (liveRooms.length > 50) liveRooms.shift();
  for (const memberId of members.members.keys()) {
    if (memberId !== req.member.memberId) notify(memberId, 'live', '\ud83d\udd34 Live now: ' + title + ' \u2014 ' + nameOf(req.member.memberId) + ' is gathering the family.');
  }
  res.json({ room: liveOut({ ...room, _viewerId: req.member.memberId }) });
});

router.post('/live/:id/heartbeat', auth, (req, res) => {
  const room = liveRooms.find(r => r.id === req.params.id && !r.endedAt);
  if (!room) return res.status(404).json({ error: { message: 'This live gathering has ended.' } });
  room.presence.set(req.member.memberId, Date.now());
  res.json({ here: liveHereCount(room) });
});

router.post('/live/:id/end', auth, (req, res) => {
  const room = liveRooms.find(r => r.id === req.params.id && !r.endedAt);
  if (!room) return res.status(404).json({ error: { message: 'This live gathering has already ended.' } });
  if (room.host !== req.member.memberId && !isOwner(req.member)) return res.status(403).json({ error: { message: 'Only the host can end this gathering.' } });
  room.endedAt = Date.now();
  res.json({ ok: true });
});

module.exports = router;
module.exports._internal = { posts, prayers, circles, circleMembers, events, dms, reports, announcements, notifications, premium, rsvps, profiles, liveRooms, REACTIONS };
