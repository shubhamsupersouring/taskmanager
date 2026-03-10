#!/usr/bin/env node

/**
 * Environment Setup Script
 * Helps create environment-specific .env files from template
 */

const fs = require('fs');
const path = require('path');

const envFiles = {
  development: `.env.development`,
  test: `.env.test`,
  production: `.env.production`
};

const template = `# ${process.env.NODE_ENV || 'development'} Environment Configuration
# This file is automatically loaded when NODE_ENV=${process.env.NODE_ENV || 'development'}
# Matches .NET project configuration structure

NODE_ENV=${process.env.NODE_ENV || 'development'}
PORT=3001

# Database Configuration
# Option 1: Use connection string (matches .NET's md-db-connection-string from Key Vault)
# Copy the connection string from Azure Key Vault or .NET appsettings
# DB_CONNECTION_STRING=Server=your-server.database.windows.net,1433;Database=your-db;User Id=your-user;Password=your-password;Encrypt=true;TrustServerCertificate=false

# Option 2: Use individual parameters (for local SQL Server)
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=muskaandreams
DB_ENCRYPT=false
DB_TRUST_CERT=true

# Alternative: Use same Key Vault key names as .NET project
# md-db-connection-string=Server=...;Database=...;User Id=...;Password=...;Encrypt=true

# JWT Configuration (matches .NET Key Vault keys)
# Use the same values as .NET service for token compatibility
JWT_SECRET=your-jwt-secret-from-net-service
JWT_ISSUER=muskaandreams

# Alternative: Use same Key Vault key names as .NET project
# adminportal-jwt-secretkey=your-jwt-secret-from-net-service
# adminportal-jwt-issuer=muskaandreams

# Password Hashing
BCRYPT_SALT_ROUNDS=10

# Application
APP_NAME=Muskaan Dreams Node.js API (${process.env.NODE_ENV || 'development'})
APP_URL=https://app-muskaandreams-backend-mobileapp-api-dev-bdhpfmbzcaexazay.centralindia-01.azurewebsites.net

# Azure Key Vault (optional - for future use)
# USE_AZURE_KEYVAULT=false
# KEYVAULT_NAME=kv-muskaandreams-dev
`;

function createEnvFile(env) {
  const fileName = envFiles[env];
  const filePath = path.join(__dirname, '..', fileName);
  
  if (fs.existsSync(filePath)) {
    console.log(`⚠️  ${fileName} already exists. Skipping...`);
    return false;
  }
  
  const content = template.replace(/\$\{process\.env\.NODE_ENV \|\| 'development'\}/g, env);
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Created ${fileName}`);
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const env = args[0] || 'development';
  
  console.log('🔧 Setting up environment configuration files...\n');
  
  if (env === 'all') {
    // Create all environment files
    Object.keys(envFiles).forEach(e => createEnvFile(e));
  } else if (envFiles[env]) {
    // Create specific environment file
    createEnvFile(env);
    console.log(`\n📝 Next steps:`);
    console.log(`1. Edit ${envFiles[env]} with your database connection string`);
    console.log(`2. Add JWT secret and issuer from .NET Key Vault`);
    console.log(`3. Run: NODE_ENV=${env} npm run dev`);
  } else {
    console.error(`❌ Invalid environment: ${env}`);
    console.log(`Available environments: ${Object.keys(envFiles).join(', ')}, or 'all'`);
    process.exit(1);
  }
  
  console.log('\n✨ Done!');
}

main();

