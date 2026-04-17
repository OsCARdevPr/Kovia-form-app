/* ========================================
   KOVIA API — models/index.js
   Punto de entrada para todos los modelos.
   Importar aquí garantiza que las asociaciones
   se registren antes de que Sequelize haga sync.
   ======================================== */
'use strict';

const FormTemplate  = require('./FormTemplate');
const Form          = require('./Form');
const FormSubmission = require('./FormSubmission');

module.exports = {
  FormTemplate,
  Form,
  FormSubmission,
};
