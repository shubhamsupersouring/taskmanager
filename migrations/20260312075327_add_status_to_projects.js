exports.up = async function (knex) {
    const hasProjects = await knex.schema.hasTable('projects');
    if (hasProjects) {
      const hasStatus = await knex.schema.hasColumn('projects', 'status');
      if (!hasStatus) {
        await knex.schema.alterTable('projects', (table) => {
          table
            .enu('status', ['active', 'completed', 'planning', 'on-hold'])
            .notNullable()
            .defaultTo('active');
        });
      }
    }
  };
  
  exports.down = async function (knex) {
    const hasProjects = await knex.schema.hasTable('projects');
    if (hasProjects) {
      const hasStatus = await knex.schema.hasColumn('projects', 'status');
      if (hasStatus) {
        await knex.schema.alterTable('projects', (table) => {
          table.dropColumn('status');
        });
      }
    }
  };