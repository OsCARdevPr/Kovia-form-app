/* ========================================
   KOVIA API — models/FormTemplate.js
   Template base reutilizable para crear Forms.
   Ej: "kovia-discovery", "kovia-onboarding"
   ======================================== */
'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FormTemplate = sequelize.define('FormTemplate', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  name: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    comment:   'Nombre descriptivo del template (ej: Kovia Discovery)',
  },
  slug: {
    type:      DataTypes.STRING(100),
    allowNull: false,
    unique:    true,
    comment:   'Identificador URL-friendly único del template',
  },
  description: {
    type:      DataTypes.TEXT,
    allowNull: true,
    comment:   'Descripción interna del template',
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull:    false,
  },
}, {
  tableName: 'form_templates',
  comment:   'Templates base para formularios dinámicos',
});

module.exports = FormTemplate;
