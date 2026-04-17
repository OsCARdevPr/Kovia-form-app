/* ========================================
   KOVIA API — models/FormSubmission.js
   Guarda cada respuesta de un usuario al formulario.
   `answers`  → JSON flexible: { "q1": "valor", "q2": ["op1"] }
   `metadata` → IP, UTMs, user-agent, timestamps
   ======================================== */
'use strict';

const { DataTypes } = require('sequelize');
const sequelize     = require('../config/database');
const Form          = require('./Form');

const FormSubmission = sequelize.define('FormSubmission', {
  id: {
    type:         DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey:   true,
  },
  form_id: {
    type:       DataTypes.UUID,
    allowNull:  false,
    references: { model: Form, key: 'id' },
    onUpdate:   'CASCADE',
    onDelete:   'CASCADE',
    comment:    'Formulario al que pertenece esta respuesta',
  },

  /**
   * Respuestas libres del usuario:
   * { "q1": "Juan", "q2": ["WhatsApp", "Instagram"], "q3": "Texto largo..." }
   */
  answers: {
    type:         DataTypes.JSON,
    allowNull:    false,
    defaultValue: {},
    comment:      'Respuestas del usuario indexadas por question ID',
  },

  /**
   * Metadatos de contexto de la submissions:
   * { "ip": "1.2.3.4", "user_agent": "...", "utm_source": "...", "submitted_at": "..." }
   */
  metadata: {
    type:         DataTypes.JSON,
    allowNull:    true,
    defaultValue: {},
    comment:      'IP, UTMs, user-agent y otros datos de contexto',
  },
}, {
  tableName: 'form_submissions',
  comment:   'Respuestas de usuarios a formularios dinámicos',
  indexes: [
    { fields: ['form_id'] },
    { fields: ['created_at'] },
  ],
});

// ── Asociaciones ──────────────────────────────────────────
FormSubmission.belongsTo(Form, { foreignKey: 'form_id', as: 'form' });
Form.hasMany(FormSubmission,   { foreignKey: 'form_id', as: 'submissions' });

module.exports = FormSubmission;
