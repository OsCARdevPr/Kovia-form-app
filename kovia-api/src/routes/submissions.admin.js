/* ========================================
   KOVIA API — routes/submissions.admin.js
   Ruta de detalle individual de submissions.
   Separada para permitir acceso: /api/admin/submissions/:id
   ======================================== */
'use strict';

const router     = require('express').Router();
const auth       = require('../middleware/auth');
const controller = require('../controllers/form.admin.controller');

router.use(auth);

// GET /api/admin/submissions
router.get('/', controller.listAllSubmissions);

// GET /api/admin/submissions/:id
router.get('/:id', controller.getSubmissionById);

// POST /api/admin/submissions/:id/reactivate
router.post('/:id/reactivate', controller.reactivateSubmissionLock);

module.exports = router;
