const http = require('http');
const app = require('./src/index');
const appConfig = require('./src/config/app');
const envConfig = require('./src/config/appsettings-loader');
const logger = require('./src/utils/logger');
const { checkConnection, closeConnection } = require('./src/db/connection');
const { attach: attachSocket } = require('./src/socket');

// Start server
const startServer = async () => {
  try {
    // Check database connection (non-blocking - server will start anyway)
    // Wrap in try-catch to prevent any uncaught exceptions
    (async () => {
      try {
        const dbConnected = await checkConnection();
        if (!dbConnected) {
          logger.warn('⚠️  Database connection failed. Server is running but database operations may fail.');
          logger.warn(`⚠️  Please check your database configuration in appsettings.${envConfig.env}.json file`);
          logger.warn(`⚠️  Current environment: ${envConfig.env}`);
          logger.warn('⚠️  Set ENVIRONMENT variable to: development, staging, or production');
        }
      } catch (err) {
        // Silently handle - don't crash the app
        logger.warn('⚠️  Could not verify database connection:', err.message);
      }
    })();

    // Create HTTP server and attach Socket.IO (so /socket.io/ is served)
    const server = http.createServer(app);
    attachSocket(server);

    server.listen(appConfig.port, () => {
      logger.info(`🚀 ${appConfig.appName} is running on port ${appConfig.port}`);
      logger.info(`📍 Environment: ${appConfig.env}`);
      logger.info(`🌐 Server URL: http://localhost:${appConfig.port}`);
      logger.info(`📚 API Base URL: http://localhost:${appConfig.port}/api/v1`);
      logger.info(`🔌 Socket.IO: http://localhost:${appConfig.port} (use query ?code=XXX to join TV room)`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} signal received: closing HTTP server`);
      server.close(async () => {
        logger.info('HTTP server closed');
        await closeConnection();
        process.exit(0);
      });
      
      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown...');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit - let the server continue running
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      // Close connections and exit
      gracefulShutdown('uncaughtException');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    await closeConnection();
    process.exit(1);
  }
};

startServer();

