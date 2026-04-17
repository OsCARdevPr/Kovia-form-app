/* ========================================
   KOVIA API — controllers/form.admin.controller.js
   Endpoints privados: panel de administración.

   Rutas protegidas por middleware auth (placeholder):
     GET    /api/admin/forms
     POST   /api/admin/forms
     GET    /api/admin/forms/:id
     PUT    /api/admin/forms/:id
     DELETE /api/admin/forms/:id
     GET    /api/admin/forms/:id/submissions
     GET    /api/admin/submissions/:id
   ======================================== */
'use strict';

const service = require('../services/form.service');
const R       = require('../utils/response');

// ─────────────────────────────────────────────────────────
// Forms
// ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/forms
 * Lista todos los formularios con paginación.
 */
async function listForms(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const { rows, count } = await service.listForms({ page, limit });

    return R.success(res, 200, 'Formularios obtenidos correctamente', {
      items: rows,
      pagination: {
        total:      count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/forms
 * Crea un nuevo formulario.
 * Body: { title, slug, template_id?, config?, is_active? }
 */
async function createForm(req, res, next) {
  try {
    const { title, slug, template_id, config, is_active } = req.body;

    if (!title) {
      return R.error(res, 422, 'El campo "title" es requerido');
    }

    const form = await service.createForm({ title, slug, template_id, config, is_active });

    return R.success(res, 201, 'Formulario creado correctamente', form);
  } catch (err) {
    if (err.statusCode === 409) {
      return R.error(res, 409, err.message);
    }
    next(err);
  }
}

/**
 * GET /api/admin/forms/:id
 * Obtiene un formulario por ID (config completa incluida).
 */
async function getFormById(req, res, next) {
  try {
    const form = await service.getFormById(req.params.id);

    if (!form) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Formulario obtenido correctamente', form);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/forms/:id
 * Actualiza title, slug, template_id, config o is_active.
 */
async function updateForm(req, res, next) {
  try {
    const form = await service.updateForm(req.params.id, req.body);

    if (!form) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Formulario actualizado correctamente', form);
  } catch (err) {
    if (err.statusCode === 409) {
      return R.error(res, 409, err.message);
    }
    next(err);
  }
}

/**
 * DELETE /api/admin/forms/:id
 * Desactiva el formulario (soft delete — is_active = false).
 */
async function deactivateForm(req, res, next) {
  try {
    const form = await service.deactivateForm(req.params.id);

    if (!form) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Formulario desactivado correctamente', {
      id:        form.id,
      is_active: form.is_active,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/forms/:id/submissions
 * Lista todas las submissions de un formulario con paginación.
 */
async function listSubmissions(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const { rows, count } = await service.listSubmissionsByForm(req.params.id, { page, limit });

    return R.success(res, 200, 'Submissions obtenidas correctamente', {
      items: rows,
      pagination: {
        total:      count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/submissions/:id
 * Detalle completo de una submission.
 */
async function getSubmissionById(req, res, next) {
  try {
    const submission = await service.getSubmissionById(req.params.id);

    if (!submission) {
      return R.error(res, 404, 'Submission no encontrada');
    }

    return R.success(res, 200, 'Submission obtenida correctamente', submission);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listForms,
  createForm,
  getFormById,
  updateForm,
  deactivateForm,
  listSubmissions,
  getSubmissionById,
};
