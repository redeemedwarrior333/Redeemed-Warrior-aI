const express = require('express');

const config = require('../config');
const stripeClient = require('../services/stripeClient');
const { StripeError } = require('../services/stripeClient');

const router = express.Router();

const createdLinks = new Map();

async function fetchStoreProducts() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.storeTimeoutMs);
  let response;
  try {
    response = await fetch(
      `${config.rwStoreBaseUrl}/api/collections/products/records?perPage=200&sort=-updated`,
      { signal: controller.signal }
    );
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new StripeError(504, 'The Store took too long to answer. Please try again in a moment.');
    }
    throw new StripeError(502, 'Could not reach the Store to read your products. Please try again in a moment.', err);
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.items)) {
    throw new StripeError(502, `Could not read products from the Store (HTTP ${response.status}).`);
  }
  return data.items;
}

function shapeProduct(p) {
  const price = Number(p.price) || 0;
  return {
    id: p.id,
    title: p.title || 'Untitled product',
    category: p.category || '',
    price,
    published: Boolean(p.published),
    isApp: p.category === 'Apps & Software',
    checkoutUrl: p.checkoutUrl || '',
    needsLink: !p.checkoutUrl && price >= 0.5,
    free: price > 0 && price < 0.5 ? false : price === 0
  };
}

router.get('/products', async (req, res, next) => {
  try {
    const items = await fetchStoreProducts();
    res.json({
      products: items.map(shapeProduct),
      stripeConnected: Boolean(config.stripeSecretKey)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/create-link', async (req, res, next) => {
  try {
    const productId = req.body && typeof req.body.productId === 'string' ? req.body.productId : '';
    if (!productId) {
      return res.status(400).json({ error: { message: 'Which product? Send productId.' } });
    }

    const items = await fetchStoreProducts();
    const product = items.find((p) => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: { message: 'That product was not found in the Store.' } });
    }

    if (product.checkoutUrl) {
      return res.json({
        alreadyHadLink: true,
        url: product.checkoutUrl,
        title: product.title,
        message: 'This product already has a payment link.'
      });
    }

    const link = await stripeClient.createPaymentLink({
      name: product.title,
      description: product.description,
      price: product.price
    });

    createdLinks.set(productId, {
      url: link.url,
      title: product.title,
      price: Number(product.price) || 0,
      createdAt: Date.now()
    });

    res.json({
      created: true,
      url: link.url,
      title: product.title,
      price: Number(product.price),
      message: 'Payment link created! Copy it into the product\'s checkout/pay-link field in the Store.'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/created', (req, res) => {
  res.json({
    links: Array.from(createdLinks.entries()).map(([productId, l]) => ({ productId, ...l }))
  });
});

router.use((err, req, res, next) => {
  if (err instanceof StripeError) {
    return res.status(err.status).json({ error: { message: err.publicMessage } });
  }
  next(err);
});

module.exports = router;
