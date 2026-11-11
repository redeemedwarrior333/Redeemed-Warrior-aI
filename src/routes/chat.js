const crypto = require('crypto');
const { Readable } = require('stream');

const express = require('express');

const config = require('../config');
const { chatCompletion } = require('../services/aiClient');
const conversations = require('../services/conversations');
const { getSystemPrompt } = require('../systemPrompt');

const router = express.Router();

function buildAiMessages(history) {
  const trimmed = history.slice(-config.maxHistoryMessages);
  return [{ role: 'system', content: getSystemPrompt() }, ...trimmed];
}

function collectHistory(body) {
  const { message, messages, conversationId } = body || {};
  let history = [];
  let convId = typeof conversationId === 'string' && conversationId ? conversationId : null;

  if (Array.isArray(messages)) {
    history = conversations.sanitizeMessages(messages);
    if (convId) {
      const saved = conversations.get(convId);
      if (saved) history = saved.messages.concat(history);
    }
  } else if (typeof message === 'string' && message.trim()) {
    if (convId) {
      const saved = conversations.get(convId);
      if (saved) history = saved.messages.slice();
    }
    history.push({ role: 'user', content: message.trim() });
  } else {
    return null;
  }

  if (!convId) convId = crypto.randomUUID();
  return { history, convId };
}

router.post('/', async (req, res, next) => {
  try {
    const collected = collectHistory(req.body);
    if (!collected) {
      return res.status(400).json({
        error: {
          message:
            'Please send either a "message" (string) or a "messages" array. Example: { "message": "Hello!" }'
        }
      });
    }

    const { history, convId } = collected;
    const stream = Boolean(req.body && req.body.stream);
    const aiMessages = buildAiMessages(history);

    if (stream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);

      const upstream = await chatCompletion({ messages: aiMessages, stream: true });
      const nodeStream = Readable.fromWeb(upstream);
      let assistantText = '';

      nodeStream.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const delta =
              parsed &&
              parsed.choices &&
              parsed.choices[0] &&
              parsed.choices[0].delta &&
              parsed.choices[0].delta.content;
            if (typeof delta === 'string' && delta) {
              assistantText += delta;
              res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
          } catch (_) {}
        }
      });

      nodeStream.on('end', () => {
        const full = [
          ...history,
          ...(assistantText ? [{ role: 'assistant', content: assistantText }] : [])
        ];
        conversations.save(convId, full);
        res.write('data: [DONE]\n\n');
        res.end();
      });

      nodeStream.on('error', (err) => {
        console.error(err);
        res.write(`data: ${JSON.stringify({ error: 'The AI stream was interrupted. Please try again.' })}\n\n`);
        res.end();
      });

      req.on('close', () => {
        nodeStream.destroy();
      });

      return;
    }

    const reply = await chatCompletion({ messages: aiMessages });
    conversations.save(convId, [...history, reply]);
    res.json({
      conversationId: convId,
      reply: reply.content,
      model: config.aiModel,
      usage: reply.usage
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:conversationId', (req, res) => {
  const saved = conversations.get(req.params.conversationId);
  if (!saved) {
    return res.status(404).json({
      error: { message: 'Conversation not found. It may have expired or never existed.' }
    });
  }
  res.json({ conversationId: req.params.conversationId, messages: saved.messages });
});

module.exports = router;
