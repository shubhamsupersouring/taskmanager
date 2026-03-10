#!/usr/bin/env node

/**
 * Database Connection Test Script
 * Helps diagnose database connection issues
 */

const config = require('../src/config/appsettings-loader');
const knex = require('../src/db/knex');

console.log('\n🔍 Database Configuration Test\n');
console.log('='.repeat(50));

console.log('\n📋 Current Configuration:');
console.log('Environment:', config.env);
console.log('Database Server:', config.db.server);
console.log('Database Port:', config.db.port);
console.log('Database Name:', config.db.database);
console.log('Database User:', config.db.user);
console.log('Password:', config.db.password ? '***' + config.db.password.slice(-2) : '(empty)');
console.log('Encrypt:', config.db.encrypt);
console.log('Trust Certificate:', config.db.trustServerCertificate);

console.log('\n🔌 Testing Connection...\n');

knex.raw('SELECT 1 AS test, DB_NAME() AS current_db, SYSTEM_USER AS [current_user], @@VERSION AS version')
  .then((result) => {
    console.log('✅ Connection Successful!\n');
    console.log('Database Info:');
    console.log('  Current Database:', result[0].current_db);
    console.log('  SQL Server Version:', result[0].version.split('\n')[0]);
    console.log('\n✨ Database connection is working correctly!');
    process.exit(0);
  })
  .catch((error) => {
    console.log('❌ Connection Failed!\n');
    console.log('Error Details:');
    console.log('  Message:', error.message);
    console.log('  Code:', error.code || 'N/A');
    console.log('  Name:', error.name || 'N/A');
    
    console.log('\n🔧 Troubleshooting Steps:');
    
    if (!config.db.password || config.db.password === '') {
      console.log('\n⚠️  ISSUE: Password is empty!');
      console.log('   Fix: Add your SQL Server password to appsettings.Development.json:');
      console.log('   {');
      console.log('     "Database": {');
      console.log('       "Password": "YourActualPassword"');
      console.log('     }');
      console.log('   }');
    }
    
    if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
      console.log('\n⚠️  ISSUE: Cannot reach SQL Server');
      console.log('   Check:');
      console.log('   1. SQL Server is running');
      console.log('   2. TCP/IP is enabled in SQL Server Configuration Manager');
      console.log('   3. SQL Server Browser service is running');
      console.log('   4. Firewall allows port', config.db.port);
    }
    
    if (error.message && error.message.includes('Login failed')) {
      console.log('\n⚠️  ISSUE: Authentication failed');
      console.log('   Check:');
      console.log('   1. Username is correct:', config.db.user);
      console.log('   2. Password is correct');
      console.log('   3. SQL Server authentication mode allows SQL authentication');
    }
    
    if (error.message && error.message.includes('Cannot open database')) {
      console.log('\n⚠️  ISSUE: Database does not exist');
      console.log('   Check:');
      console.log('   1. Database name is correct:', config.db.database);
      console.log('   2. Database exists on the server');
      console.log('   3. User has access to the database');
    }
    
    console.log('\n📚 See TROUBLESHOOTING.md for more help\n');
    process.exit(1);
  })
  .finally(() => {
    knex.destroy();
  });

