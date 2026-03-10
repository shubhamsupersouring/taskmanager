const logger = require('./logger');

/**
 * Standard HTTP Status Codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
};

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} message - Response message
 * @param {Object|Array|null} data - Response data
 * @param {Object} meta - Additional metadata (pagination, etc.)
 * @returns {Object} Express response
 */
const sendSuccess = (res, statusCode = HTTP_STATUS.OK, message = 'Success', data = null, meta = {}) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(Object.keys(meta).length > 0 && { meta }),
    timestamp: new Date().toISOString()
  };

  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} message - Error message
 * @param {Object|Array|null} errors - Error details (validation errors, etc.)
 * @param {string} errorCode - Custom error code for client-side handling
 * @returns {Object} Express response
 */
const sendError = (res, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, message = 'Internal Server Error', errors = null, errorCode = null) => {
  const response = {
    success: false,
    message,
    ...(errorCode && { errorCode }),
    ...(errors && { errors }),
    timestamp: new Date().toISOString()
  };

  // Log error for server-side tracking
  logger.error(`Error ${statusCode}: ${message}`, { 
    statusCode, 
    errorCode,
    errors,
    stack: errors?.stack || null
  });

  return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 * @param {string} message - Custom error message (optional)
 * @returns {Object} Express response
 */
const sendValidationError = (res, errors, message = 'Validation failed') => {
  return sendError(res, HTTP_STATUS.BAD_REQUEST, message, errors, 'VALIDATION_ERROR');
};

/**
 * Send not found error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Resource not found')
 * @returns {Object} Express response
 */
const sendNotFound = (res, message = 'Resource not found') => {
  return sendError(res, HTTP_STATUS.NOT_FOUND, message, null, 'NOT_FOUND');
};

/**
 * Send unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Unauthorized')
 * @returns {Object} Express response
 */
const sendUnauthorized = (res, message = 'Unauthorized') => {
  return sendError(res, HTTP_STATUS.UNAUTHORIZED, message, null, 'UNAUTHORIZED');
};

/**
 * Send forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Forbidden')
 * @returns {Object} Express response
 */
const sendForbidden = (res, message = 'Forbidden') => {
  return sendError(res, HTTP_STATUS.FORBIDDEN, message, null, 'FORBIDDEN');
};

/**
 * Send conflict error response (e.g., duplicate entry)
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Conflict')
 * @param {Object} details - Additional conflict details
 * @returns {Object} Express response
 */
const sendConflict = (res, message = 'Conflict', details = null) => {
  return sendError(res, HTTP_STATUS.CONFLICT, message, details, 'CONFLICT');
};

/**
 * Send unprocessable entity error response (e.g., business logic errors)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object|Array} errors - Error details
 * @returns {Object} Express response
 */
const sendUnprocessableEntity = (res, message, errors = null) => {
  return sendError(res, HTTP_STATUS.UNPROCESSABLE_ENTITY, message, errors, 'UNPROCESSABLE_ENTITY');
};

/**
 * Send internal server error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Internal server error')
 * @param {Error} error - Error object (for logging)
 * @returns {Object} Express response
 */
const sendInternalError = (res, message = 'Internal server error', error = null) => {
  // Log full error details for debugging
  if (error) {
    logger.error('Internal server error:', {
      message: error.message,
      stack: error.stack,
      ...error
    });
  }
  
  return sendError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message, null, 'INTERNAL_SERVER_ERROR');
};

/**
 * Send paginated success response
 * @param {Object} res - Express response object
 * @param {Array} data - Array of data items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Response message
 * @returns {Object} Express response
 */
const sendPaginated = (res, data, page, limit, total, message = 'Data fetched successfully') => {
  const totalPages = Math.ceil(total / limit);
  const meta = {
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };

  return sendSuccess(res, HTTP_STATUS.OK, message, data, meta);
};

module.exports = {
  HTTP_STATUS,
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendConflict,
  sendUnprocessableEntity,
  sendInternalError,
  sendPaginated
};

