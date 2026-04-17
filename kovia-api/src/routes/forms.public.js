/* ========================================
   KOVIA API — routes/forms.public.js
   Rutas públicas: llenado del formulario.
   No requieren autenticación.

   GET  /api/forms/:slug          → Obtener config del formulario
   POST /api/forms/:slug/submit   → Enviar respuestas
   ======================================== */
'use strict';

const router     = require('express').Router();
const controller = require('../controllers/form.public.controller');

// Obtener formulario por slug
router.get('/:slug', controller.getForm);

// Enviar respuestas del formulario
router.post('/:slug/submit', controller.submit);

module.exports = router;
