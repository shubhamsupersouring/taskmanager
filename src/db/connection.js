const knex = require('./knex');
const logger = require('../utils/logger');

// Handle connection errors to prevent uncaught exceptions
let connectionErrorHandler = null;

const setupErrorHandling = () => {
  // Prevent uncaught exceptions from connection errors
  if (!connectionErrorHandler) {
    connectionErrorHandler = (error) => {
      // Only log if it's a connection-related error
      if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT' || error.message?.includes('Connection')) {
        logger.warn('Database connection error (handled):', error.message);
        // Don't throw - just log
        return;
      }
      // Re-throw other errors
      throw error;
    };
    
    // Attach to knex client if possible
    if (knex.client && knex.client.pool) {
      knex.client.pool.on('error', connectionErrorHandler);
    }
  }
};

const checkConnection = async () => {
  try {
    setupErrorHandling();
    
    // Use a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
    
    const queryPromise = knex.raw('SELECT 1 AS test');
    
    await Promise.race([queryPromise, timeoutPromise]);
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    // Silently handle connection errors - don't crash the app
    logger.warn('Database connection check failed:', {
      message: error.message,
      code: error.code || 'UNKNOWN'
    });
    
    // Log helpful troubleshooting info
    if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT' || error.message?.includes('Connection')) {
      logger.warn('Connection troubleshooting:');
      logger.warn('1. Verify SQL Server is running and accessible');
      logger.warn('2. Check database configuration in appsettings.Development.json (or appsettings.{Environment}.json)');
      logger.warn('3. For Azure SQL: Verify firewall rules allow your IP');
      logger.warn('4. Check ENVIRONMENT variable is set correctly (development, staging, or production)');
      logger.warn('5. Verify Database.ConnectionString in appsettings.{Environment}.json file');
    }
    
    if (error.code === 'ELOGIN' || error.message?.includes('Login failed')) {
      logger.warn('Authentication troubleshooting:');
      logger.warn('1. Verify username and password in appsettings.{Environment}.json are correct');
      logger.warn('2. Check if the user exists in SQL Server');
      logger.warn('3. Verify the user has access to the database');
      logger.warn('4. For Azure SQL: Check if the user is configured correctly');
      logger.warn('5. Ensure password doesn\'t contain special characters that need escaping');
    }
    
    // Return false but don't throw - let the server start
    return false;
  }
};

// Gracefully close database connections
const closeConnection = async () => {
  try {
    await knex.destroy();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};

module.exports = {
  checkConnection,
  closeConnection,
  knex
};

