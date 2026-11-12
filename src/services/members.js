const crypto = require('crypto');

const config = require('../config');

const members = new Map();
const tokens = new Map();
const resetRequests = new Map();

const MAX_MEMBERS = 10000;

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function newSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function register(email, password) {
  const key = normalizeEmail(email);
  if (!validEmail(key)) return { error: 'Please enter a valid email address.' };
  if (!password || String(password).length < 8) {
    return { error: 'Please choose a password with at least 8 characters.' };
  }
  if (members.has(key)) return { error: 'An account with this email already exists. Try logging in instead.' };
  if (members.size >= MAX_MEMBERS) return { error: 'The platform is at capacity right now. Please try again later.' };

  const salt = newSalt();
  const member = {
    memberId: crypto.randomUUID(),
    email: key,
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: Date.now()
  };
  members.set(key, member);
  return { member };
}

function login(email, password) {
  const key = normalizeEmail(email);
  const member = members.get(key);
  if (!member) return { error: 'No account found with that email. You can create one in seconds.' };
  const candidate = hashPassword(password, member.salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(member.passwordHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { error: 'That password does not match. Please try again.' };
  }
  return { member };
}

function issueToken(member) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { memberId: member.memberId, issuedAt: Date.now() });
  if (tokens.size > 50000) {
    const oldest = tokens.keys().next().value;
    tokens.delete(oldest);
  }
  return token;
}

function memberForToken(token) {
  const entry = tokens.get(String(token || ''));
  if (!entry) return null;
  for (const member of members.values()) {
    if (member.memberId === entry.memberId) return member;
  }
  return null;
}

function requestReset(email) {
  const key = normalizeEmail(email);
  const member = members.get(key);
  if (!member) return null;
  for (const existing of resetRequests.values()) {
    if (existing.memberId === member.memberId) return existing;
  }
  if (resetRequests.size >= 500) return null;
  const request = {
    id: crypto.randomUUID(),
    email: key,
    memberId: member.memberId,
    requestedAt: Date.now()
  };
  resetRequests.set(request.id, request);
  return request;
}

function listResetRequests() {
  return [...resetRequests.values()].sort((a, b) => a.requestedAt - b.requestedAt);
}

function resolveResetRequest(id) {
  const request = resetRequests.get(String(id || ''));
  if (!request) return null;
  const member = get(request.memberId);
  resetRequests.delete(request.id);
  if (!member) return null;
  const tempPassword = crypto.randomBytes(9).toString('base64url').slice(0, 10);
  const salt = newSalt();
  member.salt = salt;
  member.passwordHash = hashPassword(tempPassword, salt);
  return { request, tempPassword };
}

function changePassword(memberId, currentPassword, newPassword) {
  const member = get(memberId);
  if (!member) return { error: 'Please sign in again.' };
  const candidate = hashPassword(currentPassword, member.salt);
  const a = Buffer.from(candidate);
  const b = Buffer.from(member.passwordHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { error: 'Your current password does not match.' };
  }
  if (!newPassword || String(newPassword).length < 8) {
    return { error: 'Please choose a new password with at least 8 characters.' };
  }
  const salt = newSalt();
  member.salt = salt;
  member.passwordHash = hashPassword(newPassword, salt);
  return { ok: true };
}

function isOwner(member) {
  if (!member || !member.email) return false;
  return config.ownerEmails.has(normalizeEmail(member.email));
}

function get(memberId) {
  for (const member of members.values()) {
    if (member.memberId === memberId) return member;
  }
  return null;
}

module.exports = { members, tokens, resetRequests, register, login, issueToken, memberForToken, isOwner, requestReset, listResetRequests, resolveResetRequest, changePassword, get };
