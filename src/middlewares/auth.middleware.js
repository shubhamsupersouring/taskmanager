const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const messages = require('../constants/messages');
const appConfig = require('../config/app');
const logger = require('../utils/logger');
const multer = require('multer');

/**
 * Verify JWT token
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 401, messages.TOKEN_REQUIRED);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return sendError(res, 401, messages.TOKEN_REQUIRED);
    }

    try {
      const decoded = jwt.verify(token, appConfig.jwt.secret);
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return sendError(res, 401, messages.TOKEN_EXPIRED);
      }
      return sendError(res, 401, messages.TOKEN_INVALID);
    }
  } catch (error) {
    logger.error('Authentication error:', error);
    return sendError(res, 500, messages.ERROR);
  }
};

/**
 * Optional authentication - doesn't fail if token is missing
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, appConfig.jwt.secret);
        req.user = decoded;
      } catch (error) {
        // Ignore token errors for optional auth
      }
    }
    next();
  } catch (error) {
    next();
  }
};


/**
 * Multer middleware for handling file uploads (if needed in auth routes)
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
}); // 5MB

module.exports = {
  authenticate,
  optionalAuth,
  upload
};

