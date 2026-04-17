/* ========================================
   KOVIA API — routes/forms.admin.js
   Rutas privadas del panel de administración.
   Protegidas por middleware auth (placeholder).

   GET    /api/admin/forms                    → Listar forms
   POST   /api/admin/forms                    → Crear form
   GET    /api/admin/forms/:id                → Obtener form
   PUT    /api/admin/forms/:id                → Actualizar form
   DELETE /api/admin/forms/:id                → Desactivar form
   GET    /api/admin/forms/:id/submissions    → Submissions del form
   GET    /api/admin/submissions/:id          → Detalle submission
   ======================================== */
'use strict';

const router     = require('express').Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/form.admin.controller');

// Aplica auth a todas las rutas de este router
router.use(auth);

// ── Forms ────────────────────────────────────────────────
router.get('/',        controller.listForms);
router.post('/',       controller.createForm);
router.get('/:id',     controller.getFormById);
router.put('/:id',     controller.updateForm);
router.delete('/:id',  controller.deactivateForm);

// ── Submissions por form ──────────────────────────────────
router.get('/:id/submissions', controller.listSubmissions);

module.exports = router;
