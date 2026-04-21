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

// ── Templates (proyectos) ───────────────────────────────
router.get('/templates', controller.listTemplates);
router.post('/templates', controller.createTemplate);
router.get('/import-guidelines', controller.getImportGuidelines);

// ── Forms ────────────────────────────────────────────────
router.get('/',        controller.listForms);
router.post('/',       controller.createForm);
router.post('/validate-config', controller.validateFormConfig);
router.post('/import', controller.importFormFromJson);
router.get('/:id/ai-context-markdown', controller.getFormAiContextMarkdown);
router.get('/:id',     controller.getFormById);
router.get('/:id/export', controller.exportFormAsJson);
router.put('/:id',     controller.updateForm);
router.delete('/:id',  controller.deactivateForm);
router.delete('/:id/permanent', controller.deleteFormPermanently);
router.post('/:id/archive-submissions', controller.archiveFormSubmissions);
router.post('/:id/archive-webhooks', controller.archiveFormWebhooks);

// ── Submissions por form ──────────────────────────────────
router.get('/:id/submissions', controller.listSubmissions);

module.exports = router;
