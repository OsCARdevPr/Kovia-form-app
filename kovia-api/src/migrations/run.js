'use strict';

const path = require('path');
const sequelize = require('../config/database');

const migrations = [
  require('./001-create-form-templates'),
  require('./002-create-forms'),
  require('./003-create-form-submissions'),
  require('./004-add-submission-lock-columns'),
  require('./005-create-users'),
];

const migrationNames = [
  '001-create-form-templates',
  '002-create-forms',
  '003-create-form-submissions',
  '004-add-submission-lock-columns',
  '005-create-users',
];

async function ensureMigrationsTable(queryInterface, DataTypes) {
  await queryInterface.createTable('schema_migrations', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    executed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }).catch((err) => {
    if (err && err.name !== 'SequelizeDatabaseError' && err.name !== 'SequelizeUniqueConstraintError') {
      throw err;
    }
  });
}

async function loadExecuted(queryInterface) {
  try {
    const rows = await queryInterface.sequelize.query('SELECT name FROM schema_migrations', {
      type: sequelize.QueryTypes.SELECT,
    });
    return new Set(rows.map((row) => row.name));
  } catch {
    return new Set();
  }
}

async function runMigrations(options = {}) {
  const { useTransaction = true } = options;
  const queryInterface = sequelize.getQueryInterface();
  const { DataTypes } = require('sequelize');

  await ensureMigrationsTable(queryInterface, DataTypes);
  const executed = await loadExecuted(queryInterface);

  const work = async (transaction) => {
    for (let index = 0; index < migrations.length; index += 1) {
      const name = migrationNames[index];
      const migration = migrations[index];

      if (executed.has(name)) {
        continue;
      }

      await migration.up(queryInterface, DataTypes, { transaction });
      await queryInterface.bulkInsert('schema_migrations', [{ name, executed_at: new Date() }], {
        transaction,
      });
    }
  };

  if (!useTransaction) {
    await work(null);
    return;
  }

  await sequelize.transaction(async (transaction) => {
    await work(transaction);
  });
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log(`[migrations] Applied successfully from ${path.basename(__filename)}`);
      return sequelize.close();
    })
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error('[migrations] Failed:', error.message);
      await sequelize.close();
      process.exit(1);
    });
}

module.exports = { runMigrations };
