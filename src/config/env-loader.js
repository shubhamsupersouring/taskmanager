/**
 * Environment Configuration Loader
 * Supports multiple sources: Azure Key Vault, .env files, and environment variables
 * Matches .NET project configuration structure
 */

require('dotenv').config();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

// Try to load environment-specific file (e.g., .env.development, .env.production)
const env = process.env.NODE_ENV || 'development';

/**
 * Get configuration value with fallback chain:
 * 1. Environment-specific .env file (.env.development, .env.production, etc.)
 * 2. Base .env file
 * 3. Environment variables
 * 4. Default value
 */
function getConfig(key, defaultValue = null) {
  return process.env[key] || defaultValue;
}

/**
 * Get database connection string
 * Priority:
 * 1. DB_CONNECTION_STRING (direct connection string)
 * 2. md-db-connection-string (matches .NET Key Vault key name)
 * 3. Build from individual parameters
 */
function getDbConnectionString() {
  // First, try direct connection string (matches .NET's md-db-connection-string)
  const connectionString = getConfig('DB_CONNECTION_STRING') || getConfig('md-db-connection-string');
  
  if (connectionString) {
    return connectionString;
  }
  
  // Build from individual parameters
  const server = getConfig('DB_HOST') || 'localhost';
  const port = getConfig('DB_PORT') || 1433;
  const database = getConfig('DB_NAME') || 'muskaandreams';
  const user = getConfig('DB_USER') || 'sa';
  const password = getConfig('DB_PASSWORD') || '';
  const encrypt = getConfig('DB_ENCRYPT', 'false') === 'true';
  const trustCert = getConfig('DB_TRUST_CERT', 'true') === 'true';
  
  // Build SQL Server connection string format
  return `Server=${server},${port};Database=${database};User Id=${user};Password=${password};Encrypt=${encrypt};TrustServerCertificate=${trustCert}`;
}

module.exports = {
  env: env,
  port: parseInt(getConfig('PORT')) || 3001,
  
  // Database configuration - matches .NET project structure
  db: {
    connectionString: getDbConnectionString(),
    // Also provide individual parameters for Knex
    server: getConfig('DB_HOST') || 'localhost',
    port: parseInt(getConfig('DB_PORT')) || 1433,
    user: getConfig('DB_USER') || 'sa',
    password: getConfig('DB_PASSWORD') || '',
    database: getConfig('DB_NAME') || 'muskaandreams',
    encrypt: getConfig('DB_ENCRYPT', 'false') === 'true',
    trustServerCertificate: getConfig('DB_TRUST_CERT', 'true') === 'true',
    schema: 'muskaan'
  },
  
  // JWT configuration - matches .NET project Key Vault keys
  jwt: {
    secret: getConfig('JWT_SECRET') || 
            getConfig('adminportal-jwt-secretkey') || 
            'your-super-secret-jwt-key-change-in-production',
    expiresIn: getConfig('JWT_EXPIRES_IN') || '7d',
    issuer: getConfig('JWT_ISSUER') || 
            getConfig('adminportal-jwt-issuer') || 
            'muskaandreams'
  },
  
  // Azure Key Vault configuration (for future use)
  azure: {
    keyVaultName: getConfig('KEYVAULT_NAME') || getConfig('AZURE_KEYVAULT_NAME'),
    useKeyVault: getConfig('USE_AZURE_KEYVAULT', 'false') === 'true'
  },
  
  bcrypt: {
    saltRounds: parseInt(getConfig('BCRYPT_SALT_ROUNDS')) || 10
  },
  
  app: {
    name: getConfig('APP_NAME') || 'Muskaan Dreams Node.js API',
    url: getConfig('APP_URL') || `http://localhost:${parseInt(getConfig('PORT')) || 3001}`
  }
};

