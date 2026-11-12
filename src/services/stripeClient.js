const config = require('../config');

class StripeError extends Error {
  constructor(status, publicMessage, cause) {
    super(publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
    this.cause = cause;
  }
}

function requireStripeConfig() {
  if (!config.stripeSecretKey) {
    const err = new StripeError(
      503,
      'Stripe is not connected yet. Add STRIPE_SECRET_KEY to the server environment and restart.'
    );
    err.expected = true;
    throw err;
  }
}

async function stripeRequest(path, params) {
  requireStripeConfig();

  const body = new URLSearchParams(params).toString();
  let response;
  try {
    response = await fetch(`https://api.stripe.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      signal: AbortSignal.timeout(config.storeTimeoutMs)
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new StripeError(504, 'Stripe took too long to answer. Please try again in a moment.');
    }
    throw new StripeError(502, 'Could not reach Stripe. Please try again in a moment.', err);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data && data.error && data.error.message
      ? `Stripe said: ${data.error.message}`
      : `Stripe returned an error (HTTP ${response.status}).`;
    throw new StripeError(response.status === 401 ? 502 : 502, message);
  }

  return data;
}

async function createPaymentLink({ name, description, price, currency = 'usd' }) {
  const cents = Math.round(Number(price) * 100);
  if (!Number.isFinite(cents) || cents < 50) {
    throw new StripeError(
      400,
      'Stripe requires a price of at least $0.50. Free products do not need a payment link.'
    );
  }

  const productParams = { name: String(name).slice(0, 200) };
  if (description) productParams.description = String(description).slice(0, 400);
  const product = await stripeRequest('/products', productParams);

  const priceObj = await stripeRequest('/prices', {
    product: product.id,
    unit_amount: cents,
    currency
  });

  const link = await stripeRequest('/payment_links', {
    'line_items[0][price]': priceObj.id,
    'line_items[0][quantity]': 1
  });

  return {
    url: link.url,
    stripeProductId: product.id,
    stripePriceId: priceObj.id
  };
}

module.exports = { createPaymentLink, StripeError };
