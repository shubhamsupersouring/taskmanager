const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const appConfig = require('./config/app');
const { checkConnection } = require('./db/connection');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger');
const v1Routes = require('./routes/v1');

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await checkConnection();
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbStatus ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/v1', v1Routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: `Welcome to ${appConfig.appName}`,
    version: '1.0.0',
    documentation: `${appConfig.appUrl}/api/v1`
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

module.exports = app;

