require('dotenv').config();

module.exports = {
  client: 'pg',
  connection: {
    host: process.env.PGHOST || 'ss-stag-dev-db-paij5iezee.supersourcing.com',
    user: process.env.PGUSER || 'bluerangZbEbusr',
    password: process.env.PGPASSWORD || 'Year#2015eba',
    database: process.env.PGDATABASE || 'taskmanager2026',
    port: Number(process.env.PGPORT) || 5432
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

