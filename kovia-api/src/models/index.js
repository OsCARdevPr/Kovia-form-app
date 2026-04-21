/* ========================================
   KOVIA API — models/index.js
   Punto de entrada para todos los modelos.
   Importar aquí garantiza que las asociaciones
   se registren antes de que Sequelize haga sync.
   ======================================== */
'use strict';

const FormTemplate      = require('./FormTemplate');
const Form              = require('./Form');
const FormSubmission    = require('./FormSubmission');
const User              = require('./User');
const Webhook           = require('./Webhook');
const WebhookFormConfig = require('./WebhookFormConfig');
const WebhookDeliveryLog = require('./WebhookDeliveryLog');

module.exports = {
  FormTemplate,
  Form,
  FormSubmission,
  User,
  Webhook,
  WebhookFormConfig,
  WebhookDeliveryLog,
};
