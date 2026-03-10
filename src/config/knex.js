const path = require('path');
const knexfile = require(path.join(__dirname, '../../knexfile'));
const env = require('./env');

// Map environment: development, staging -> test, production
const envMap = {
  'development': 'development',
  'staging': 'test',
  'production': 'production'
};

const knexEnv = envMap[env.env] || env.env || 'development';

module.exports = knexfile[knexEnv] || knexfile.development;

