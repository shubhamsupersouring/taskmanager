/**
 * @param {import('knex')} knex
 */
exports.up = async function (knex) {
  const hasMembers = await knex.schema.hasTable('members');
  if (!hasMembers) {
    await knex.schema.createTable('members', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('role').notNullable().defaultTo('Developer');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  const hasTasks = await knex.schema.hasTable('tasks');
  if (!hasTasks) {
    await knex.schema.createTable('tasks', (table) => {
      table.increments('id').primary();
      table
        .integer('member_id')
        .unsigned()
        .references('id')
        .inTable('members')
        .onDelete('CASCADE');
      table.date('date').notNullable();
      table.text('task').notNullable();
      table.string('status').notNullable().defaultTo('in-progress');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  const hasUsers = await knex.schema.hasTable('users');
  if (!hasUsers) {
    await knex.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('role').notNullable().defaultTo('member');
      table
        .integer('member_id')
        .unsigned()
        .references('id')
        .inTable('members')
        .onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('tasks');
  await knex.schema.dropTableIfExists('members');
};

