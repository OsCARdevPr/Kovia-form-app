/* ========================================
   KOVIA API — services/webhook.service.js
   Lógica de negocio para webhooks:
   - CRUD de webhooks
   - Configuración por formulario (body template)
   - Disparo async tras cada submission
   ======================================== */
'use strict';

const Webhook           = require('../models/Webhook');
const WebhookFormConfig = require('../models/WebhookFormConfig');
const WebhookDeliveryLog = require('../models/WebhookDeliveryLog');
const Form              = require('../models/Form');
const FormSubmission    = require('../models/FormSubmission');

const MAX_LOG_TEXT_LENGTH = 8000;

// ─────────────────────────────────────────────────────────
// CRUD Webhooks
// ─────────────────────────────────────────────────────────

async function listWebhooks() {
  const rows = await Webhook.findAll({
    order: [['created_at', 'DESC']],
    include: [{ model: WebhookFormConfig, as: 'form_configs', attributes: ['id', 'form_id', 'is_active'] }],
  });

  return { items: rows, total: rows.length };
}

async function createWebhook({ name, url, method = 'POST', headers = {}, is_active = true }) {
  validateWebhookInput({ name, url, method });

  return Webhook.create({ name, url, method, headers, is_active });
}

async function updateWebhook(id, { name, url, method, headers, is_active }) {
  const webhook = await Webhook.findByPk(id);
  if (!webhook) return null;

  const patch = {};
  if (name      != null) patch.name      = name;
  if (url       != null) patch.url       = url;
  if (method    != null) patch.method    = method;
  if (headers   != null) patch.headers   = headers;
  if (is_active != null) patch.is_active = is_active;

  if (patch.name || patch.url || patch.method) {
    validateWebhookInput({ name: patch.name ?? webhook.name, url: patch.url ?? webhook.url, method: patch.method ?? webhook.method });
  }

  await webhook.update(patch);
  return webhook.reload();
}

async function deleteWebhook(id) {
  const webhook = await Webhook.findByPk(id);
  if (!webhook) return null;
  await webhook.update({ is_active: false });
  return webhook;
}

async function getWebhookWithForms(id) {
  return Webhook.findByPk(id, {
    include: [{
      model:      WebhookFormConfig,
      as:         'form_configs',
      include: [{ model: Form, as: 'form', attributes: ['id', 'title', 'slug'] }],
    }],
  });
}

async function listWebhookLogs(webhookId, { page = 1, limit = 25, form_id, status } = {}) {
  const webhook = await Webhook.findByPk(webhookId, { attributes: ['id'] });
  if (!webhook) {
    const err = new Error('Webhook no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (safePage - 1) * safeLimit;

  const where = { webhook_id: webhookId };
  if (form_id) {
    where.form_id = String(form_id).trim();
  }

  const normalizedStatus = String(status || '').trim();
  if (normalizedStatus) {
    where.status = normalizedStatus;
  }

  const { rows, count } = await WebhookDeliveryLog.findAndCountAll({
    where,
    include: [
      { model: Form, as: 'form', attributes: ['id', 'title', 'slug'], required: false },
      { model: FormSubmission, as: 'submission', attributes: ['id', 'created_at'], required: false },
    ],
    order: [['triggered_at', 'DESC'], ['created_at', 'DESC']],
    limit: safeLimit,
    offset,
  });

  return {
    items: rows,
    pagination: {
      total: count,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
}

async function retryWebhookLog(webhookId, logId) {
  const webhook = await Webhook.findByPk(webhookId, { attributes: ['id'] });
  if (!webhook) {
    const err = new Error('Webhook no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const sourceLog = await WebhookDeliveryLog.findOne({
    where: {
      id: logId,
      webhook_id: webhookId,
    },
  });

  if (!sourceLog) {
    const err = new Error('Log no encontrado para este webhook');
    err.statusCode = 404;
    throw err;
  }

  const method = normalizeMethod(sourceLog.request_method || 'POST');
  const requestUrl = String(sourceLog.request_url || '').trim();

  if (!requestUrl) {
    const err = new Error('El log no tiene una URL válida para reintento');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.fieldErrors = { log_id: ['El log no tiene una URL válida para reintento'] };
    throw err;
  }

  const safeHeaders = normalizeHeaders(sourceLog.request_headers);
  const requestBody = sourceLog.request_body == null ? null : String(sourceLog.request_body);

  const retryLog = await WebhookDeliveryLog.create({
    webhook_id: sourceLog.webhook_id,
    webhook_form_config_id: sourceLog.webhook_form_config_id,
    form_id: sourceLog.form_id,
    submission_id: sourceLog.submission_id,
    request_method: method,
    request_url: requestUrl,
    request_headers: safeHeaders,
    request_body: truncateForLog(requestBody),
    status: 'pending',
    response_status: null,
    response_body: null,
    error_message: null,
    duration_ms: null,
    triggered_at: new Date(),
  });

  const requestInit = {
    method,
    headers: safeHeaders,
  };

  if (!['GET', 'HEAD'].includes(method) && requestBody != null) {
    requestInit.body = requestBody;
  }

  const startedAt = Date.now();
  let finalStatus = 'pending';
  let responseStatus = null;
  let responseBody = null;
  let errorMessage = null;

  try {
    const response = await fetch(requestUrl, requestInit);
    const responseBodyRaw = await response.text().catch(() => '');

    finalStatus = response.ok ? 'success' : 'http_error';
    responseStatus = response.status;
    responseBody = truncateForLog(responseBodyRaw);
  } catch (err) {
    finalStatus = 'error';
    errorMessage = truncateForLog(err?.message || 'Error desconocido al reenviar el webhook', 2000);
  }

  const durationMs = Date.now() - startedAt;

  await retryLog.update({
    status: finalStatus,
    response_status: responseStatus,
    response_body: responseBody,
    error_message: errorMessage,
    duration_ms: durationMs,
  });

  return {
    source_log_id: sourceLog.id,
    retry_log_id: retryLog.id,
    status: finalStatus,
    response_status: responseStatus,
    duration_ms: durationMs,
  };
}

// ─────────────────────────────────────────────────────────
// Configuración por formulario
// ─────────────────────────────────────────────────────────

async function upsertWebhookFormConfig(webhookId, formId, { body_template, is_active }) {
  const webhook = await Webhook.findByPk(webhookId);
  if (!webhook) {
    const err = new Error('Webhook no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const form = await Form.findByPk(formId);
  if (!form) {
    const err = new Error('Formulario no encontrado');
    err.statusCode = 404;
    throw err;
  }

  const [config] = await WebhookFormConfig.upsert({
    webhook_id:    webhookId,
    form_id:       formId,
    body_template: body_template ?? null,
    is_active:     is_active ?? true,
  }, { returning: true });

  return config;
}

async function removeWebhookFormConfig(webhookId, formId) {
  const config = await WebhookFormConfig.findOne({ where: { webhook_id: webhookId, form_id: formId } });
  if (!config) return null;
  await config.destroy();
  return config;
}

// ─────────────────────────────────────────────────────────
// Disparo de webhooks
// ─────────────────────────────────────────────────────────

/**
 * Resuelve un token de template contra el contexto de la submission.
 * Soporta: submission.x, form.x, template.x, metadata.x, answers.x
 */
function resolveToken(token, ctx) {
  const parts = token.trim().split('.');
  let value = ctx;
  for (const part of parts) {
    if (value == null || typeof value !== 'object') return '';
    value = value[part];
  }

  return value == null ? '' : String(value);
}

function renderTemplate(template, ctx) {
  if (!template) return '';
  return template.replace(/\{\{(.+?)\}\}/g, (_, token) => resolveToken(token, ctx));
}

function truncateForLog(value, maxLength = MAX_LOG_TEXT_LENGTH) {
  if (value == null) return null;
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function normalizeMethod(method) {
  return String(method || 'POST').trim().toUpperCase() || 'POST';
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {};
  }
  return headers;
}

async function dispatchWebhookAndLog({ config, webhook, body, headers, formId, submissionId }) {
  const method = normalizeMethod(webhook.method);
  const safeHeaders = normalizeHeaders(headers);
  const requestInit = {
    method,
    headers: safeHeaders,
  };

  if (!['GET', 'HEAD'].includes(method)) {
    requestInit.body = body;
  }

  const startedAt = Date.now();
  const triggeredAt = new Date();
  let log = null;

  try {
    log = await WebhookDeliveryLog.create({
      webhook_id: webhook.id,
      webhook_form_config_id: config.id,
      form_id: formId,
      submission_id: submissionId,
      request_method: method,
      request_url: webhook.url,
      request_headers: safeHeaders,
      request_body: truncateForLog(body),
      status: 'pending',
      triggered_at: triggeredAt,
    });
  } catch (err) {
    console.error(`[webhooks] No se pudo crear log inicial webhook=${webhook.id}:`, err.message);
  }

  try {
    const response = await fetch(webhook.url, requestInit);
    const responseBodyRaw = await response.text().catch(() => '');
    const durationMs = Date.now() - startedAt;
    const finalStatus = response.ok ? 'success' : 'http_error';

    if (log) {
      await log.update({
        status: finalStatus,
        response_status: response.status,
        response_body: truncateForLog(responseBodyRaw),
        duration_ms: durationMs,
      });
    }

    if (response.ok) {
      console.info(
        `[webhooks] Entrega exitosa webhook=${webhook.id} form=${formId} submission=${submissionId} status=${response.status} ms=${durationMs}`,
      );
      return;
    }

    console.warn(
      `[webhooks] Error HTTP webhook=${webhook.id} form=${formId} submission=${submissionId} status=${response.status} ms=${durationMs}`,
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    if (log) {
      await log.update({
        status: 'error',
        error_message: truncateForLog(err.message, 2000),
        duration_ms: durationMs,
      }).catch(() => {});
    }

    console.error(
      `[webhooks] Error de envío webhook=${webhook.id} form=${formId} submission=${submissionId}:`,
      err.message,
    );
  }
}

/**
 * Dispara todos los webhooks activos configurados para un formulario.
 * Se llama fire-and-forget desde el controller público tras una submission.
 */
async function triggerWebhooksForForm(formId, submission, form) {
  let configs;
  try {
    configs = await WebhookFormConfig.findAll({
      where: { form_id: formId, is_active: true },
      include: [{ model: Webhook, as: 'webhook', where: { is_active: true }, required: true }],
    });
  } catch (err) {
    console.error('[webhooks] Error cargando configs:', err.message);
    return;
  }

  if (!configs.length) return;

  const ctx = {
    submission: {
      id: submission.id,
      created_at: submission.created_at,
    },
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
    },
    template: {
      name: form.template?.name ?? '',
    },
    metadata: {
      submitted_at: submission.metadata?.submitted_at ?? submission.created_at,
      ip: submission.metadata?.ip ?? '',
      user_agent: submission.metadata?.user_agent ?? '',
    },
    answers: submission.answers ?? {},
  };

  for (const config of configs) {
    const { webhook } = config;
    const body = renderTemplate(config.body_template, ctx);
    const headers = {
      'Content-Type': 'application/json',
      ...(webhook.headers ?? {}),
    };

    void dispatchWebhookAndLog({
      config,
      webhook,
      body,
      headers,
      formId,
      submissionId: submission.id,
    });
  }
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function validateWebhookInput({ name, url, method }) {
  const errors = {};
  if (!name || !String(name).trim()) errors.name = ['El nombre es requerido'];
  if (!url  || !String(url).trim())  errors.url  = ['La URL es requerida'];

  const validMethods = ['POST', 'GET', 'PUT'];
  if (method && !validMethods.includes(String(method).toUpperCase())) {
    errors.method = [`El método debe ser uno de: ${validMethods.join(', ')}`];
  }

  if (Object.keys(errors).length) {
    const err = new Error('Datos del webhook inválidos');
    err.statusCode  = 422;
    err.code        = 'VALIDATION_ERROR';
    err.fieldErrors = errors;
    throw err;
  }
}

module.exports = {
  listWebhooks,
  listWebhookLogs,
  retryWebhookLog,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookWithForms,
  upsertWebhookFormConfig,
  removeWebhookFormConfig,
  triggerWebhooksForForm,
};
