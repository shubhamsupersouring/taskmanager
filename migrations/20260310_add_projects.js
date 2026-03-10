/**
 * @param {import('knex')} knex
 */
exports.up = async function (knex) {
  const hasProjects = await knex.schema.hasTable('projects');
  if (!hasProjects) {
    await knex.schema.createTable('projects', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable().unique();
      table.text('description');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  const hasProjectId = await knex.schema.hasColumn('tasks', 'project_id');
  if (!hasProjectId) {
    await knex.schema.alterTable('tasks', (table) => {
      table
        .integer('project_id')
        .unsigned()
        .references('id')
        .inTable('projects')
        .onDelete('SET NULL')
        .nullable();
    });
  }
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function (knex) {
  const hasProjectId = await knex.schema.hasColumn('tasks', 'project_id');
  if (hasProjectId) {
    await knex.schema.alterTable('tasks', (table) => {
      table.dropColumn('project_id');
    });
  }
  const hasProjects = await knex.schema.hasTable('projects');
  if (hasProjects) {
    await knex.schema.dropTable('projects');
  }
};

