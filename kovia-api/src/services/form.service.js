/* ========================================
   KOVIA API — services/form.service.js
   Lógica de negocio para formularios dinámicos.
   Todo acceso a DB vive aquí; controllers solo orquestan.
   ======================================== */
'use strict';

const crypto        = require('crypto');
const { z }         = require('zod');
const { Op }        = require('sequelize');
const Form          = require('../models/Form');
const FormTemplate  = require('../models/FormTemplate');
const FormSubmission = require('../models/FormSubmission');

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function generateUniqueSlug(title) {
  const base = slugify(title) || `form-${Date.now()}`;
  let slug = base;
  let suffix = 1;

  while (await Form.findOne({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

const FIELD_TYPE_ALIASES = Object.freeze({
  tel: 'telefono',
  phone: 'telefono',
  datetime: 'date-time',
  date_time: 'date-time',
});

function normalizeQuestionType(type) {
  const rawType = String(type || '').trim().toLowerCase();
  return FIELD_TYPE_ALIASES[rawType] || rawType || 'text';
}

function isDigitsOnly(value) {
  if (typeof value !== 'string' || value.length === 0) return false;

  for (const char of value) {
    if (char < '0' || char > '9') return false;
  }

  return true;
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function isValidMaskedDate(value) {
  if (typeof value !== 'string') return false;

  const parts = value.trim().split('-');
  if (parts.length !== 3) return false;

  const [yearToken, monthToken, dayToken] = parts;
  if (!isDigitsOnly(yearToken) || !isDigitsOnly(monthToken) || !isDigitsOnly(dayToken)) return false;

  return isValidDateParts(Number(yearToken), Number(monthToken), Number(dayToken));
}

function isValidMaskedDateTime(value) {
  if (typeof value !== 'string') return false;

  const [dateToken, timeToken] = value.trim().split(' ');
  if (!dateToken || !timeToken) return false;
  if (!isValidMaskedDate(dateToken)) return false;

  const timeParts = timeToken.split(':');
  if (timeParts.length !== 2) return false;

  const [hoursToken, minutesToken] = timeParts;
  if (!isDigitsOnly(hoursToken) || !isDigitsOnly(minutesToken)) return false;

  const hours = Number(hoursToken);
  const minutes = Number(minutesToken);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function parsePriceValue(rawValue) {
  if (rawValue === undefined || rawValue === null) return null;

  const source = String(rawValue).trim();
  if (!source) return null;

  let candidate = '';
  for (const char of source) {
    const isDigit = char >= '0' && char <= '9';
    if (isDigit || char === '.' || char === ',') {
      candidate += char;
    }
  }

  if (!candidate) return null;

  const lastDot = candidate.lastIndexOf('.');
  const lastComma = candidate.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);

  let integerDigits = '';
  let fractionDigits = '';

  for (let index = 0; index < candidate.length; index += 1) {
    const char = candidate[index];
    const isDigit = char >= '0' && char <= '9';
    if (!isDigit) continue;

    if (decimalIndex !== -1 && index > decimalIndex) {
      fractionDigits += char;
    } else {
      integerDigits += char;
    }
  }

  if (!integerDigits && !fractionDigits) return null;

  const normalized = fractionDigits
    ? `${integerDigits || '0'}.${fractionDigits}`
    : (integerDigits || '0');

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function isValidPhoneValue(value) {
  if (typeof value !== 'string') return false;

  let digits = 0;
  for (const char of value) {
    if (char >= '0' && char <= '9') digits += 1;
  }

  return digits === 8;
}

function applyZRule(schema, rule) {
  if (!rule || typeof rule !== 'object') return schema;

  switch (rule.rule) {
    case 'min':
      if (typeof schema.min === 'function') {
        return schema.min(rule.value, rule.message);
      }
      return schema;
    case 'max':
      if (typeof schema.max === 'function') {
        return schema.max(rule.value, rule.message);
      }
      return schema;
    case 'minItems':
      if (typeof schema.min === 'function') {
        return schema.min(rule.value, rule.message);
      }
      return schema;
    case 'maxItems':
      if (typeof schema.max === 'function') {
        return schema.max(rule.value, rule.message);
      }
      return schema;
    case 'regex':
      if (typeof schema.regex === 'function' && typeof rule.pattern === 'string') {
        return schema.regex(new RegExp(rule.pattern, rule.flags || ''), rule.message);
      }
      return schema;
    case 'email':
      if (typeof schema.email === 'function') {
        return schema.email(rule.message || 'Formato de correo invalido');
      }
      return schema;
    case 'minValue':
      return schema.refine((value) => {
        if (value === '' || value == null) return true;
        const parsedValue = parsePriceValue(value);
        if (parsedValue === null) return false;
        return parsedValue >= Number(rule.value);
      }, { message: rule.message || `El valor minimo permitido es ${rule.value}` });
    case 'maxValue':
      return schema.refine((value) => {
        if (value === '' || value == null) return true;
        const parsedValue = parsePriceValue(value);
        if (parsedValue === null) return false;
        return parsedValue <= Number(rule.value);
      }, { message: rule.message || `El valor maximo permitido es ${rule.value}` });
    case 'enum':
      if (!Array.isArray(rule.options) || rule.options.length === 0) return schema;
      return schema.refine(
        (value) => value === '' || value == null || rule.options.includes(value),
        { message: rule.message || 'Selecciona una opcion valida' },
      );
    default:
      return schema;
  }
}

function buildQuestionSchema(question) {
  const questionType = normalizeQuestionType(question?.type);
  let schema;

  switch (questionType) {
    case 'checkbox':
      schema = z.array(z.string());
      break;
    case 'email':
      schema = z.string().email('Ingresa un correo electronico valido');
      break;
    case 'telefono':
      schema = z.string().refine((value) => isValidPhoneValue(value), {
        message: 'Ingresa un telefono valido',
      });
      break;
    case 'date':
      schema = z.string().refine((value) => isValidMaskedDate(value), {
        message: 'Ingresa una fecha valida (YYYY-MM-DD)',
      });
      break;
    case 'date-time':
      schema = z.string().refine((value) => isValidMaskedDateTime(value), {
        message: 'Ingresa una fecha y hora valida (YYYY-MM-DD HH:mm)',
      });
      break;
    case 'price':
      schema = z.string().refine((value) => parsePriceValue(value) !== null, {
        message: 'Ingresa un monto valido',
      });
      break;
    default:
      schema = z.string();
  }

  const rules = Array.isArray(question?.validation?.z) ? question.validation.z : [];
  for (const rule of rules) {
    schema = applyZRule(schema, rule);
  }

  if (question.required) {
    if (questionType === 'checkbox') {
      return schema.min(1, question.required_message || 'Este campo es obligatorio');
    }

    return schema.refine(
      (value) => typeof value === 'string' && value.trim().length > 0,
      { message: question.required_message || 'Este campo es obligatorio' },
    );
  }

  if (questionType === 'checkbox') {
    return z.union([schema, z.undefined(), z.null()]).transform((value) => {
      if (Array.isArray(value)) return value;
      return [];
    });
  }

  return z.union([schema, z.literal(''), z.undefined(), z.null()]).transform((value) => {
    if (value === undefined || value === null) return '';
    return value;
  });
}

function validateAnswersAgainstConfig(config, answers) {
  const steps = Array.isArray(config?.steps) ? config.steps : [];
  const fieldErrors = {};

  for (const step of steps) {
    if (!Array.isArray(step.questions)) continue;

    for (const question of step.questions) {
      if (!question?.id) continue;

      const schema = buildQuestionSchema(question);
      const result = schema.safeParse(answers[question.id]);

      if (!result.success && result.error.issues.length > 0) {
        fieldErrors[question.id] = [result.error.issues[0].message];
      }
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

// ─────────────────────────────────────────────────────────
// Utilidades internas
// ─────────────────────────────────────────────────────────

/**
 * Extrae preguntas requeridas de todos los pasos del formulario.
 * @param {object} config
 * @returns {string[]} - IDs de preguntas required
 */
function getRequiredQuestionIds(config) {
  const required = [];
  const steps = config?.steps ?? [];
  for (const step of steps) {
    if (!step.questions) continue;
    for (const q of step.questions) {
      if (q.required) required.push(q.id);
    }
  }
  return required;
}

/**
 * Valida que todas las preguntas required tengan respuesta.
 * @param {string[]} requiredIds
 * @param {object}   answers
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateRequiredAnswers(requiredIds, answers) {
  const missing = requiredIds.filter((id) => {
    const val = answers[id];
    if (val === undefined || val === null) return true;
    if (typeof val === 'string')  return val.trim() === '';
    if (Array.isArray(val))       return val.length === 0;
    return false;
  });
  return { valid: missing.length === 0, missing };
}

function getSubmissionPolicy(config) {
  const rawPolicy = (config && typeof config.submission_policy === 'object' && config.submission_policy)
    ? config.submission_policy
    : null;

  if (!rawPolicy) {
    return {
      enabled: false,
      identifierStrategy: 'ip',
      identifierHeader: 'x-form-identifier',
      allowReactivation: true,
    };
  }

  const rawEnabled = rawPolicy.enabled;
  const rawOnce = rawPolicy.once_per_identifier;
  const enabled = rawEnabled === true || rawOnce === true;

  const rawStrategy = String(rawPolicy.identifier_strategy || '').trim().toLowerCase();
  const allowedStrategies = new Set(['ip', 'header', 'ip_then_header', 'header_then_ip']);
  const identifierStrategy = allowedStrategies.has(rawStrategy) ? rawStrategy : 'ip';

  const rawHeader = String(rawPolicy.identifier_header || '').trim().toLowerCase();
  const identifierHeader = rawHeader || 'x-form-identifier';

  return {
    enabled,
    identifierStrategy,
    identifierHeader,
    allowReactivation: rawPolicy.allow_reactivation !== false,
  };
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0] || '').trim() : '';
  }
  return String(value || '').trim();
}

function resolveClientIp(rawReq) {
  const forwarded = firstHeaderValue(rawReq?.headers?.['x-forwarded-for']);
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const realIp = firstHeaderValue(rawReq?.headers?.['x-real-ip']);
  if (realIp) return realIp;

  const reqIp = firstHeaderValue(rawReq?.ip);
  if (reqIp) return reqIp;

  return '';
}

function buildAnonymousIdentifier(rawReq) {
  const userAgent = firstHeaderValue(rawReq?.headers?.['user-agent']);
  const language = firstHeaderValue(rawReq?.headers?.['accept-language']);
  const basis = `${userAgent}|${language}`;

  if (!basis.replace(/\|/g, '').trim()) {
    return '';
  }

  const hash = crypto.createHash('sha256').update(basis).digest('hex').slice(0, 40);
  return `anon:${hash}`;
}

function normalizeIdentifier(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean.toLowerCase().slice(0, 191);
}

function resolveSubmissionIdentifier(rawReq, policy) {
  const ip = resolveClientIp(rawReq);
  const headerRaw = firstHeaderValue(rawReq?.headers?.[policy.identifierHeader]);
  const headerIdentifier = normalizeIdentifier(headerRaw);

  let candidate = '';

  switch (policy.identifierStrategy) {
    case 'header':
      candidate = headerIdentifier;
      break;
    case 'header_then_ip':
      candidate = headerIdentifier || normalizeIdentifier(ip);
      break;
    case 'ip_then_header':
      candidate = normalizeIdentifier(ip) || headerIdentifier;
      break;
    case 'ip':
    default:
      candidate = normalizeIdentifier(ip);
      break;
  }

  if (candidate) {
    return {
      value: candidate,
      source: candidate === headerIdentifier ? 'header' : 'ip',
    };
  }

  const anonymousIdentifier = normalizeIdentifier(buildAnonymousIdentifier(rawReq));
  if (anonymousIdentifier) {
    return {
      value: anonymousIdentifier,
      source: 'anonymous-fingerprint',
    };
  }

  return {
    value: '',
    source: 'none',
  };
}

async function findActiveSubmissionLock(formId, identifier) {
  return FormSubmission.findOne({
    where: {
      form_id: formId,
      submission_identifier: identifier,
      submission_lock_active: true,
    },
    order: [['created_at', 'DESC']],
  });
}

// ─────────────────────────────────────────────────────────
// Rutas públicas
// ─────────────────────────────────────────────────────────

/**
 * Obtiene un formulario activo por su slug (ruta pública).
 * Retorna null si no existe o está inactivo.
 */
async function getFormBySlug(slug) {
  return Form.findOne({
    where:   { slug, is_active: true },
    include: [{ model: FormTemplate, as: 'template', attributes: ['name', 'slug'] }],
  });
}

/**
 * Guarda las respuestas de un usuario.
 * Valida preguntas required antes de persistir.
 *
 * @param {Form}   form
 * @param {object} answers   - { "q1": "...", "q2": [...] }
 * @param {object} rawReq    - Express request (para extraer metadata)
 * @returns {{ submission: FormSubmission, warnings: string[] }}
 */
async function submitForm(form, answers, rawReq) {
  const submissionPolicy = getSubmissionPolicy(form.config);
  const identifier = resolveSubmissionIdentifier(rawReq, submissionPolicy);

  if (submissionPolicy.enabled) {
    if (!identifier.value) {
      const err = new Error('No fue posible identificar al usuario para validar envios unicos');
      err.statusCode = 422;
      err.fieldErrors = {
        _submission: ['No fue posible identificar al usuario para validar envios unicos'],
      };
      throw err;
    }

    const lock = await findActiveSubmissionLock(form.id, identifier.value);
    if (lock) {
      const err = new Error('Este formulario ya fue enviado por este usuario. Solicita reactivacion para reenviar.');
      err.statusCode = 409;
      err.code = 'FORM_ALREADY_SUBMITTED';
      err.reactivationRequired = submissionPolicy.allowReactivation;
      err.lock = {
        submissionId: lock.id,
        identifier: identifier.value,
      };
      throw err;
    }
  }

  const requiredIds = getRequiredQuestionIds(form.config);
  const { valid, missing } = validateRequiredAnswers(requiredIds, answers);

  if (!valid) {
    const err = new Error('Preguntas requeridas sin respuesta');
    err.statusCode  = 422;
    err.missingFields = missing;
    throw err;
  }

  const zValidation = validateAnswersAgainstConfig(form.config, answers);
  if (!zValidation.valid) {
    const err = new Error('Error de validacion en campos del formulario');
    err.statusCode = 422;
    err.fieldErrors = zValidation.fieldErrors;
    throw err;
  }

  const metadata = {
    ip:           rawReq.ip || rawReq.headers['x-forwarded-for'] || null,
    user_agent:   rawReq.headers['user-agent'] || null,
    utm_source:   rawReq.query.utm_source   || null,
    utm_medium:   rawReq.query.utm_medium   || null,
    utm_campaign: rawReq.query.utm_campaign || null,
    submitted_at: new Date().toISOString(),
    submission_lock: submissionPolicy.enabled ? {
      enabled: true,
      identifier: identifier.value,
      identifier_source: identifier.source,
      active: true,
    } : {
      enabled: false,
    },
  };

  const submission = await FormSubmission.create({
    form_id:  form.id,
    answers,
    metadata,
    submission_identifier: submissionPolicy.enabled ? identifier.value : null,
    submission_identifier_source: submissionPolicy.enabled ? identifier.source : null,
    submission_lock_active: submissionPolicy.enabled,
    submission_lock_reactivated_at: null,
  });

  return { submission, warnings: [] };
}

// ─────────────────────────────────────────────────────────
// Admin — Forms CRUD
// ─────────────────────────────────────────────────────────

/**
 * Lista todos los formularios con paginación.
 */
async function listForms({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  return Form.findAndCountAll({
    order:      [['created_at', 'DESC']],
    limit,
    offset,
    include:    [{ model: FormTemplate, as: 'template', attributes: ['name', 'slug'] }],
    attributes: { exclude: ['config'] }, // Config excluida del listado por peso
  });
}

/**
 * Crea un nuevo formulario. Slug debe ser único.
 */
async function createForm({ title, slug, template_id, config, is_active }) {
  const finalSlug = slugify(slug) || await generateUniqueSlug(title);

  const existing = await Form.findOne({ where: { slug: finalSlug } });
  if (existing) {
    const err = new Error(`El slug '${finalSlug}' ya está en uso`);
    err.statusCode = 409;
    throw err;
  }

  return Form.create({
    title,
    slug: finalSlug,
    template_id: template_id || null,
    config: config || { steps: [] },
    is_active: is_active ?? true,
  });
}

/**
 * Obtiene un formulario por ID (incluye config completa).
 */
async function getFormById(id) {
  return Form.findByPk(id, {
    include: [{ model: FormTemplate, as: 'template', attributes: ['name', 'slug'] }],
  });
}

/**
 * Actualiza title, slug, config o is_active de un formulario.
 */
async function updateForm(id, { title, slug, template_id, config, is_active }) {
  const form = await Form.findByPk(id);
  if (!form) return null;

  const nextSlug = slug ? slugify(slug) : null;

  // Verificar unicidad de slug si cambia
  if (nextSlug && nextSlug !== form.slug) {
    const conflict = await Form.findOne({ where: { slug: nextSlug, id: { [Op.ne]: id } } });
    if (conflict) {
      const err = new Error(`El slug '${nextSlug}' ya está en uso`);
      err.statusCode = 409;
      throw err;
    }
  }

  await form.update({
    ...(title       != null && { title }),
    ...(nextSlug    != null && { slug: nextSlug }),
    ...(template_id !== undefined && { template_id }),
    ...(config      != null && { config }),
    ...(is_active   != null && { is_active }),
  });

  return form.reload();
}

/**
 * Desactiva (soft-delete) un formulario.
 */
async function deactivateForm(id) {
  const form = await Form.findByPk(id);
  if (!form) return null;
  await form.update({ is_active: false });
  return form;
}

// ─────────────────────────────────────────────────────────
// Admin — Submissions
// ─────────────────────────────────────────────────────────

/**
 * Lista submissions de un formulario con paginación.
 */
async function listSubmissionsByForm(formId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  return FormSubmission.findAndCountAll({
    where:  { form_id: formId },
    order:  [['created_at', 'DESC']],
    limit,
    offset,
  });
}

/**
 * Obtiene el detalle completo de una submission.
 */
async function getSubmissionById(id) {
  return FormSubmission.findByPk(id, {
    include: [{ model: Form, as: 'form', attributes: ['id', 'title', 'slug'] }],
  });
}

/**
 * Reactiva reenvio para el identificador asociado a una submission.
 * Desbloquea todas las submissions activas de ese identificador en ese formulario.
 */
async function reactivateSubmissionLock(submissionId, { reactivatedBy = null } = {}) {
  const baseSubmission = await FormSubmission.findByPk(submissionId);
  if (!baseSubmission) return null;

  const identifier = String(baseSubmission.submission_identifier || '').trim();
  if (!identifier) {
    return {
      submission: baseSubmission,
      unlockedCount: 0,
      identifier: null,
    };
  }

  const now = new Date();

  const [unlockedCount] = await FormSubmission.update({
    submission_lock_active: false,
    submission_lock_reactivated_at: now,
  }, {
    where: {
      form_id: baseSubmission.form_id,
      submission_identifier: identifier,
      submission_lock_active: true,
    },
  });

  const metadata = baseSubmission.metadata && typeof baseSubmission.metadata === 'object'
    ? { ...baseSubmission.metadata }
    : {};

  metadata.submission_lock = {
    ...(metadata.submission_lock && typeof metadata.submission_lock === 'object' ? metadata.submission_lock : {}),
    active: false,
    reactivated_at: now.toISOString(),
    reactivated_by: reactivatedBy,
  };

  await baseSubmission.update({ metadata });

  return {
    submission: await getSubmissionById(submissionId),
    unlockedCount,
    identifier,
  };
}

module.exports = {
  // Públicas
  getFormBySlug,
  submitForm,
  // Admin — forms
  listForms,
  createForm,
  getFormById,
  updateForm,
  deactivateForm,
  // Admin — submissions
  listSubmissionsByForm,
  getSubmissionById,
  reactivateSubmissionLock,
};
