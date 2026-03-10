/**
 * OTP Utility Functions
 * Handles OTP generation, storage, and sending
 */

const crypto = require('crypto');
const logger = require('./logger');
const twilio = require('twilio');
const appConfig = require('../config/appsettings-loader');

// In-memory OTP storage (for development)
// In production, use Redis or database table
const otpStore = new Map();

// OTP expiration time (5 minutes)
const OTP_EXPIRATION_TIME = 3 * 60 * 1000;

/**
 * Generate a 6-digit OTP
 * Returns default OTP (123456) for development and staging environments
 */
function generateOTP() {
  const env = appConfig.env || process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  const envLower = env.toLowerCase();

  // Use default OTP for development and staging
  if (envLower === 'development' || envLower === 'staging' || envLower === 'test') {
    logger.info('Using default OTP (123456) for development/staging environment', { environment: envLower });
    return '123456';
  }

  // Generate random OTP for production
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Store OTP with registration data
 */
function storeOTP(phone, otp, registrationData) {
  // Normalize phone number for consistent storage
  const normalizedPhone = normalizePhone(phone);
  const key = `otp:${normalizedPhone}`;

  otpStore.set(key, {
    otp: otp.toString(), // Ensure OTP is stored as string
    data: registrationData,
    expiresAt: Date.now() + OTP_EXPIRATION_TIME,
    attempts: 0
  });

  // Clean up expired OTPs
  setTimeout(() => {
    otpStore.delete(key);
  }, OTP_EXPIRATION_TIME);

  logger.info(`OTP stored for phone: ${normalizedPhone}`, {
    expiresIn: '5 minutes',
    expiresAt: new Date(Date.now() + OTP_EXPIRATION_TIME).toISOString(),
    otp: otp.toString() // Log OTP for debugging (remove in production)
  });
}

/**
 * Normalize phone number (ensure consistent format)
 */
function normalizePhone(phone) {
  // Convert to string and remove any non-digit characters except +
  const phoneStr = phone.toString().trim();
  // Remove any spaces, dashes, etc. but keep digits
  return phoneStr.replace(/\D/g, '');
}

/**
 * Verify OTP and get registration data
 */
function verifyOTP(phone, otp) {
  // Normalize phone number for consistent lookup
  const normalizedPhone = normalizePhone(phone);
  const key = `otp:${normalizedPhone}`;
  const stored = otpStore.get(key);

  // Log for debugging
  logger.info(`Verifying OTP for phone: ${normalizedPhone}`, {
    storedKeys: Array.from(otpStore.keys()),
    hasStored: !!stored
  });

  if (!stored) {
    logger.warn(`No OTP found for phone: ${normalizedPhone}`, {
      availableKeys: Array.from(otpStore.keys())
    });
    throw new Error('Seems like you entered the wrong OTP');
  }

  if (Date.now() > stored.expiresAt) {
    logger.warn(`OTP expired for phone: ${normalizedPhone}`, {
      expiresAt: new Date(stored.expiresAt).toISOString(),
      now: new Date().toISOString()
    });
    otpStore.delete(key);
    throw new Error('OTP expired! Please retry');
  }

  if (stored.attempts >= 3) {
    logger.warn(`Max OTP attempts reached for phone: ${normalizedPhone}`, {
      attempts: stored.attempts
    });
    otpStore.delete(key);
    throw new Error('You have reached the OTP request limit. Please try again after some time');
  }

  stored.attempts++;

  // Normalize OTP (ensure both are strings for comparison)
  const normalizedOTP = otp.toString().trim();
  const storedOTP = stored.otp.toString().trim();

  if (storedOTP !== normalizedOTP) {
    logger.warn(`Invalid OTP attempt for phone: ${normalizedPhone}`, {
      attempts: stored.attempts,
      provided: normalizedOTP,
      expected: storedOTP
    });
    return null;
  }

  // OTP verified - remove from store
  otpStore.delete(key);
  logger.info(`OTP verified successfully for phone: ${normalizedPhone}`);
  return stored.data;
}

/**
 * Format phone number for Twilio (add country code if needed)
 * Assumes Indian numbers (10 digits) - adds +91
 */
function formatPhoneNumber(phone) {
  const phoneStr = phone.toString().trim();

  // If already has country code, return as is
  if (phoneStr.startsWith('+')) {
    return phoneStr;
  }

  // If 10 digits, assume Indian number and add +91
  if (phoneStr.length === 10 && /^\d+$/.test(phoneStr)) {
    return `+91${phoneStr}`;
  }

  // Return as is if format is unclear
  return phoneStr;
}

/**
 * Send OTP via SMS using Twilio
 */
async function sendOTP(phone, otp) {
  try {
    const { accountSid, authToken, phoneNumber } = appConfig.twilio;

    // Validate Twilio credentials
    if (!accountSid || !authToken || !phoneNumber) {
      logger.warn('Twilio credentials not configured. Logging OTP to console.');
      logger.info(`OTP for ${phone}: ${otp}`);
      return true; // Don't fail if Twilio not configured
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Format phone number (add country code if needed)
    const formattedPhone = formatPhoneNumber(phone);

    // Send SMS via Twilio
    const message = await client.messages.create({
      body: `Your Muskaan Dreams OTP is: ${otp}. Valid for 5 minutes.`,
      to: formattedPhone,
      from: phoneNumber
    });

    logger.info(`OTP sent via Twilio to ${formattedPhone}`, {
      messageSid: message.sid,
      status: message.status
    });

    return true;
  } catch (error) {
    logger.error('Error sending OTP via Twilio:', error);

    // Log OTP to console as fallback
    logger.warn(`OTP fallback - logging to console for ${phone}: ${otp}`);

    // Don't throw error - allow registration to continue
    // In production, you might want to throw or handle differently
    return true;
  }
}

/**
 * Send OTP via Email (fallback or additional method)
 */
async function sendOTPEmail(email, otp) {
  try {
    // TODO: Implement email sending using Azure Communication Services
    // Similar to .NET's OTPHandler.SendCode

    logger.info(`OTP email for ${email}: ${otp}`);
    return true;
  } catch (error) {
    logger.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
}

/**
 * Clear expired OTPs (cleanup function)
 */
function cleanupExpiredOTPs() {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (now > value.expiresAt) {
      otpStore.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupExpiredOTPs, 60 * 1000);

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTP,
  sendOTPEmail,
  normalizePhone // Export normalizePhone function
};

