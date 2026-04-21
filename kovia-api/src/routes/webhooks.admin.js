/* ========================================
   KOVIA API — routes/webhooks.admin.js
   Gestión de webhooks (requieren auth).
   ======================================== */
'use strict';

const router     = require('express').Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/webhook.admin.controller');

router.use(auth);

// GET    /api/admin/webhooks
router.get('/',    controller.listWebhooks);

// POST   /api/admin/webhooks
router.post('/',   controller.createWebhook);

// GET    /api/admin/webhooks/:id
router.get('/:id', controller.getWebhookWithForms);

// GET    /api/admin/webhooks/:id/logs
router.get('/:id/logs', controller.listWebhookLogs);

// POST   /api/admin/webhooks/:id/logs/:logId/retry
router.post('/:id/logs/:logId/retry', controller.retryWebhookLog);

// PUT    /api/admin/webhooks/:id
router.put('/:id', controller.updateWebhook);

// DELETE /api/admin/webhooks/:id
router.delete('/:id', controller.deleteWebhook);

// PUT    /api/admin/webhooks/:id/forms/:formId
router.put('/:id/forms/:formId', controller.upsertWebhookFormConfig);

// DELETE /api/admin/webhooks/:id/forms/:formId
router.delete('/:id/forms/:formId', controller.removeWebhookFormConfig);

module.exports = router;
