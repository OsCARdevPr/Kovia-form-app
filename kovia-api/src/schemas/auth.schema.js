/* ========================================
   KOVIA API — schemas/auth.schema.js
   Validaciones Zod para autenticación.
   ======================================== */
'use strict';

const { z } = require('zod');

const loginSchema = z.object({
  email: z
    .string({ required_error: 'El correo es requerido' })
    .trim()
    .min(1, 'El correo es requerido')
    .email('Ingresa un correo válido'),
  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

module.exports = {
  loginSchema,
};
