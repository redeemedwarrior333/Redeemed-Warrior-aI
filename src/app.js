const express = require('express');
const cors = require('cors');

const config = require('./config');
const requireApiKey = require('./middleware/auth');
const { requireApiKeyStrict } = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errors');
const healthRoutes = require('./routes/health');
const chatRoutes = require('./routes/chat');
const aiStatusRoutes = require('./routes/aiStatus');
const appsRoutes = require('./routes/apps');
const pagesRoutes = require('./routes/pages');
const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/store');
const ownerRoutes = require('./routes/owner');
const autopilotRoutes = require('./routes/autopilot');
const uploadsRoutes = require('./routes/uploads');

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit);

app.use('/health', healthRoutes);
app.use('/', pagesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/chat', requireApiKey, chatRoutes);
app.use('/api/ai-status', aiStatusRoutes);
app.use('/api/apps', requireApiKey, appsRoutes);
app.use('/api/autopilot', requireApiKeyStrict, autopilotRoutes);
app.use('/api/uploads', uploadsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
