/**
 * AppSettings Configuration Loader
 * Mimics .NET's appsettings.json pattern
 * Loads base appsettings.json and merges with environment-specific file
 */

const fs = require('fs');
const path = require('path');

// Get environment from environment variable (development, staging, or production)
// This determines which appsettings.{Environment}.json file to load
// PRIMARY: Use ENVIRONMENT or NODE_ENV variable
const rawEnv = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
const env = rawEnv.toLowerCase();

// Map staging to test (for appsettings file naming)
const envFileMap = {
  'development': 'Development',
  'staging': 'Staging',
  'test': 'Test',
  'production': 'Production'
};

const envFileName = envFileMap[env] || 'Development';

// Only load .env for non-database config (JWT, etc.) - database comes from appsettings.json
require('dotenv').config();
const configDir = path.join(__dirname, '../..');

/**
 * Load JSON configuration file
 */
function loadJsonConfig(filename) {
  const filePath = path.join(configDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Could not parse ${filename}:`, error.message);
      return {};
    }
  }
  return {};
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Get configuration value with priority:
 * 1. Environment variable (highest priority)
 * 2. appsettings.{Environment}.json
 * 3. appsettings.json (base)
 * 4. Default value
 */
function getConfig(key, defaultValue = null) {
  // First check environment variables (for Azure Key Vault support)
  if (process.env[key]) {
    return process.env[key];
  }

  // Check nested keys (e.g., "Database.Host" or "JWT.Secret")
  const keys = key.split('.');
  let value = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      value = null;
      break;
    }
  }

  return value !== null ? value : defaultValue;
}

// Load base configuration
const baseConfig = loadJsonConfig('appsettings.json');

// Load environment-specific configuration
// Use mapped filename (staging -> Staging, development -> Development, etc.)
const envConfig = loadJsonConfig(`appsettings.${envFileName}.json`);

// Merge configurations (environment-specific overrides base)
const config = deepMerge(baseConfig, envConfig);

/**
 * Get database connection string
 * Priority:
 * 1. Database.ConnectionString (from appsettings.{Environment}.json) - PRIMARY SOURCE
 * 2. Build from Database.* properties (from appsettings.{Environment}.json)
 * 3. Environment variables (only as fallback, not primary)
 */
function getDbConnectionString() {
  // PRIMARY: Check appsettings.json first (this is the main source)
  if (config.Database && config.Database.ConnectionString) {
    return config.Database.ConnectionString;
  }

  // SECONDARY: Build from individual properties in appsettings.json
  const db = config.Database || {};
  if (db.Host || db.Server) {
    const server = db.Host || db.Server || 'localhost';
    const port = db.Port || 1433;
    const database = db.Name || db.Database || 'muskaandreams';
    const user = db.User || db.UserId || 'sa';
    const password = db.Password || '';
    const encrypt = db.Encrypt !== undefined ? db.Encrypt : true;
    const trustCert = db.TrustServerCertificate !== undefined ? db.TrustServerCertificate : false;

    return `Server=${server},${port};Database=${database};User Id=${user};Password=${password};Encrypt=${encrypt};TrustServerCertificate=${trustCert}`;
  }

  // FALLBACK: Environment variables (only if appsettings doesn't have it)
  const envConnectionString = process.env.DB_CONNECTION_STRING || process.env['md-db-connection-string'];
  if (envConnectionString) {
    return envConnectionString;
  }

  // Last resort: build from env vars
  const server = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT) || 1433;
  const database = process.env.DB_NAME || 'muskaandreams';
  const user = process.env.DB_USER || 'sa';
  const password = process.env.DB_PASSWORD || '';
  const encrypt = process.env.DB_ENCRYPT === 'true';
  const trustCert = process.env.DB_TRUST_CERT === 'true';

  return `Server=${server},${port};Database=${database};User Id=${user};Password=${password};Encrypt=${encrypt};TrustServerCertificate=${trustCert}`;
}

module.exports = {
  env: env,
  port: parseInt(process.env.PORT) || 3001,
  // Database configuration - PRIMARY SOURCE: appsettings.json
  db: {
    connectionString: getDbConnectionString(),
    // Also provide individual parameters for Knex (from appsettings.json)
    server: config.Database?.Host || config.Database?.Server || process.env.DB_HOST || 'localhost',
    port: parseInt(config.Database?.Port) || parseInt(process.env.DB_PORT) || 1433,
    user: config.Database?.User || config.Database?.UserId || process.env.DB_USER || 'sa',
    password: config.Database?.Password || process.env.DB_PASSWORD || '',
    database: config.Database?.Name || config.Database?.Database || process.env.DB_NAME || 'muskaandreams',
    encrypt: config.Database?.Encrypt !== undefined ? config.Database.Encrypt : (process.env.DB_ENCRYPT === 'true'),
    trustServerCertificate: config.Database?.TrustServerCertificate !== undefined ? config.Database.TrustServerCertificate : (process.env.DB_TRUST_CERT === 'true'),
    schema: 'muskaan'
  },

  // JWT configuration - matches .NET Key Vault keys
  jwt: {
    secret: getConfig('JWT.Secret') ||
      process.env.JWT_SECRET ||
      process.env['adminportal-jwt-secretkey'] ||
      'your-super-secret-jwt-key-change-in-production',
    expiresIn: getConfig('JWT.ExpiresIn') || process.env.JWT_EXPIRES_IN || '7d',
    issuer: getConfig('JWT.Issuer') ||
      process.env.JWT_ISSUER ||
      process.env['adminportal-jwt-issuer'] ||
      'muskaandreams'
  },

  // Azure Key Vault configuration
  azure: {
    keyVaultName: getConfig('KEYVAULT_NAME') || process.env.KEYVAULT_NAME || process.env.AZURE_KEYVAULT_NAME,
    useKeyVault: process.env.USE_AZURE_KEYVAULT === 'true'
  },

  bcrypt: {
    saltRounds: parseInt(getConfig('BCrypt.SaltRounds')) || parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10
  },

  app: {
    name: getConfig('Application.Name') || process.env.APP_NAME || 'Muskaan Dreams Node.js API',
    url: getConfig('Application.Url') || process.env.APP_URL || `http://localhost:${parseInt(getConfig('Application.Port')) || 3001}`
  },

  // Storage configuration (matching .NET)
  storage: {
    containerName: getConfig('STORAGE_CONTAINER_NAME') || process.env.STORAGE_CONTAINER_NAME,
    accountName: getConfig('STORAGE_ACCOUNT_NAME') || process.env.STORAGE_ACCOUNT_NAME,
    directoryPath: getConfig('STORAGE_DIRECTORY_PATH') || process.env.STORAGE_DIRECTORY_PATH
  },

  // Twilio SMS configuration
  twilio: {
    accountSid: getConfig('Twilio.AccountSid') || process.env.TWILIO_ACCOUNT_SID || '',
    authToken: getConfig('Twilio.AuthToken') || process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: getConfig('Twilio.PhoneNumber') || process.env.TWILIO_PHONE_NUMBER || ''
  },

  // Export raw config for advanced usage
  raw: config
};

