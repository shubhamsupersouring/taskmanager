#!/usr/bin/env node

/**
 * Debug Database Connection
 * Shows exactly what connection parameters are being used
 */

const config = require('../src/config/appsettings-loader');
const knexConfig = require('../knexfile');

console.log('\n🔍 Database Connection Debug\n');
console.log('='.repeat(60));

console.log('\n📋 Environment Configuration:');
console.log('Environment:', config.env);
console.log('Connection String:', config.db.connectionString);

console.log('\n📋 Parsed Connection Config:');
const connConfig = knexConfig.development.connection;
console.log('Server:', connConfig.server);
console.log('Port:', connConfig.port);
console.log('Database:', connConfig.database);
console.log('User:', connConfig.user);
console.log('Password:', connConfig.password ? '***' + connConfig.password.slice(-2) : '(empty)');
console.log('Password Length:', connConfig.password?.length || 0);
console.log('Encrypt:', connConfig.options?.encrypt);
console.log('Trust Certificate:', connConfig.options?.trustServerCertificate);

console.log('\n🔍 Testing Connection...\n');

const knex = require('../src/db/knex');

knex.raw('SELECT 1 AS test, DB_NAME() AS current_db, SYSTEM_USER AS [current_user]')
  .then((result) => {
    console.log('✅ Connection Successful!\n');
    console.log('Database Info:');
    console.log('  Current Database:', result[0].current_db);
    console.log('  Current User:', result[0]['current_user']);
    console.log('\n✨ Database connection is working correctly!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ Connection Failed!\n');
    console.log('Error Details:');
    console.log('  Message:', error.message);
    console.log('  Code:', error.code || 'N/A');
    console.log('  Name:', error.name || 'N/A');
    
    if (error.code === 'ELOGIN') {
      console.log('\n🔧 Authentication Issue:');
      console.log('  Username:', connConfig.user);
      console.log('  Password (last 2 chars):', connConfig.password ? '***' + connConfig.password.slice(-2) : '(empty)');
      console.log('\n  Possible fixes:');
      console.log('  1. Verify username and password in appsettings.Development.json');
      console.log('  2. Check if user exists in SQL Server');
      console.log('  3. Verify user has access to the database');
      console.log('  4. For Azure SQL: Check firewall rules');
      console.log('  5. Try connecting with SQL Server Management Studio using same credentials');
    }
    
    process.exit(1);
  })
  .finally(() => {
    knex.destroy();
  });

