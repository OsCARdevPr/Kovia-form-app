/* ========================================
   KOVIA API — utils/response.js
   Respuestas HTTP estandarizadas.

   Tres tipos posibles:
     R.success(res, 201, 'Mensaje', data)
     R.warning(res, 200, 'Mensaje', data, ['advertencia'])
     R.error(res, 422, 'Mensaje', errors)

   Estructura success:
     { status: 'success', message, data }

   Estructura warning:
     { status: 'warning', message, data, warnings: [] }

   Estructura error:
     { status: 'error', message, errors }
   ======================================== */
'use strict';

/**
 * Respuesta de éxito — operación completada correctamente.
 * @param {import('express').Response} res
 * @param {number}  httpStatus  - Código HTTP 2xx
 * @param {string}  message     - Mensaje descriptivo
 * @param {*}       [data]      - Payload de la respuesta
 */
function success(res, httpStatus, message, data = null) {
  return res.status(httpStatus).json({
    status:  'success',
    message,
    data,
  });
}

/**
 * Respuesta de advertencia — completada pero con condiciones a notar.
 * @param {import('express').Response} res
 * @param {number}   httpStatus
 * @param {string}   message
 * @param {*}        [data]
 * @param {string[]} [warnings]  - Lista de advertencias
 */
function warning(res, httpStatus, message, data = null, warnings = []) {
  return res.status(httpStatus).json({
    status: 'warning',
    message,
    data,
    warnings,
  });
}

/**
 * Respuesta de error — validación, negocio o servidor.
 * @param {import('express').Response} res
 * @param {number}  httpStatus  - Código HTTP 4xx / 5xx
 * @param {string}  message     - Mensaje descriptivo del error
 * @param {*}       [errors]    - Detalle de errores (e.g. Zod fieldErrors)
 * @param {string}  [code]      - Codigo opcional para clasificar error
 */
function error(res, httpStatus, message, errors = null, code = null) {
  const payload = {
    status: 'error',
    message,
    errors,
  };

  if (typeof code === 'string' && code.trim()) {
    payload.code = code.trim();
  }

  return res.status(httpStatus).json(payload);
}

module.exports = { success, warning, error };
