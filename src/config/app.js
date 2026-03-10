const env = require('./env');

module.exports = {
  env: env.env,
  port: env.port,
  appName: env.app.name,
  appUrl: env.app.url,
  jwt: env.jwt,
  bcrypt: env.bcrypt,
  twilio: env.twilio
};

