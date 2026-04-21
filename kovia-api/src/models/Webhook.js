/* ========================================
   KOVIA API — models/Webhook.js
   Configuración de un webhook destino.
   ======================================== */
'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');

const Webhook = sequelize.define('Webhook', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  name: {
    type:      DataTypes.STRING(200),
    allowNull: false,
    comment:   'Nombre descriptivo del webhook',
  },
  url: {
    type:      DataTypes.STRING(2048),
    allowNull: false,
    comment:   'URL destino del webhook',
  },
  method: {
    type:         DataTypes.STRING(10),
    allowNull:    false,
    defaultValue: 'POST',
    comment:      'Método HTTP: POST, GET o PUT',
  },
  headers: {
    type:         DataTypes.JSON,
    allowNull:    true,
    defaultValue: {},
    comment:      'Headers HTTP adicionales a enviar con cada disparo',
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    allowNull:    false,
    defaultValue: true,
    comment:      'false → no se dispara aunque esté configurado en formularios',
  },
}, {
  tableName: 'webhooks',
  comment:   'Webhooks configurados para recibir datos de submissions',
});

module.exports = Webhook;
