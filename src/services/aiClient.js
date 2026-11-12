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
  return 502;
}

function providers() {
  const list = [];
  if (config.aiApiKey) {
    list.push({ name: 'primary', baseUrl: config.aiBaseUrl, apiKey: config.aiApiKey, model: config.aiModel });
  }
  if (config.aiFallbackApiKey) {
    list.push({
      name: 'fallback',
      baseUrl: config.aiFallbackBaseUrl || config.aiBaseUrl,
      apiKey: config.aiFallbackApiKey,
      model: config.aiFallbackModel || config.aiModel
    });
  }
  return list;
}

async function chatWithProvider(provider, { messages, stream = false, temperature }) {
  let response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream,
        ...(temperature !== undefined ? { temperature } : {})
      })
    });
  } catch (err) {
    console.error(`[aiClient] provider "${provider.name}" (${provider.model}): network error - ${err.message}`);
    throw new ApiError(502, 'Could not reach the AI provider. Please try again.', err);
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch (_) {}
    console.error(
      `[aiClient] provider "${provider.name}" (${provider.model}) failed: HTTP ${response.status} ${detail}`
    );
    let reason = '';
    try {
      const parsed = JSON.parse(detail);
      const upstreamMessage = parsed && parsed.error && parsed.error.message;
      if (typeof upstreamMessage === 'string') reason = upstreamMessage.slice(0, 200);
    } catch (_) {
      reason = detail.slice(0, 200);
    }
    const suffix = reason ? ` Provider said: ${reason}` : '';
    throw new ApiError(
      mapUpstreamStatus(response.status),
      `The AI provider returned an error (HTTP ${response.status}). Please try again or check your AI provider settings.${suffix}`,
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

async function chatCompletion(options) {
  const list = providers();
  if (!list.length) {
    const err = new ApiError(
      503,
      'The AI provider is not configured yet. Add AI_API_KEY to your .env file and restart the server.'
    );
    err.expected = true;
    throw err;
  }

  let lastError;
  for (const provider of list) {
    try {
      return await chatWithProvider(provider, options);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

module.exports = { chatCompletion, ApiError };
