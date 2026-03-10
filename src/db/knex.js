const knexConfig = require('../config/knex');
const knex = require('knex')(knexConfig);

module.exports = knex;

