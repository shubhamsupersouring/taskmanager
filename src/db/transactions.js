const knex = require('./knex');

const transaction = async (callback) => {
  const trx = await knex.transaction();
  try {
    const result = await callback(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
};

module.exports = {
  transaction
};

