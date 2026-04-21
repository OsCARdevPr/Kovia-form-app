/* ========================================
   KOVIA API — models/WebhookFormConfig.js
   Configuración de body template para un webhook + formulario específico.
   ======================================== */
'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');
const Webhook       = require('./Webhook');
const Form          = require('./Form');

const WebhookFormConfig = sequelize.define('WebhookFormConfig', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  webhook_id: {
    type:       DataTypes.UUID,
    allowNull:  false,
    references: { model: Webhook, key: 'id' },
    onUpdate:   'CASCADE',
    onDelete:   'CASCADE',
    comment:    'Webhook al que pertenece esta configuración',
  },
  form_id: {
    type:       DataTypes.UUID,
    allowNull:  false,
    references: { model: Form, key: 'id' },
    onUpdate:   'CASCADE',
    onDelete:   'CASCADE',
    comment:    'Formulario que activa este webhook',
  },
  body_template: {
    type:      DataTypes.TEXT,
    allowNull: true,
    comment:   'Template del body con tokens {{variable}} para resolver al disparar',
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
    comment:      'false → este formulario no dispara este webhook',
  },
}, {
  tableName: 'webhook_form_configs',
  comment:   'Configuración de body por formulario para cada webhook',
  indexes: [
    { unique: true, fields: ['webhook_id', 'form_id'], name: 'webhook_form_configs_unique_pair' },
    { fields: ['form_id'], name: 'webhook_form_configs_form_id_idx' },
  ],
});

// ── Asociaciones ──────────────────────────────────────────
Webhook.hasMany(WebhookFormConfig,         { foreignKey: 'webhook_id', as: 'form_configs' });
WebhookFormConfig.belongsTo(Webhook,       { foreignKey: 'webhook_id', as: 'webhook'      });
WebhookFormConfig.belongsTo(Form,          { foreignKey: 'form_id',    as: 'form'         });
Form.hasMany(WebhookFormConfig,            { foreignKey: 'form_id',    as: 'webhook_configs' });

module.exports = WebhookFormConfig;
