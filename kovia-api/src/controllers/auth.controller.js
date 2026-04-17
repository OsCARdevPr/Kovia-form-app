/* ========================================
   KOVIA API — controllers/auth.controller.js
   Controlador de autenticación admin.
   ======================================== */
'use strict';

const R = require('../utils/response');
const {
  COOKIE_NAME,
  getCookieOptions,
  login,
  getUserById,
  sanitizeUser,
} = require('../services/auth.service');

async function loginAdmin(req, res, next) {
  try {
    const { email, password } = req.validatedData;
    const auth = await login({ email, password });

    res.cookie(COOKIE_NAME, auth.token, getCookieOptions());

    return R.success(res, 200, 'Sesión iniciada correctamente', {
      user: auth.user,
    });
  } catch (err) {
    if (err.statusCode === 401) {
      return R.error(res, 401, err.message);
    }
    return next(err);
  }
}

async function logoutAdmin(_req, res) {
  const cookieOptions = getCookieOptions();

  res.clearCookie(COOKIE_NAME, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
  });

  return R.success(res, 200, 'Sesión cerrada correctamente');
}

async function me(req, res, next) {
  try {
    if (!req.user?.id) {
      return R.error(res, 401, 'No autorizado');
    }

    const user = await getUserById(req.user.id);
    if (!user || !user.is_active) {
      return R.error(res, 401, 'No autorizado');
    }

    return R.success(res, 200, 'Sesión válida', {
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  loginAdmin,
  logoutAdmin,
  me,
};
