/* ========================================
   KOVIA API — controllers/webhook.admin.controller.js
   Endpoints privados: gestión de webhooks.

   Rutas:
     GET    /api/admin/webhooks
     POST   /api/admin/webhooks
     GET    /api/admin/webhooks/:id
     GET    /api/admin/webhooks/:id/logs
     POST   /api/admin/webhooks/:id/logs/:logId/retry
     PUT    /api/admin/webhooks/:id
     DELETE /api/admin/webhooks/:id
     PUT    /api/admin/webhooks/:id/forms/:formId
     DELETE /api/admin/webhooks/:id/forms/:formId
   ======================================== */
'use strict';

const service = require('../services/webhook.service');
const R       = require('../utils/response');

async function listWebhooks(req, res, next) {
  try {
    const result = await service.listWebhooks();
    return R.success(res, 200, 'Webhooks obtenidos correctamente', result);
  } catch (err) {
    next(err);
  }
}

async function createWebhook(req, res, next) {
  try {
    const webhook = await service.createWebhook(req.body || {});
    return R.success(res, 201, 'Webhook creado correctamente', webhook);
  } catch (err) {
    if (err.statusCode === 422) {
      return R.error(res, 422, err.message, { fieldErrors: err.fieldErrors || null }, err.code || 'VALIDATION_ERROR');
    }
    next(err);
  }
}

async function getWebhookWithForms(req, res, next) {
  try {
    const webhook = await service.getWebhookWithForms(req.params.id);
    if (!webhook) return R.error(res, 404, 'Webhook no encontrado');
    return R.success(res, 200, 'Webhook obtenido correctamente', webhook);
  } catch (err) {
    next(err);
  }
}

async function listWebhookLogs(req, res, next) {
  try {
    const { id: webhookId } = req.params;
    const result = await service.listWebhookLogs(webhookId, {
      page: req.query.page,
      limit: req.query.limit,
      form_id: req.query.form_id ? String(req.query.form_id).trim() : undefined,
      status: req.query.status ? String(req.query.status).trim() : undefined,
    });

    return R.success(res, 200, 'Logs del webhook obtenidos correctamente', result);
  } catch (err) {
    if (err.statusCode === 404) {
      return R.error(res, 404, err.message || 'Webhook no encontrado');
    }
    next(err);
  }
}

async function retryWebhookLog(req, res, next) {
  try {
    const { id: webhookId, logId } = req.params;
    const result = await service.retryWebhookLog(webhookId, logId);

    return R.success(res, 200, 'Reintento de webhook ejecutado correctamente', result);
  } catch (err) {
    if (err.statusCode === 404) {
      return R.error(res, 404, err.message || 'Log no encontrado');
    }

    if (err.statusCode === 422) {
      return R.error(res, 422, err.message, { fieldErrors: err.fieldErrors || null }, err.code || 'VALIDATION_ERROR');
    }

    next(err);
  }
}

async function updateWebhook(req, res, next) {
  try {
    const webhook = await service.updateWebhook(req.params.id, req.body || {});
    if (!webhook) return R.error(res, 404, 'Webhook no encontrado');
    return R.success(res, 200, 'Webhook actualizado correctamente', webhook);
  } catch (err) {
    if (err.statusCode === 422) {
      return R.error(res, 422, err.message, { fieldErrors: err.fieldErrors || null }, err.code || 'VALIDATION_ERROR');
    }
    next(err);
  }
}

async function deleteWebhook(req, res, next) {
  try {
    const webhook = await service.deleteWebhook(req.params.id);
    if (!webhook) return R.error(res, 404, 'Webhook no encontrado');
    return R.success(res, 200, 'Webhook desactivado correctamente', { id: webhook.id, is_active: webhook.is_active });
  } catch (err) {
    next(err);
  }
}

async function upsertWebhookFormConfig(req, res, next) {
  try {
    const { id: webhookId, formId } = req.params;
    const config = await service.upsertWebhookFormConfig(webhookId, formId, req.body || {});
    return R.success(res, 200, 'Configuración guardada correctamente', config);
  } catch (err) {
    if (err.statusCode === 404) return R.error(res, 404, err.message);
    next(err);
  }
}

async function removeWebhookFormConfig(req, res, next) {
  try {
    const { id: webhookId, formId } = req.params;
    const config = await service.removeWebhookFormConfig(webhookId, formId);
    if (!config) return R.error(res, 404, 'Configuración no encontrada');
    return R.success(res, 200, 'Formulario desvinculado del webhook correctamente', { id: config.id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWebhooks,
  createWebhook,
  getWebhookWithForms,
  listWebhookLogs,
  retryWebhookLog,
  updateWebhook,
  deleteWebhook,
  upsertWebhookFormConfig,
  removeWebhookFormConfig,
};
