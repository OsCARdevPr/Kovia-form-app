/* ========================================
   KOVIA API — routes/auth.js
   Rutas de autenticación para panel admin.
   ======================================== */
'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const controller = require('../controllers/auth.controller');
const { loginSchema } = require('../schemas/auth.schema');

router.post('/login', validate(loginSchema), controller.loginAdmin);
router.post('/logout', controller.logoutAdmin);
router.get('/me', auth, controller.me);

module.exports = router;
