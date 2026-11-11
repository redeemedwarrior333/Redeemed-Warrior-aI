const config = require('../config');

const conversations = new Map();

const MAX_CONVERSATIONS = 1000;

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim()
    )
    .map((m) => ({ role: m.role, content: m.content }));
}

function get(conversationId) {
  return conversations.get(conversationId) || null;
}

function save(conversationId, messages) {
  if (conversations.size >= MAX_CONVERSATIONS && !conversations.has(conversationId)) {
    const oldest = conversations.keys().next().value;
    conversations.delete(oldest);
  }
  conversations.set(conversationId, {
    messages: sanitizeMessages(messages),
    updatedAt: Date.now()
  });
}

module.exports = { conversations, sanitizeMessages, get, save };
