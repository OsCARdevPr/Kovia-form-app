/* ========================================
   KOVIA API — Express Server
   Puerto: 3001 (configurable en .env)
   ======================================== */
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const R = require('./utils/response');
const sequelize = require('./config/database');
const { runMigrations } = require('./migrations/run');

// Importar modelos — el barrel garantiza asociaciones y sync de todos
require('./models/index');

// Importar routers
const formsPublicRouter      = require('./routes/forms.public');      // Público: llenado
const formsAdminRouter       = require('./routes/forms.admin');       // Admin: CRUD forms
const submissionsAdminRouter = require('./routes/submissions.admin'); // Admin: detalle submission

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);

// ── Middleware ────────────────────────────────────────────
// Seguridad básica: Configuración de cabeceras HTTP
app.use(helmet());

// Seguridad básica: Prevención de ataques de fuerza bruta y DoS (Rate Limiting)
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP
  handler: (req, res, next, options) => {
    R.error(res, options.statusCode, 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.');
  },
});
app.use(aiRateLimiter);

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────
app.get('/health', (_req, res) => {
  R.success(res, 200, 'Kovia API operativa', {
    service: 'Kovia API',
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────
// Sistema de formularios dinámicos — públicas
app.use('/api/forms', formsPublicRouter);

// Sistema de formularios dinámicos — admin (requieren auth)
app.use('/api/admin/forms',       formsAdminRouter);
app.use('/api/admin/submissions', submissionsAdminRouter);


// ── 404 handler ───────────────────────────────────────────
app.use((_req, res) => {
  R.error(res, 404, 'Ruta no encontrada');
});

// ── Global error handler ──────────────────────────────────
// Captura cualquier error propagado con next(err) desde controllers
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Kovia API] Unhandled error:', err);

  // Errores de Sequelize conocidos
  if (err.name === 'SequelizeValidationError') {
    return R.error(res, 422, 'Error de validación en base de datos', {
      fieldErrors: Object.fromEntries(
        err.errors.map((e) => [e.path, [e.message]])
      ),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return R.error(res, 409, 'Ya existe un registro con esos datos');
  }

  // Error genérico — no exponer detalles internos en producción
  R.error(
    res,
    500,
    process.env.NODE_ENV === 'development'
      ? err.message
      : 'Error interno del servidor',
  );
});

// ── Database sync & server start ─────────────────────────
async function startServer() {
  try {
    await runMigrations({ useTransaction: false });
    await sequelize.authenticate();
    console.log('✅ Base de datos lista (migraciones aplicadas)');

    app.listen(PORT, () => {
      console.log(`🚀 Kovia API corriendo en http://localhost:${PORT}`);
      console.log(`   Health:             GET  http://localhost:${PORT}/health`);
      console.log(`   Form por slug:      GET  http://localhost:${PORT}/api/forms/:slug`);
      console.log(`   Submit formulario:  POST http://localhost:${PORT}/api/forms/:slug/submit`);
      console.log(`   Admin forms:        *    http://localhost:${PORT}/api/admin/forms`);
      console.log(`   Admin submissions:  GET  http://localhost:${PORT}/api/admin/submissions/:id`);
    });
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    console.error('\n💡 Asegúrate de:');
    console.error('   1. Tener la DB corriendo');
    console.error('   2. Haber creado la base de datos');
    console.error('   3. Revisar las credenciales en el archivo .env');
    process.exit(1);
  }
}

startServer();
