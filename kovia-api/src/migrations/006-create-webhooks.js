'use strict';

async function up(queryInterface, DataTypes) {
  await queryInterface.createTable('webhooks', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull:    false,
      primaryKey:   true,
    },
    name: {
      type:      DataTypes.STRING(200),
      allowNull: false,
    },
    url: {
      type:      DataTypes.STRING(2048),
      allowNull: false,
    },
    method: {
      type:         DataTypes.STRING(10),
      allowNull:    false,
      defaultValue: 'POST',
    },
    headers: {
      type:         DataTypes.JSON,
      allowNull:    true,
      defaultValue: {},
    },
    is_active: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
    },
    created_at: {
      type:      DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type:      DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex('webhooks', ['is_active'], {
    name: 'webhooks_is_active_idx',
  });
}

async function down(queryInterface) {
  await queryInterface.dropTable('webhooks');
}

module.exports = { up, down };
