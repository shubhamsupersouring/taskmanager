const bcrypt = require('bcryptjs');

/**
 * @param {import('knex')} knex
 */
exports.seed = async function (knex) {
  const existing = await knex('users').count('id as count').first();
  if (Number(existing.count) > 0) return;

  const passwordHashMember = await bcrypt.hash('Test@123', 10);
  const passwordHashAdmin = await bcrypt.hash('Admin@123', 10);

  const members = await knex('members').select('id', 'name');
  const findMemberId = (name) => {
    const m = members.find(
      (mem) => mem.name.toLowerCase() === name.toLowerCase()
    );
    return m ? m.id : null;
  };

  const users = [
    {
      email: 'admin@supersourcing.com',
      password_hash: passwordHashAdmin,
      role: 'superadmin',
      member_id: null
    },
    {
      email: 'deepak.r@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Deepak')
    },
    {
      email: 'harshvardhansingh45@gmail.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Harsh')
    },
    {
      email: 'shubham.kapoor@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Shubham Kapoor')
    },
    {
      email: 'ayush@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Ayush')
    },
    {
      email: 'zubear.a@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Rajpal')
    },
    {
      email: 'unnati.s@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Unnati')
    },
    {
      email: 'ritik.jain@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Ritik')
    },
    {
      email: 'nauman@supersourcing.com',
      password_hash: passwordHashMember,
      role: 'member',
      member_id: findMemberId('Noman')
    }
  ];

  await knex('users').insert(users);
};

