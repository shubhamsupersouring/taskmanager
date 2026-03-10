const logger = require('../utils/logger');
const { sendError } = require('../utils/response');
const messages = require('../constants/messages');

const errorHandler = (err, req, res, next) => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  // Validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 400, messages.VALIDATION_ERROR, err.errors);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, messages.TOKEN_INVALID);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, messages.TOKEN_EXPIRED);
  }

  // Database errors - PostgreSQL
  if (err.code === '23505') { // Unique violation
    return sendError(res, 409, 'Duplicate entry', { field: err.constraint });
  }
  
  if (err.code === '23503') { // Foreign key violation
    return sendError(res, 400, 'Referenced record does not exist');
  }
  
  if (err.code === '23502') { // Not null violation
    return sendError(res, 400, 'Required field is missing');
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || messages.ERROR;

  sendError(res, statusCode, message);
};

const notFoundHandler = (req, res, next) => {
  sendError(res, 404, `Route ${req.originalUrl} not found`);
};

module.exports = {
  errorHandler,
  notFoundHandler
};

