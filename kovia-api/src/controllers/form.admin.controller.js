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
    const templateId = req.query.template_id ? String(req.query.template_id).trim() : undefined;
    const search = req.query.search ? String(req.query.search).trim() : undefined;
    const includeInactive = String(req.query.include_inactive || '').trim() === 'true';
    const hasIsActiveFilter = String(req.query.is_active || '').trim() !== '';
    const isActive = hasIsActiveFilter
      ? String(req.query.is_active).trim() === 'true'
      : undefined;

    const { rows, count } = await service.listForms({
      page,
      limit,
      templateId,
      search,
      includeInactive,
      isActive,
    });

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
 * GET /api/admin/forms/templates
 * Lista templates activos con contador de formularios.
 */
async function listTemplates(req, res, next) {
  try {
    const includeInactive = String(req.query.include_inactive || '').trim() === 'true';
    const templates = await service.listTemplates({ includeInactive });

    return R.success(res, 200, 'Plantillas obtenidas correctamente', {
      items: templates,
      total: templates.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/forms/templates
 * Crea un nuevo form template.
 */
async function createTemplate(req, res, next) {
  try {
    const { name, slug, description, is_active } = req.body || {};

    if (!name || !String(name).trim()) {
      return R.error(res, 422, 'El campo "name" es requerido', {
        fieldErrors: { name: ['El campo "name" es requerido'] },
        formErrors: [],
      }, 'VALIDATION_ERROR');
    }

    const template = await service.createTemplate({
      name: String(name).trim(),
      slug,
      description,
      is_active,
    });

    return R.success(res, 201, 'Plantilla creada correctamente', template);
  } catch (err) {
    if (err.statusCode === 409) {
      return R.error(res, 409, err.message);
    }

    next(err);
  }
}

/**
 * GET /api/admin/forms/import-guidelines
 * Devuelve markdown con reglas para generar JSON del formulario.
 */
async function getImportGuidelines(_req, res, next) {
  try {
    const markdown = await service.getImportGuidelinesMarkdown();

    return R.success(res, 200, 'Guía de importación obtenida correctamente', {
      markdown,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/forms/:id/ai-context-markdown
 * Devuelve markdown dinamico para IA de un formulario especifico.
 */
async function getFormAiContextMarkdown(req, res, next) {
  try {
    const markdown = await service.getFormAiContextMarkdown(req.params.id, {
      formUrlBase: req.query.form_url_base,
      adminApiBase: req.query.admin_api_base,
    });

    if (!markdown) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Contexto IA del formulario obtenido correctamente', {
      markdown,
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
    const { title, slug, template_id, config, is_active, auto_generate_slug } = req.body;

    if (!title) {
      return R.error(res, 422, 'El campo "title" es requerido', {
        fieldErrors: { title: ['El campo "title" es requerido'] },
        formErrors: [],
      }, 'VALIDATION_ERROR');
    }

    const form = await service.createForm({ title, slug, template_id, config, is_active, auto_generate_slug });

    return R.success(res, 201, 'Formulario creado correctamente', form);
  } catch (err) {
    if (err.statusCode === 409) {
      return R.error(res, 409, err.message);
    }

    if (err.statusCode === 422) {
      return R.error(res, 422, err.message, {
        fieldErrors: err.fieldErrors || null,
        formErrors: [],
      }, err.code || 'VALIDATION_ERROR');
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

/**
 * DELETE /api/admin/forms/:id/permanent
 * Elimina permanentemente el formulario y sus respuestas relacionadas.
 */
async function deleteFormPermanently(req, res, next) {
  try {
    const result = await service.deleteFormPermanently(req.params.id);

    if (!result) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Formulario eliminado permanentemente', result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/forms/:id/export
 * Exporta el formulario en formato JSON editable.
 */
async function exportFormAsJson(req, res, next) {
  try {
    const payload = await service.exportFormAsJson(req.params.id);
    if (!payload) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Formulario exportado correctamente', payload);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/forms/import
 * Importa un JSON de formulario y crea un nuevo registro.
 */
async function importFormFromJson(req, res, next) {
  try {
    const form = await service.importFormFromJson(req.body || {});
    return R.success(res, 201, 'Formulario importado correctamente', form);
  } catch (err) {
    if (err.statusCode === 409) {
      return R.error(res, 409, err.message);
    }

    if (err.statusCode === 422) {
      return R.error(res, 422, err.message, {
        fieldErrors: err.fieldErrors || null,
        formErrors: [],
      }, err.code || 'VALIDATION_ERROR');
    }

    next(err);
  }
}

/**
 * POST /api/admin/forms/validate-config
 * Valida config JSON usando reglas oficiales del servidor.
 */
async function validateFormConfig(req, res, next) {
  try {
    const payload = req.body || {};
    const rawConfig = payload?.config && typeof payload.config === 'object'
      ? payload.config
      : payload;

    const result = await service.validateFormConfig(rawConfig);

    return R.success(res, 200, 'Config validada correctamente', result);
  } catch (err) {
    if (err.statusCode === 422) {
      return R.error(res, 422, err.message, {
        fieldErrors: err.fieldErrors || null,
        formErrors: [],
      }, err.code || 'VALIDATION_ERROR');
    }

    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// Submissions
// ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/submissions
 * Lista todas las submissions de todos los formularios con filtros globales.
 */
async function listAllSubmissions(req, res, next) {
  try {
    const result = await service.listAllSubmissions({
      page:        req.query.page,
      limit:       req.query.limit,
      form_id:     req.query.form_id     ? String(req.query.form_id).trim()     : undefined,
      template_id: req.query.template_id ? String(req.query.template_id).trim() : undefined,
      period:      req.query.period      ? String(req.query.period).trim()      : undefined,
      search:      req.query.search      ? String(req.query.search).trim()      : undefined,
      include_archived: String(req.query.include_archived || '').trim() === 'true',
    });

    return R.success(res, 200, 'Envíos obtenidos correctamente', result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/forms/:id/submissions
 * Lista todas las submissions de un formulario con paginación.
 */
async function listSubmissions(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const includeArchived = String(req.query.include_archived || '').trim() === 'true';

    const { rows, count } = await service.listSubmissionsByForm(req.params.id, {
      page,
      limit,
      include_archived: includeArchived,
    });

    return R.success(res, 200, 'Envíos obtenidos correctamente', {
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
      return R.error(res, 404, 'Envío no encontrado');
    }

    return R.success(res, 200, 'Envío obtenido correctamente', submission);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/submissions/:id/reactivate
 * Desbloquea reenvio para el identificador asociado a esta submission,
 * pero solo dentro del formulario al que pertenece.
 */
async function reactivateSubmissionLock(req, res, next) {
  try {
    const actor = req.user?.id || req.user?.email || req.user?.name || 'admin';
    const result = await service.reactivateSubmissionLock(req.params.id, { reactivatedBy: actor });

    if (!result) {
      return R.error(res, 404, 'Envío no encontrado');
    }

    return R.success(res, 200, 'Reenvío reactivado correctamente para este formulario', {
      submission: result.submission,
      unlockedCount: result.unlockedCount,
      identifier: result.identifier,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/forms/:id/archive-submissions
 * Archiva todas las respuestas activas de un formulario.
 */
async function archiveFormSubmissions(req, res, next) {
  try {
    const result = await service.archiveSubmissionsByForm(req.params.id);

    if (!result) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Respuestas archivadas correctamente', result);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/forms/:id/archive-webhooks
 * Archiva (desactiva) todos los webhooks activos vinculados al formulario.
 */
async function archiveFormWebhooks(req, res, next) {
  try {
    const result = await service.archiveWebhookConfigsByForm(req.params.id);

    if (!result) {
      return R.error(res, 404, 'Formulario no encontrado');
    }

    return R.success(res, 200, 'Webhooks archivados correctamente', result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listTemplates,
  createTemplate,
  getImportGuidelines,
  getFormAiContextMarkdown,
  listForms,
  createForm,
  getFormById,
  updateForm,
  deactivateForm,
  deleteFormPermanently,
  exportFormAsJson,
  validateFormConfig,
  importFormFromJson,
  listAllSubmissions,
  listSubmissions,
  getSubmissionById,
  reactivateSubmissionLock,
  archiveFormSubmissions,
  archiveFormWebhooks,
};
