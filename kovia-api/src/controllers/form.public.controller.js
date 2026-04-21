/* ========================================
   KOVIA API — controllers/form.public.controller.js
   Endpoints públicos: llenado del formulario.

   Rutas:
     GET  /api/forms/:slug          → getForm
     POST /api/forms/:slug/submit   → submit
   ======================================== */
'use strict';

const service        = require('../services/form.service');
const webhookService = require('../services/webhook.service');
const R              = require('../utils/response');

/**
 * GET /api/forms/:slug
 * Retorna la config completa del formulario para que el FE lo renderice.
 * 404 si el slug no existe o el formulario está inactivo.
 */
async function getForm(req, res, next) {
  try {
    const form = await service.getFormBySlug(req.params.slug);

    if (!form) {
      return R.error(res, 404, 'Formulario no encontrado o no disponible');
    }

    return R.success(res, 200, 'Formulario obtenido correctamente', {
      id:        form.id,
      title:     form.title,
      slug:      form.slug,
      template:  form.template ?? null,
      config:    form.config,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/forms/:slug/submit
 * Recibe { answers: { "q1": "...", "q2": [...] } }
 * Valida preguntas required y guarda la submission.
 */
async function submit(req, res, next) {
  try {
    const form = await service.getFormBySlug(req.params.slug);

    if (!form) {
      return R.error(res, 404, 'Formulario no encontrado o no disponible');
    }

    const answers = req.body?.answers;

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return R.error(res, 422, 'El campo "answers" es requerido y debe ser un objeto', {
        fieldErrors: { answers: ['El campo "answers" es requerido y debe ser un objeto'] },
        formErrors: [],
      }, 'VALIDATION_ERROR');
    }

    const { submission, warnings } = await service.submitForm(form, answers, req);

    // Disparar webhooks configurados para este formulario (fire-and-forget)
    webhookService.triggerWebhooksForForm(form.id, submission, form).catch((error) => {
      console.error('[webhooks] Error al iniciar disparo para submission:', submission.id, error?.message || error);
    });

    if (warnings.length > 0) {
      return R.warning(res, 201, 'Formulario enviado con advertencias', {
        id:         submission.id,
        created_at: submission.created_at,
      }, warnings);
    }

    return R.success(res, 201, 'Formulario enviado correctamente', {
      id:         submission.id,
      created_at: submission.created_at,
    });
  } catch (err) {
    // Error de validación de required desde el service
    if (err.statusCode === 422 && err.missingFields) {
      return R.error(res, 422, err.message, {
        fieldErrors: null,
        formErrors: [],
        missingFields: err.missingFields,
      }, err.code || 'VALIDATION_ERROR');
    }

    if (err.statusCode === 422 && err.fieldErrors) {
      return R.error(res, 422, err.message, {
        fieldErrors: err.fieldErrors,
        formErrors: [],
      }, err.code || 'VALIDATION_ERROR');
    }

    if (err.statusCode === 409) {
      return R.error(res, 409, err.message, {
        code: err.code || 'FORM_ALREADY_SUBMITTED',
        reactivationRequired: err.reactivationRequired === true,
        lock: err.lock || null,
      });
    }

    next(err);
  }
}

module.exports = { getForm, submit };
