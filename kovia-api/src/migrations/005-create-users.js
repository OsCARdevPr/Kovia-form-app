'use strict';

const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

async function up(queryInterface, DataTypes) {
  await queryInterface.createTable('users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'admin',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex('users', ['email'], {
    unique: true,
    name: 'users_email_unique',
  });

  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const fallbackEmail = 'admin@kovia.local';
  const fallbackPassword = 'Admin12345!';

  const email = String(process.env.ADMIN_EMAIL || (nodeEnv === 'production' ? '' : fallbackEmail))
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || (nodeEnv === 'production' ? '' : fallbackPassword)).trim();
  const name = String(process.env.ADMIN_NAME || 'Admin Kovia').trim() || 'Admin Kovia';

  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await queryInterface.bulkInsert('users', [{
      id: randomUUID(),
      name,
      email,
      password_hash: passwordHash,
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  }
}

async function down(queryInterface) {
  await queryInterface.dropTable('users');
}

module.exports = { up, down };
