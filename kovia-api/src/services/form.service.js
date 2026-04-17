/* ========================================
   KOVIA API — services/form.service.js
   Lógica de negocio para formularios dinámicos.
   Todo acceso a DB vive aquí; controllers solo orquestan.
   ======================================== */
'use strict';

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
  let schema;

  switch (question.type) {
    case 'checkbox':
      schema = z.array(z.string());
      break;
    case 'email':
      schema = z.string();
      break;
    default:
      schema = z.string();
  }

  const rules = Array.isArray(question?.validation?.z) ? question.validation.z : [];
  for (const rule of rules) {
    schema = applyZRule(schema, rule);
  }

  if (question.required) {
    if (question.type === 'checkbox') {
      return schema.min(1, question.required_message || 'Este campo es obligatorio');
    }

    return schema.refine(
      (value) => typeof value === 'string' && value.trim().length > 0,
      { message: question.required_message || 'Este campo es obligatorio' },
    );
  }

  if (question.type === 'checkbox') {
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
  };

  const submission = await FormSubmission.create({
    form_id:  form.id,
    answers,
    metadata,
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
};
