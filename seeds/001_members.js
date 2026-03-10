/**
 * @param {import('knex')} knex
 */
exports.seed = async function (knex) {
  const existing = await knex('members').count('id as count').first();
  if (Number(existing.count) > 0) return;

  const seedMembers = [
    { name: 'Ritik', role: 'Developer' },
    { name: 'Shubham Kapoor', role: 'Developer' },
    { name: 'Shubham Tiwari', role: 'Developer' },
    { name: 'Deepak', role: 'Developer' },
    { name: 'Unnati', role: 'Developer' },
    { name: 'Ayush', role: 'Developer' },
    { name: 'Noman', role: 'Developer' },
    { name: 'Harsh', role: 'Developer' },
    { name: 'Rajpal', role: 'Developer' }
  ];

  await knex('members').insert(seedMembers);
};

