'use strict';

async function up(queryInterface, DataTypes) {
  await queryInterface.createTable('webhook_form_configs', {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull:    false,
      primaryKey:   true,
    },
    webhook_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'webhooks', key: 'id' },
      onUpdate:   'CASCADE',
      onDelete:   'CASCADE',
    },
    form_id: {
      type:       DataTypes.UUID,
      allowNull:  false,
      references: { model: 'forms', key: 'id' },
      onUpdate:   'CASCADE',
      onDelete:   'CASCADE',
    },
    body_template: {
      type:      DataTypes.TEXT,
      allowNull: true,
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

  await queryInterface.addIndex('webhook_form_configs', ['webhook_id', 'form_id'], {
    unique: true,
    name:   'webhook_form_configs_unique_pair',
  });

  await queryInterface.addIndex('webhook_form_configs', ['form_id'], {
    name: 'webhook_form_configs_form_id_idx',
  });
}

async function down(queryInterface) {
  await queryInterface.dropTable('webhook_form_configs');
}

module.exports = { up, down };
