/* ========================================
   KOVIA API — services/auth.service.js
   Servicio de autenticación JWT + cookies.
   ======================================== */
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'kovia_admin_token';

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('JWT_SECRET no configurado en variables de entorno');
  }
  return secret;
}

function getTokenHours() {
  const hours = Number(process.env.AUTH_TOKEN_TTL_HOURS || 12);
  return Number.isFinite(hours) && hours > 0 ? hours : 12;
}

function getCookieOptions() {
  const tokenHours = getTokenHours();
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: tokenHours * 60 * 60 * 1000,
  };
}

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
  };
}

function signAccessToken(user) {
  const tokenHours = getTokenHours();

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    getJwtSecret(),
    {
      expiresIn: `${tokenHours}h`,
      issuer: 'kovia-api',
      audience: 'kovia-admin',
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: 'kovia-api',
    audience: 'kovia-admin',
  });
}

async function getUserById(userId) {
  if (!userId) return null;
  return User.findByPk(userId);
}

async function login({ email, password }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = await User.findOne({
    where: {
      email: normalizedEmail,
      is_active: true,
    },
  });

  if (!user) {
    const err = new Error('Credenciales inválidas');
    err.statusCode = 401;
    throw err;
  }

  const passwordOk = await bcrypt.compare(String(password || ''), user.password_hash);

  if (!passwordOk) {
    const err = new Error('Credenciales inválidas');
    err.statusCode = 401;
    throw err;
  }

  user.last_login_at = new Date();
  await user.save();

  return {
    token: signAccessToken(user),
    user: sanitizeUser(user),
  };
}

async function ensureDefaultAdminUser() {
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const fallbackEmail = 'admin@kovia.local';
  const fallbackPassword = 'Admin12345!';

  const email = String(process.env.ADMIN_EMAIL || (nodeEnv === 'production' ? '' : fallbackEmail))
    .trim()
    .toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || (nodeEnv === 'production' ? '' : fallbackPassword)).trim();
  const name = String(process.env.ADMIN_NAME || 'Admin Kovia').trim() || 'Admin Kovia';

  if (!email || !password) {
    return;
  }

  const existing = await User.findOne({
    where: {
      [Op.or]: [{ email }],
    },
  });

  if (existing) {
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    password_hash: passwordHash,
    role: 'admin',
    is_active: true,
  });

  console.log(`[auth] Usuario admin inicial creado: ${email}`);
  if (nodeEnv !== 'production' && email === fallbackEmail) {
    console.log(`[auth] Credenciales por defecto (solo dev): ${fallbackEmail} / ${fallbackPassword}`);
  }
}

module.exports = {
  COOKIE_NAME,
  getCookieOptions,
  login,
  sanitizeUser,
  verifyAccessToken,
  getUserById,
  ensureDefaultAdminUser,
};
