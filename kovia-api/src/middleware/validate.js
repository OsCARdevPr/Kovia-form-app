/* ========================================
   KOVIA API — middleware/validate.js
   Middleware genérico de validación Zod.

   Uso:
     const validate = require('../middleware/validate');
     const { mySchema } = require('../schemas/my.schema');

     router.post('/', validate(mySchema), controller.create);

   Efecto:
     - Si body es inválido → responde 422 con R.error (estructura estándar)
     - Si es válido       → adjunta req.validatedData con los datos limpios
                            y llama next()
   ======================================== */
'use strict';

const R = require('../utils/response');

/**
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
module.exports = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return R.error(
      res,
      422,
      'Error de validación en los datos enviados',
      result.error.flatten(),  // { fieldErrors: {...}, formErrors: [...] }
    );
  }

  // Datos limpios y coercionados por Zod — disponibles para el controller
  req.validatedData = result.data;
  next();
};
