const express = require('express');
const cors = require('cors');

const config = require('./config');
const requireApiKey = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errors');
const healthRoutes = require('./routes/health');
const chatRoutes = require('./routes/chat');
const appsRoutes = require('./routes/apps');

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

app.use('/health', healthRoutes);
app.use('/api/chat', requireApiKey, chatRoutes);
app.use('/api/apps', requireApiKey, appsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
