/* ========================================
   KOVIA API — middleware/auth.js
   Middleware de autenticación real para rutas admin.
   Verifica JWT en cookie HttpOnly o header Authorization.
   ======================================== */
'use strict';

const R = require('../utils/response');
const { verifyAccessToken, getUserById, sanitizeUser } = require('../services/auth.service');

function extractBearerToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (!authHeader) return '';

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return '';
  return String(token || '').trim();
}

function extractToken(req) {
  const cookieName = process.env.AUTH_COOKIE_NAME || 'kovia_admin_token';
  const tokenFromCookie = String(req.cookies?.[cookieName] || '').trim();
  if (tokenFromCookie) return tokenFromCookie;
  return extractBearerToken(req);
}

/**
 * Middleware de autenticación para rutas privadas.
 */
module.exports = async function auth(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return R.error(res, 401, 'No autorizado: sesión requerida');
    }

    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);

    if (!user || !user.is_active) {
      return R.error(res, 401, 'No autorizado: usuario inválido o inactivo');
    }

    req.user = sanitizeUser(user);
    return next();
  } catch {
    return R.error(res, 401, 'No autorizado: token inválido o expirado');
  }
};
