// src/lib/schemas.js
// Esquemas de validación Zod para cada step del Discovery Form
import { z } from 'zod';

// ── Step 1: Datos del negocio ─────────────────────────────
export const step1Schema = z.object({
  negocio_nombre: z.string().min(2, 'El nombre del negocio es obligatorio (mín. 2 caracteres)'),
  responsable_nombre: z.string().min(2, 'El nombre del responsable es obligatorio'),
  whatsapp: z
    .string()
    .min(7, 'Ingresa un número de WhatsApp válido')
    .regex(/^[+\d\s\-()]{7,20}$/, 'Formato inválido. Ej: +503 7777 1234'),
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
  const fieldType = question?.type;
  let schema;

  if (fieldType === 'checkbox') {
    schema = z.array(z.string());
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
