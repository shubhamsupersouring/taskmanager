const jwt = require('jsonwebtoken');
const appConfig = require('../config/app');
const logger = require('./logger');

/**
 * Generate JWT token
 * @param {Object} payload - Token payload (user data)
 * @param {string} expiresIn - Token expiration time (optional, defaults to config)
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = null) => {
  try {
    const options = {
      expiresIn: expiresIn || appConfig.jwt.expiresIn
    };

    const token = jwt.sign(
      payload,
      appConfig.jwt.secret,
      options
    );

    return token;
  } catch (error) {
    logger.error('Error generating JWT token:', error);
    throw new Error('Failed to generate token');
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, appConfig.jwt.secret);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Decode JWT token without verification (for debugging)
 * @param {string} token - JWT token to decode
 * @returns {Object} Decoded token payload
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken
};

