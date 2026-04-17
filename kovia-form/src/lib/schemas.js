// src/lib/schemas.js
// Esquemas de validación Zod para cada step del Discovery Form
import { z } from 'zod';

// ── Step 1: Datos del negocio ─────────────────────────────
export const step1Schema = z.object({
  negocio_nombre: z.string().min(2, 'El nombre del negocio es obligatorio (mín. 2 caracteres)'),
  responsable_nombre: z.string().min(2, 'El nombre del responsable es obligatorio'),
  whatsapp: z
    .string()
    .refine((value) => isValidPhoneValue(value), 'Ingresa un número de WhatsApp válido (8 dígitos)'),
  descripcion_negocio: z.string().min(10, 'Describe brevemente tu negocio (mín. 10 caracteres)'),
  tiempo_operando: z.enum(
    ['Menos de 6 meses', '6 meses–1 año', '1–3 años', 'Más de 3 años'],
    { errorMap: () => ({ message: 'Selecciona una opción' }) }
  ),
});

// ── Step 2: Canales de adquisición ────────────────────────
export const step2Schema = z.object({
  canales_clientes: z
    .array(z.string())
    .min(1, 'Selecciona al menos un canal'),
  canales_clientes_otro: z.string().optional(),
  canal_principal: z.string().min(1, 'Indica tu canal principal'),
  accion_cliente: z.string().min(5, 'Describe la primera acción del cliente'),
  leads_semana: z.enum(
    ['1–10', '10–30', '30–80', '80–200', '+200'],
    { errorMap: () => ({ message: 'Selecciona un rango' }) }
  ),
  momento_leads: z.string().optional(),
});

// ── Step 3: Atención y cierre ─────────────────────────────
export const step3Schema = z.object({
  quien_atiende: z.enum(
    ['Solo el dueño', 'Un empleado', 'Equipo de ventas', 'Bot'],
    { errorMap: () => ({ message: 'Selecciona una opción' }) }
  ),
  como_cierran: z.array(z.string()).min(1, 'Selecciona al menos una opción'),
  mensajes_compra: z.enum(
    ['1–3', '4–7', '8–15', '+15'],
    { errorMap: () => ({ message: 'Selecciona un rango' }) }
  ),
  tiempo_cierre: z.enum(
    ['Minutos', '1–2 hrs', 'Mismo día', '1–3 días', '+3 días'],
    { errorMap: () => ({ message: 'Selecciona una opción' }) }
  ),
  catalogo: z.array(z.string()).min(1, 'Selecciona al menos una opción'),
  envio_material: z.string().optional(),
  seguimiento_lead: z.string().optional(),
});

// ── Step 4: Logística y datos de envío ───────────────────
export const step4Schema = z.object({
  recoleccion_datos: z.enum(
    [
      'Por chat uno a uno',
      'Formulario externo',
      'Formulario de la plataforma',
      'El cliente escribe libremente',
      'Por mensaje, el cliente envía todos los datos juntos',
    ],
    { errorMap: () => ({ message: 'Selecciona una opción' }) }
  ),
  tiempo_recoleccion: z.string().optional(),
  empresa_logistica: z.string().min(1, 'Indica tu empresa de logística'),
  creacion_guia: z.string().optional(),
  tiempo_guia: z.string().optional(),
});

// ── Step 5: Sistemas y herramientas ──────────────────────
export const step5Schema = z.object({
  herramientas: z.array(z.string()).min(1, 'Selecciona al menos una herramienta'),
  herramientas_otro: z.string().optional(),
  sistemas_pedido: z.enum(
    ['1', '2', '3', '4+'],
    { errorMap: () => ({ message: 'Selecciona una opción' }) }
  ),
  seguimiento_pedidos: z.string().optional(),
});

// ── Step 6: Cobro y post-venta ───────────────────────────
export const step6Schema = z.object({
  como_cobras: z.array(z.string()).min(1, 'Selecciona al menos una forma de cobro'),
  confirmacion_pago: z.string().min(5, 'Describe cómo confirmas los pagos'),
  devolucion: z.string().optional(),
  tasa_conversion: z.enum(
    ['Sí formalmente', 'A veces', 'No'],
    { errorMap: () => ({ message: 'Selecciona una opción' }) }
  ),
});

// ── Step 7: Contexto de mejora ───────────────────────────
export const step7Schema = z.object({
  paso_mas_tiempo: z.string().min(5, 'Comparte qué paso te quita más tiempo'),
  pierdes_ventas: z.string().min(5, 'Cuéntanos dónde sientes que pierdes ventas'),
  intento_mejorar: z.string().optional(),
  algo_agregar: z.string().optional(),
});

// Mapa de schemas por step
export const stepSchemas = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
  5: step5Schema,
  6: step6Schema,
  7: step7Schema,
};

const FIELD_TYPE_ALIASES = Object.freeze({
  tel: 'telefono',
  phone: 'telefono',
  datetime: 'date-time',
  date_time: 'date-time',
});

function normalizeFieldType(type) {
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

function applyDynamicZRule(schema, rule) {
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
        return schema.email(rule.message || 'Correo invalido');
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
        { message: rule.message || 'Selecciona una opcion valida' }
      );
    default:
      return schema;
  }
}

function buildFieldSchema(question) {
  const fieldType = normalizeFieldType(question?.type);
  let schema;

  if (fieldType === 'checkbox') {
    schema = z.array(z.string());
  } else if (fieldType === 'email') {
    schema = z.string().email('Ingresa un correo electronico valido');
  } else if (fieldType === 'telefono') {
    schema = z.string().refine((value) => isValidPhoneValue(value), {
      message: 'Ingresa un telefono valido',
    });
  } else if (fieldType === 'date') {
    schema = z.string().refine((value) => isValidMaskedDate(value), {
      message: 'Ingresa una fecha valida (YYYY-MM-DD)',
    });
  } else if (fieldType === 'date-time') {
    schema = z.string().refine((value) => isValidMaskedDateTime(value), {
      message: 'Ingresa una fecha y hora valida (YYYY-MM-DD HH:mm)',
    });
  } else if (fieldType === 'price') {
    schema = z.string().refine((value) => parsePriceValue(value) !== null, {
      message: 'Ingresa un monto valido',
    });
  } else {
    schema = z.string();
  }

  const rules = Array.isArray(question?.validation?.z) ? question.validation.z : [];
  for (const rule of rules) {
    schema = applyDynamicZRule(schema, rule);
  }

  if (fieldType !== 'checkbox' && Array.isArray(question?.options) && question.options.length > 0) {
    schema = schema.refine(
      (value) => value === '' || value == null || question.options.includes(value),
      { message: 'Selecciona una opcion valida' }
    );
  }

  if (question?.required) {
    if (fieldType === 'checkbox') {
      return schema.min(1, question.required_message || 'Selecciona al menos una opcion');
    }

    return schema.refine(
      (value) => typeof value === 'string' && value.trim().length > 0,
      { message: question.required_message || 'Este campo es obligatorio' }
    );
  }

  if (fieldType === 'checkbox') {
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

export function buildStepSchemasFromConfig(config) {
  const steps = Array.isArray(config?.steps) ? config.steps : [];
  const dynamicSchemas = {};

  for (const step of steps) {
    if (!Array.isArray(step?.questions) || step.questions.length === 0) continue;

    const shape = {};
    for (const question of step.questions) {
      if (!question?.id) continue;
      shape[question.id] = buildFieldSchema(question);
    }

    const stepOrder = Number(step.order);
    if (Number.isFinite(stepOrder) && Object.keys(shape).length > 0) {
      dynamicSchemas[stepOrder] = z.object(shape);
    }
  }

  return dynamicSchemas;
}
