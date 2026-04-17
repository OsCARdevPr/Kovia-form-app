/* ========================================
   KOVIA API — models/Form.js
   Formulario concreto instanciado desde un template.
   Toda la estructura de pasos y preguntas vive en `config` (JSONB).
   ======================================== */
'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');
const FormTemplate  = require('./FormTemplate');

const Form = sequelize.define('Form', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  title: {
    type:      DataTypes.STRING(255),
    allowNull: false,
    comment:   'Título visible del formulario',
  },
  slug: {
    type:      DataTypes.STRING(200),
    allowNull: false,
    unique:    true,
    comment:   'Identificador URL-friendly único (ej: kovia-demo-2024)',
  },
  template_id: {
    type:       DataTypes.UUID,
    allowNull:  true,
    references: { model: FormTemplate, key: 'id' },
    onUpdate:   'CASCADE',
    onDelete:   'SET NULL',
    comment:    'Referencia opcional al template base',
  },

  /**
   * Estructura esperada de config:
   * {
   *   "steps": [
   *     { "order": 1, "title": "...", "questions": [...] },
   *     { "order": 2, "type": "embed",    "embed_code": "...", "position": "center" },
   *     { "order": 3, "type": "redirect", "button_label": "...", "redirect_url": "..." }
   *   ]
   * }
   */
  config: {
    type:      DataTypes.JSON,
    allowNull: false,
    defaultValue: { steps: [] },
    comment:   'Configuración completa del formulario (pasos, preguntas, embeds)',
  },
  is_active: {
    type:         DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull:    false,
    comment:      'false → 404 en ruta pública',
  },
}, {
  tableName: 'forms',
  comment:   'Formularios dinámicos configurables',
  indexes: [
    { unique: true, fields: ['slug'] },
  ],
});

// ── Asociaciones ──────────────────────────────────────────
Form.belongsTo(FormTemplate, { foreignKey: 'template_id', as: 'template' });
FormTemplate.hasMany(Form,   { foreignKey: 'template_id', as: 'forms'    });

module.exports = Form;
