/* ========================================
   KOVIA API — services/form.service.js
   Lógica de negocio para formularios dinámicos.
   Todo acceso a DB vive aquí; controllers solo orquestan.
   ======================================== */
'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto        = require('crypto');
const { z }         = require('zod');
const { Op }        = require('sequelize');
const Form          = require('../models/Form');
const FormTemplate  = require('../models/FormTemplate');
const FormSubmission = require('../models/FormSubmission');
const WebhookFormConfig = require('../models/WebhookFormConfig');

const AI_CONTEXT_DIR = path.resolve(__dirname, '../../context/contexto-ia');
const LEGACY_CONTEXT_DIR = path.resolve(__dirname, '../../context');

const AI_CONTEXT_FILES = Object.freeze({
  importGuidelines: 'form-config-standard.md',
  formContextTemplate: 'form-ai-context-template.md',
});

const aiMarkdownCache = new Map();

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

const AUTO_FORM_SLUG_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const AUTO_FORM_SLUG_LENGTH = 10;

function createAutoFormSlugCandidate() {
  let output = '';
  for (let index = 0; index < AUTO_FORM_SLUG_LENGTH; index += 1) {
    const randomIndex = crypto.randomInt(0, AUTO_FORM_SLUG_CHARS.length);
    output += AUTO_FORM_SLUG_CHARS[randomIndex];
  }
  return output;
}

async function generateUniqueAutoFormSlug() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = createAutoFormSlugCandidate();
    const existing = await Form.findOne({ where: { slug: candidate } });
    if (!existing) {
      return candidate;
    }
  }

  const err = new Error('No se pudo generar un slug automático único');
  err.statusCode = 500;
  throw err;
}

async function generateUniqueTemplateSlug(name) {
  const base = slugify(name) || `template-${Date.now()}`;
  let slug = base;
  let suffix = 1;

  while (await FormTemplate.findOne({ where: { slug } })) {
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

const SUPPORTED_QUESTION_TYPES = Object.freeze([
  'text',
  'textarea',
  'radio',
  'checkbox',
  'select',
  'telefono',
  'email',
  'date',
  'date-time',
  'price',
]);

const zRuleSchema = z.object({
  rule: z.enum(['min', 'max', 'minItems', 'maxItems', 'regex', 'email', 'minValue', 'maxValue', 'enum']),
  value: z.any().optional(),
  pattern: z.string().optional(),
  flags: z.string().optional(),
  options: z.array(z.any()).optional(),
  message: z.string().optional(),
});

const sliderMarkSchema = z.object({
  value: z.coerce.number(),
  label: z.string().min(1, 'slider.marks.label es requerido'),
});

const sliderConfigSchema = z.object({
  min: z.coerce.number(),
  max: z.coerce.number(),
  step: z.coerce.number().positive().optional(),
  prefix: z.string().optional(),
  unitSuffix: z.string().optional(),
  showPlusAtMax: z.boolean().optional(),
  confirmLabel: z.string().optional(),
  marks: z.array(sliderMarkSchema).optional(),
}).superRefine((slider, ctx) => {
  if (!Number.isFinite(slider.min) || !Number.isFinite(slider.max)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'slider.min y slider.max deben ser numéricos',
    });
    return;
  }

  if (slider.max <= slider.min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'slider.max debe ser mayor que slider.min',
      path: ['max'],
    });
  }

  if (Array.isArray(slider.marks)) {
    for (const [index, mark] of slider.marks.entries()) {
      if (mark.value < slider.min || mark.value > slider.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'slider.marks.value debe estar dentro del rango min/max',
          path: ['marks', index, 'value'],
        });
      }
    }
  }
});

const questionConfigSchema = z.object({
  id: z.string().min(1, 'question.id es requerido'),
  type: z.string().min(1, 'question.type es requerido'),
  label: z.string().min(1, 'question.label es requerido'),
  placeholder: z.string().optional(),
  hint: z.string().optional(),
  required: z.boolean().optional().default(false),
  required_message: z.string().optional(),
  options: z.array(z.string()).optional(),
  mask: z.record(z.string(), z.any()).optional(),
  mask_preset: z.string().optional(),
  slider: sliderConfigSchema.optional(),
  validation: z.object({
    z: z.array(zRuleSchema).optional(),
  }).optional(),
  visible_when: z.object({
    field: z.string(),
    includes: z.any().optional(),
    equals: z.any().optional(),
    notEquals: z.any().optional(),
  }).optional(),
});

const stepConfigSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1, 'step.title es requerido'),
  short_label: z.string().optional(),
  questions: z.array(questionConfigSchema),
});

const formConfigSchema = z.object({
  version: z.number().int().positive().optional().default(1),
  validation_engine: z.string().optional().default('z-rules-v1'),
  field_type_index: z.record(z.string(), z.any()).optional().default({}),
  completion_action: z.record(z.string(), z.any()).optional(),
  submission_policy: z.object({
    enabled: z.boolean().optional(),
    once_per_identifier: z.boolean().optional(),
    identifier_strategy: z.enum(['ip', 'header', 'ip_then_header', 'header_then_ip']).optional(),
    identifier_header: z.string().optional(),
    allow_reactivation: z.boolean().optional(),
  }).optional(),
  steps: z.array(stepConfigSchema).optional().default([]),
}).superRefine((config, ctx) => {
  const seen = new Set();

  for (const [stepIndex, step] of config.steps.entries()) {
    for (const [questionIndex, question] of step.questions.entries()) {
      const normalizedType = normalizeQuestionType(question.type);
      if (!SUPPORTED_QUESTION_TYPES.includes(normalizedType)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `question.type no soportado: ${question.type}`,
          path: ['steps', stepIndex, 'questions', questionIndex, 'type'],
        });
      }

      if (question?.slider && normalizedType !== 'price') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'question.slider solo está permitido en preguntas de tipo price',
          path: ['steps', stepIndex, 'questions', questionIndex, 'slider'],
        });
      }

      const normalizedId = String(question.id || '').trim();
      if (!normalizedId) continue;

      if (seen.has(normalizedId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `question.id duplicado: ${normalizedId}`,
          path: ['steps', stepIndex, 'questions', questionIndex, 'id'],
        });
      }
      seen.add(normalizedId);
    }
  }
});

function normalizeQuestionType(type) {
  const rawType = String(type || '').trim().toLowerCase();
  return FIELD_TYPE_ALIASES[rawType] || rawType || 'text';
}

function toFieldErrorsFromZodError(error) {
  const fieldErrors = {};

  for (const issue of error.issues || []) {
    const key = issue.path && issue.path.length > 0
      ? issue.path.join('.')
      : '_form';

    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }

    fieldErrors[key].push(issue.message);
  }

  return fieldErrors;
}

function normalizeFormConfig(rawConfig) {
  const parsed = formConfigSchema.safeParse(rawConfig || {});
  if (!parsed.success) {
    const err = new Error('Configuración JSON de formulario inválida');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.fieldErrors = toFieldErrorsFromZodError(parsed.error);
    throw err;
  }

  const config = parsed.data;
  return {
    ...config,
    steps: config.steps.map((step) => ({
      ...step,
      questions: step.questions.map((question) => ({
        ...question,
        id: String(question.id).trim(),
        type: normalizeQuestionType(question.type),
      })),
    })),
  };
}

function buildConfigSummary(config) {
  const steps = Array.isArray(config?.steps) ? config.steps : [];
  let questions = 0;

  for (const step of steps) {
    if (Array.isArray(step?.questions)) {
      questions += step.questions.length;
    }
  }

  return {
    steps: steps.length,
    questions,
  };
}

async function validateFormConfig(rawConfig) {
  const normalizedConfig = normalizeFormConfig(rawConfig || {});

  return {
    normalizedConfig,
    summary: buildConfigSummary(normalizedConfig),
  };
}

async function ensureTemplateExists(templateId) {
  if (!templateId) return;

  const template = await FormTemplate.findByPk(templateId);
  if (!template) {
    const err = new Error('template_id no existe');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.fieldErrors = {
      template_id: ['template_id no existe'],
    };
    throw err;
  }
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
        return schema.email(rule.message || 'Formato de correo inválido');
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

  if (questionType === 'price' && question?.slider && typeof question.slider === 'object') {
    const sliderMin = Number(question.slider.min);
    const sliderMax = Number(question.slider.max);

    if (Number.isFinite(sliderMin)) {
      schema = schema.refine((value) => {
        if (value === '' || value == null) return true;
        const parsedValue = parsePriceValue(value);
        if (parsedValue === null) return false;
        return parsedValue >= sliderMin;
      }, { message: `El valor minimo permitido por slider es ${sliderMin}` });
    }

    if (Number.isFinite(sliderMax)) {
      schema = schema.refine((value) => {
        if (value === '' || value == null) return true;
        const parsedValue = parsePriceValue(value);
        if (parsedValue === null) return false;
        return parsedValue <= sliderMax;
      }, { message: `El valor maximo permitido por slider es ${sliderMax}` });
    }
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

async function readAiContextMarkdown(fileName, { legacyFileName = fileName } = {}) {
  const cacheKey = `${fileName}::${legacyFileName || ''}`;
  if (aiMarkdownCache.has(cacheKey)) {
    return aiMarkdownCache.get(cacheKey);
  }

  const candidatePaths = [
    path.resolve(AI_CONTEXT_DIR, fileName),
    ...(legacyFileName ? [path.resolve(LEGACY_CONTEXT_DIR, legacyFileName)] : []),
  ];

  let lastError = null;

  for (const filePath of candidatePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      aiMarkdownCache.set(cacheKey, content);
      return content;
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error(`No se encontro el markdown requerido: ${fileName}`);
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildPublicFormUrlForAiContext(slug, formUrlBase) {
  const cleanSlug = String(slug || '').trim();
  if (!cleanSlug) {
    return '(slug no disponible)';
  }

  if (!formUrlBase) {
    return '(FORM_URL_BASE no configurado)';
  }

  return `${formUrlBase}/${encodeURIComponent(cleanSlug)}`;
}

function buildPublicApiEndpointForAiContext(slug, adminApiBase, action = '') {
  const cleanSlug = String(slug || '').trim();
  const cleanAction = String(action || '').replace(/^\/+/, '');
  const suffix = cleanAction ? `/${cleanAction}` : '';

  if (!cleanSlug || !adminApiBase) {
    return cleanAction ? '/api/forms/:slug/submit' : '/api/forms/:slug';
  }

  return `${adminApiBase}/api/forms/${encodeURIComponent(cleanSlug)}${suffix}`;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function summarizeQuestionForAiContext(question) {
  const safeType = String(question?.type || 'text').trim() || 'text';
  const safeId = String(question?.id || '').trim() || 'sin_id';
  const safeLabel = String(question?.label || '').trim() || safeId;
  const requiredTag = question?.required ? 'requerido' : 'opcional';
  const sliderTag = question?.slider && typeof question.slider === 'object' ? ' | slider' : '';

  return `- ${safeId} (${safeType}${sliderTag}, ${requiredTag}): ${safeLabel}`;
}

function buildStepsBlockForAiContext(config) {
  const steps = Array.isArray(config?.steps) ? config.steps : [];
  const totalQuestions = steps.reduce((acc, step) => acc + (Array.isArray(step?.questions) ? step.questions.length : 0), 0);

  const stepsBlock = steps.length > 0
    ? steps.map((step, index) => {
      const stepOrder = Number(step?.order) || index + 1;
      const stepTitle = String(step?.title || `Paso ${stepOrder}`).trim() || `Paso ${stepOrder}`;
      const questions = Array.isArray(step?.questions) ? step.questions : [];
      const questionsBlock = questions.length > 0
        ? questions.map((question) => summarizeQuestionForAiContext(question)).join('\n')
        : '- Sin preguntas';

      return `### Paso ${stepOrder}: ${stepTitle}\n${questionsBlock}`;
    }).join('\n\n')
    : 'No hay pasos definidos en la configuracion actual.';

  return {
    steps,
    totalQuestions,
    stepsBlock,
  };
}

function applyAiTemplateValues(templateMarkdown, values) {
  let output = String(templateMarkdown || '');

  for (const [key, value] of Object.entries(values || {})) {
    output = output.split(`{{${key}}}`).join(String(value ?? ''));
  }

  return output;
}

/**
 * Obtiene markdown con el estandar de construccion de config JSON.
 */
async function getImportGuidelinesMarkdown() {
  return readAiContextMarkdown(AI_CONTEXT_FILES.importGuidelines, {
    legacyFileName: 'form-config-standard.md',
  });
}

async function getFormAiContextMarkdown(formId, { formUrlBase, adminApiBase } = {}) {
  const form = await getFormById(formId);
  if (!form) return null;

  const safeForm = form && typeof form === 'object' ? form : {};
  const safeConfig = safeForm.config && typeof safeForm.config === 'object' ? safeForm.config : {};
  const safeSlug = String(safeForm.slug || '').trim();
  const safeTitle = String(safeForm.title || 'Formulario').trim();
  const safeTemplateName = String(safeForm?.template?.name || 'Plantilla').trim();

  const normalizedFormUrlBase = normalizeBaseUrl(formUrlBase);
  const normalizedAdminApiBase = normalizeBaseUrl(adminApiBase);
  const { steps, totalQuestions, stepsBlock } = buildStepsBlockForAiContext(safeConfig);

  const templateMarkdown = await readAiContextMarkdown(AI_CONTEXT_FILES.formContextTemplate, {
    legacyFileName: null,
  });

  return applyAiTemplateValues(templateMarkdown, {
    FORM_TITLE: safeTitle,
    FORM_ID: safeForm.id || 'N/A',
    TEMPLATE_ID: safeForm.template_id || 'N/A',
    TEMPLATE_NAME: safeTemplateName,
    FORM_SLUG: safeSlug || 'N/A',
    FORM_STATUS: safeForm.is_active ? 'activo' : 'inactivo',
    CONFIG_VERSION: safeConfig.version || 1,
    TOTAL_STEPS: steps.length,
    TOTAL_QUESTIONS: totalQuestions,
    PUBLIC_FORM_URL: buildPublicFormUrlForAiContext(safeSlug, normalizedFormUrlBase),
    CONFIG_ENDPOINT: buildPublicApiEndpointForAiContext(safeSlug, normalizedAdminApiBase),
    SUBMIT_ENDPOINT: buildPublicApiEndpointForAiContext(safeSlug, normalizedAdminApiBase, 'submit'),
    STEPS_BLOCK: stepsBlock,
    FORM_CONFIG_JSON: safeJsonStringify(safeConfig),
    GENERATED_AT: new Date().toISOString(),
  });
}

/**
 * Extrae preguntas requeridas de todos los pasos del formulario.
 * @param {object} config
 * @returns {string[]} - IDs de preguntas required
 */
function getRequiredQuestionIds(config) {
  const required = [];
  const steps = config?.steps ?? [];
  for (const step of steps) {
    for (const q of step?.questions ?? []) {
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
 * Obtiene un formulario activo por slug de formulario.
 * Si no existe, intenta resolver por slug de template asociado.
 * Retorna null si no existe o está inactivo.
 */
async function getFormBySlug(slug) {
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!normalizedSlug) return null;

  const byFormSlug = await Form.findOne({
    where: { slug: normalizedSlug, is_active: true },
    include: [{ model: FormTemplate, as: 'template', attributes: ['name', 'slug'] }],
  });

  if (byFormSlug) return byFormSlug;

  return Form.findOne({
    where: { is_active: true },
    include: [{
      model: FormTemplate,
      as: 'template',
      attributes: ['name', 'slug'],
      required: true,
      where: { slug: normalizedSlug, is_active: true },
    }],
    order: [['updated_at', 'DESC']],
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
      const err = new Error('No fue posible identificar al usuario para validar envíos únicos');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      err.fieldErrors = {
        _submission: ['No fue posible identificar al usuario para validar envíos únicos'],
      };
      throw err;
    }

    const lock = await findActiveSubmissionLock(form.id, identifier.value);
    if (lock) {
      const err = new Error('Este formulario ya fue enviado por este usuario. Solicita reactivación para reenviar.');
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
    err.code = 'VALIDATION_ERROR';
    err.missingFields = missing;
    throw err;
  }

  const zValidation = validateAnswersAgainstConfig(form.config, answers);
  if (!zValidation.valid) {
    const err = new Error('Error de validación en campos del formulario');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
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
async function listForms({ page = 1, limit = 20, templateId, search, includeInactive = false, isActive } = {}) {
  const offset = (page - 1) * limit;
  const where = {};

  if (templateId) {
    where.template_id = templateId;
  }

  if (typeof isActive === 'boolean') {
    where.is_active = isActive;
  } else if (!includeInactive) {
    where.is_active = true;
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
    ];
  }

  return Form.findAndCountAll({
    where,
    order:      [['created_at', 'DESC']],
    limit,
    offset,
    include:    [{ model: FormTemplate, as: 'template', attributes: ['name', 'slug'] }],
    attributes: { exclude: ['config'] }, // Config excluida del listado por peso
  });
}

/**
 * Lista templates para la vista jerarquica de proyectos.
 */
async function listTemplates({ includeInactive = false } = {}) {
  const templates = await FormTemplate.findAll({
    where: includeInactive ? {} : { is_active: true },
    include: [{
      model: Form,
      as: 'forms',
      attributes: ['id', 'is_active'],
      required: false,
    }],
    order: [['name', 'ASC']],
  });

  return templates.map((template) => {
    const json = template.toJSON();
    const forms = Array.isArray(json.forms) ? json.forms : [];

    return {
      id: json.id,
      name: json.name,
      slug: json.slug,
      description: json.description,
      is_active: json.is_active,
      forms_count: forms.length,
      active_forms_count: forms.filter((form) => form.is_active !== false).length,
    };
  });
}

/**
 * Crea un template para agrupar formularios.
 */
async function createTemplate({ name, slug, description, is_active } = {}) {
  const finalSlug = slugify(slug) || await generateUniqueTemplateSlug(name);

  const existing = await FormTemplate.findOne({ where: { slug: finalSlug } });
  if (existing) {
    const err = new Error(`El slug de template '${finalSlug}' ya está en uso`);
    err.statusCode = 409;
    throw err;
  }

  const created = await FormTemplate.create({
    name,
    slug: finalSlug,
    description: description ?? null,
    is_active: is_active ?? true,
  });

  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    description: created.description,
    is_active: created.is_active,
    forms_count: 0,
    active_forms_count: 0,
  };
}

/**
 * Crea un nuevo formulario. Slug debe ser único.
 */
async function createForm({ title, slug, template_id, config, is_active, auto_generate_slug }) {
  const rawSlug = String(slug || '').trim();
  const normalizedManualSlug = rawSlug ? slugify(rawSlug) : '';
  const shouldAutoGenerateSlug = auto_generate_slug === true || auto_generate_slug === 'true';
  let finalSlug = normalizedManualSlug;

  if (rawSlug && !normalizedManualSlug) {
    const err = new Error('El campo "slug" es inválido');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.fieldErrors = {
      slug: ['El campo "slug" es inválido'],
    };
    throw err;
  }

  if (!finalSlug) {
    if (!shouldAutoGenerateSlug) {
      const err = new Error('El campo "slug" es requerido o habilita auto_generate_slug');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      err.fieldErrors = {
        slug: ['El campo "slug" es requerido'],
      };
      throw err;
    }

    finalSlug = await generateUniqueAutoFormSlug();
  }

  const normalizedConfig = normalizeFormConfig(config || { steps: [] });

  await ensureTemplateExists(template_id || null);

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
    config: normalizedConfig,
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

  if (template_id !== undefined) {
    await ensureTemplateExists(template_id || null);
  }

  const normalizedConfig = config != null ? normalizeFormConfig(config) : null;

  await form.update({
    ...(title       != null && { title }),
    ...(nextSlug    != null && { slug: nextSlug }),
    ...(template_id !== undefined && { template_id }),
    ...(normalizedConfig != null && { config: normalizedConfig }),
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

/**
 * Elimina permanentemente un formulario y sus submissions asociadas.
 */
async function deleteFormPermanently(id) {
  const form = await Form.findByPk(id);
  if (!form) return null;

  const deletedSubmissions = await FormSubmission.count({ where: { form_id: id } });
  const deletedWebhookConfigs = await WebhookFormConfig.count({ where: { form_id: id } });
  await form.destroy();

  return {
    id,
    deletedSubmissions,
    deletedWebhookConfigs,
  };
}

// ─────────────────────────────────────────────────────────
// Admin — Submissions
// ─────────────────────────────────────────────────────────

/**
 * Lista submissions de un formulario con paginación.
 */
async function listSubmissionsByForm(formId, { page = 1, limit = 20, include_archived = false } = {}) {
  const offset = (page - 1) * limit;

  const where = {
    form_id: formId,
    ...(include_archived ? {} : { is_archived: false }),
  };

  return FormSubmission.findAndCountAll({
    where,
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

/**
 * Archiva respuestas de un formulario.
 */
async function archiveSubmissionsByForm(formId) {
  const form = await Form.findByPk(formId);
  if (!form) return null;

  const total = await FormSubmission.count({ where: { form_id: formId } });
  const now = new Date();

  const [archivedCount] = await FormSubmission.update({
    is_archived: true,
    archived_at: now,
  }, {
    where: {
      form_id: formId,
      is_archived: false,
    },
  });

  return {
    form_id: formId,
    total,
    archivedCount,
    alreadyArchived: Math.max(0, total - archivedCount),
  };
}

/**
 * Archiva webhooks (configs activos) de un formulario.
 */
async function archiveWebhookConfigsByForm(formId) {
  const form = await Form.findByPk(formId);
  if (!form) return null;

  const total = await WebhookFormConfig.count({ where: { form_id: formId } });

  const [archivedCount] = await WebhookFormConfig.update({
    is_active: false,
  }, {
    where: {
      form_id: formId,
      is_active: true,
    },
  });

  return {
    form_id: formId,
    total,
    archivedCount,
    alreadyArchived: Math.max(0, total - archivedCount),
  };
}

/**
 * Exporta formulario como JSON para backup/edicion.
 */
async function exportFormAsJson(id) {
  const form = await getFormById(id);
  if (!form) return null;

  return {
    form: {
      id: form.id,
      title: form.title,
      slug: form.slug,
      template_id: form.template_id,
      is_active: form.is_active,
      created_at: form.created_at,
      updated_at: form.updated_at,
    },
    config: form.config,
  };
}

/**
 * Importa un form desde JSON.
 */
async function importFormFromJson(payload) {
  const rawJson = typeof payload?.json === 'string' ? payload.json.trim() : '';
  let importedPayload = payload && typeof payload === 'object' ? payload : {};

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Parsed JSON must be an object');
      }

      importedPayload = {
        ...parsed,
        title: payload?.title ?? parsed?.title,
        slug: payload?.slug ?? parsed?.slug,
        template_id: payload?.template_id ?? parsed?.template_id,
        is_active: payload?.is_active ?? parsed?.is_active,
      };
    } catch {
      const err = new Error('El campo "json" debe ser un JSON válido');
      err.statusCode = 422;
      err.code = 'VALIDATION_ERROR';
      err.fieldErrors = { json: ['El campo "json" debe ser un JSON válido'] };
      throw err;
    }
  }

  const title = String(importedPayload?.title || importedPayload?.form?.title || '').trim();
  const slug = String(importedPayload?.slug || importedPayload?.form?.slug || '').trim();
  const autoGenerateSlug = importedPayload?.auto_generate_slug === true
    || importedPayload?.auto_generate_slug === 'true'
    || importedPayload?.form?.auto_generate_slug === true
    || importedPayload?.form?.auto_generate_slug === 'true';
  const templateId = importedPayload?.template_id ?? importedPayload?.form?.template_id ?? null;
  const isActive = importedPayload?.is_active ?? importedPayload?.form?.is_active;

  const configInput = importedPayload?.config && typeof importedPayload.config === 'object'
    ? importedPayload.config
    : (importedPayload && typeof importedPayload === 'object' ? importedPayload : null);

  if (!title) {
    const err = new Error('El campo "title" es requerido para importar');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.fieldErrors = { title: ['El campo "title" es requerido para importar'] };
    throw err;
  }

  if (!configInput || typeof configInput !== 'object') {
    const err = new Error('El campo "config" es requerido para importar');
    err.statusCode = 422;
    err.code = 'VALIDATION_ERROR';
    err.fieldErrors = { config: ['El campo "config" es requerido para importar'] };
    throw err;
  }

  return createForm({
    title,
    slug,
    auto_generate_slug: autoGenerateSlug,
    template_id: templateId,
    config: configInput,
    is_active: isActive,
  });
}

/**
 * Lista TODAS las submissions con filtros globales.
 * Filtros: form_id, template_id, period ('24h'|'7d'|'30d'), search (en answers JSON serializado)
 */
async function listAllSubmissions({ page = 1, limit = 20, form_id, template_id, period, search, include_archived = false } = {}) {
  const safeLimit  = Math.min(100, Math.max(1, parseInt(limit)  || 20));
  const safePage   = Math.max(1, parseInt(page) || 1);
  const offset     = (safePage - 1) * safeLimit;

  const submissionWhere = {};
  const formWhere       = {};

  if (form_id) {
    submissionWhere.form_id = String(form_id).trim();
  }

  if (!include_archived) {
    submissionWhere.is_archived = false;
  }

  if (template_id) {
    formWhere.template_id = String(template_id).trim();
  }

  if (period) {
    const now = new Date();
    const periodMap = { '24h': 24, '7d': 168, '30d': 720 };
    const hours = periodMap[period];
    if (hours) {
      const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
      submissionWhere.created_at = { [Op.gte]: since };
    }
  }

  const { rows, count } = await FormSubmission.findAndCountAll({
    where: submissionWhere,
    include: [{
      model:    Form,
      as:       'form',
      where:    Object.keys(formWhere).length ? formWhere : undefined,
      required: Object.keys(formWhere).length > 0,
      attributes: ['id', 'title', 'slug'],
      include: [{
        model:      FormTemplate,
        as:         'template',
        attributes: ['id', 'name'],
      }],
    }],
    order:  [['created_at', 'DESC']],
    limit:  safeLimit,
    offset,
  });

  // Filtro de búsqueda en answers (post-query, Sequelize no hace full-text JSON portable)
  let items = rows;
  if (search) {
    const q = String(search).toLowerCase();
    items = rows.filter((s) => JSON.stringify(s.answers).toLowerCase().includes(q));
  }

  return {
    items,
    pagination: {
      total:      count,
      page:       safePage,
      limit:      safeLimit,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
}

module.exports = {
  // Públicas
  getFormBySlug,
  submitForm,
  // Admin — forms
  listTemplates,
  createTemplate,
  listForms,
  createForm,
  getFormById,
  updateForm,
  deactivateForm,
  deleteFormPermanently,
  exportFormAsJson,
  importFormFromJson,
  validateFormConfig,
  getImportGuidelinesMarkdown,
  getFormAiContextMarkdown,
  // Admin — submissions
  listSubmissionsByForm,
  listAllSubmissions,
  getSubmissionById,
  reactivateSubmissionLock,
  archiveSubmissionsByForm,
  archiveWebhookConfigsByForm,
};
