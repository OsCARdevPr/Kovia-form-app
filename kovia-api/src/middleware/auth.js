/* ========================================
   KOVIA API — middleware/auth.js
   ⚠️  PLACEHOLDER — autenticación pendiente.

   Cuando implementes auth, reemplaza este middleware
   con verificación real (JWT, API key, session, etc.).

   Uso actual:
     const auth = require('../middleware/auth');
     router.use(auth);   // protege todas las rutas del router
     router.get('/x', auth, controller.x); // protege una ruta puntual
   ======================================== */
'use strict';

const R = require('../utils/response');

/**
 * Middleware de autenticación — placeholder.
 *
 * TODO: Implementar verificación real de JWT / API key.
 * Por ahora deja pasar en desarrollo y bloquea en producción
 * si no se detecta ningún token.
 */
module.exports = function auth(req, res, next) {
  // En desarrollo se omite la verificación para facilitar testing
  if (process.env.NODE_ENV === 'development') {
    // Advertencia visible para recordar que el auth está pendiente
    console.warn('[auth] ⚠️  Middleware de auth en modo BYPASS (NODE_ENV=development)');
    return next();
  }

  // ── Lógica real futura ────────────────────────────────
  // const token = req.headers.authorization?.split(' ')[1];
  // if (!token) return R.error(res, 401, 'Token requerido');
  // try {
  //   req.user = jwt.verify(token, process.env.JWT_SECRET);
  //   next();
  // } catch {
  //   return R.error(res, 401, 'Token inválido o expirado');
  // }
  // ─────────────────────────────────────────────────────

  // En producción bloquea hasta que se implemente auth real
  return R.error(res, 401, 'Autenticación no implementada. Contacta al administrador.');
};
