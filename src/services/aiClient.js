const config = require('../config');

class ApiError extends Error {
  constructor(status, publicMessage, cause) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.cause = cause;
  }
}

function mapUpstreamStatus(status) {
  if (status === 401 || status === 403) return 502;
  if (status === 429) return 429;
  if (status >= 500) return 502;
  return 502;
}

async function chatCompletion({ messages, stream = false, temperature }) {
  if (!config.aiApiKey) {
    const err = new ApiError(
      503,
      'The AI provider is not configured yet. Add AI_API_KEY to your .env file and restart the server.'
    );
    err.expected = true;
    throw err;
  }

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
        messages,
        stream,
        ...(temperature !== undefined ? { temperature } : {})
      })
    });
  } catch (err) {
    throw new ApiError(502, 'Could not reach the AI provider. Please try again.', err);
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch (_) {}
    throw new ApiError(
      mapUpstreamStatus(response.status),
      `The AI provider returned an error (HTTP ${response.status}). Please try again or check your AI provider settings.`,
      detail
    );
  }

  if (!stream) {
    const data = await response.json();
    const choice = data && data.choices && data.choices[0];
    const message = choice && choice.message;
    if (!message || typeof message.content !== 'string') {
      throw new ApiError(502, 'The AI provider returned an unexpected response. Please try again.');
    }
    return {
      role: 'assistant',
      content: message.content,
      usage: data.usage || null
    };
  }

  return response.body;
}

module.exports = { chatCompletion, ApiError };
