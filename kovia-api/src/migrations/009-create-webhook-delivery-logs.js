'use strict';

async function up(queryInterface, DataTypes) {
  await queryInterface.createTable('webhook_delivery_logs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    webhook_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'webhooks', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    webhook_form_config_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'webhook_form_configs', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    form_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'forms', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    submission_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'form_submissions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    request_method: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'POST',
    },
    request_url: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    request_headers: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
    request_body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    response_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    triggered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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

  await queryInterface.addIndex('webhook_delivery_logs', ['webhook_id', 'triggered_at'], {
    name: 'webhook_delivery_logs_webhook_idx',
  });

  await queryInterface.addIndex('webhook_delivery_logs', ['form_id', 'triggered_at'], {
    name: 'webhook_delivery_logs_form_idx',
  });

  await queryInterface.addIndex('webhook_delivery_logs', ['submission_id'], {
    name: 'webhook_delivery_logs_submission_idx',
  });

  await queryInterface.addIndex('webhook_delivery_logs', ['status'], {
    name: 'webhook_delivery_logs_status_idx',
  });
}

async function down(queryInterface) {
  await queryInterface.dropTable('webhook_delivery_logs');
}

module.exports = { up, down };
