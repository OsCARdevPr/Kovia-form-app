/* ========================================
   KOVIA API — models/WebhookDeliveryLog.js
   Historial de disparos de webhooks por submission.
   ======================================== */
'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Webhook = require('./Webhook');
const WebhookFormConfig = require('./WebhookFormConfig');
const Form = require('./Form');
const FormSubmission = require('./FormSubmission');

const WebhookDeliveryLog = sequelize.define('WebhookDeliveryLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  webhook_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Webhook, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    comment: 'Webhook configurado para el envío',
  },
  webhook_form_config_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: WebhookFormConfig, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Configuración específica webhook+form usada en el disparo',
  },
  form_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: Form, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Formulario que originó el envío',
  },
  submission_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: FormSubmission, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    comment: 'Submission que disparó el webhook',
  },
  request_method: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'POST',
    comment: 'Método HTTP usado para el envío',
  },
  request_url: {
    type: DataTypes.STRING(2048),
    allowNull: false,
    comment: 'URL destino invocada',
  },
  request_headers: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Headers enviados en la solicitud',
  },
  request_body: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Body renderizado para el envío',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Estado final: pending, success, http_error o error',
  },
  response_status: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Código HTTP devuelto por el destino',
  },
  response_body: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Respuesta textual capturada',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error de red o ejecución al disparar',
  },
  duration_ms: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duración del intento de envío en ms',
  },
  triggered_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Fecha/hora real del disparo',
  },
}, {
  tableName: 'webhook_delivery_logs',
  comment: 'Historial de entregas de webhook por formulario y submission',
  indexes: [
    { fields: ['webhook_id', 'triggered_at'], name: 'webhook_delivery_logs_webhook_idx' },
    { fields: ['form_id', 'triggered_at'], name: 'webhook_delivery_logs_form_idx' },
    { fields: ['submission_id'], name: 'webhook_delivery_logs_submission_idx' },
    { fields: ['status'], name: 'webhook_delivery_logs_status_idx' },
  ],
});

Webhook.hasMany(WebhookDeliveryLog, { foreignKey: 'webhook_id', as: 'delivery_logs' });
WebhookDeliveryLog.belongsTo(Webhook, { foreignKey: 'webhook_id', as: 'webhook' });

WebhookFormConfig.hasMany(WebhookDeliveryLog, { foreignKey: 'webhook_form_config_id', as: 'delivery_logs' });
WebhookDeliveryLog.belongsTo(WebhookFormConfig, { foreignKey: 'webhook_form_config_id', as: 'webhook_form_config' });

Form.hasMany(WebhookDeliveryLog, { foreignKey: 'form_id', as: 'webhook_delivery_logs' });
WebhookDeliveryLog.belongsTo(Form, { foreignKey: 'form_id', as: 'form' });

FormSubmission.hasMany(WebhookDeliveryLog, { foreignKey: 'submission_id', as: 'webhook_delivery_logs' });
WebhookDeliveryLog.belongsTo(FormSubmission, { foreignKey: 'submission_id', as: 'submission' });

module.exports = WebhookDeliveryLog;
