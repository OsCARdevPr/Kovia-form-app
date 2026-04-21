import { toast } from '@heroui/react';

function extractFirstFieldError(errors) {
  const fieldErrors = errors?.fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') {
    return '';
  }

  for (const value of Object.values(fieldErrors)) {
    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }
  }

  return '';
}

export function getApiErrorMessage(error, fallback = 'No se pudo completar la solicitud.') {
  if (!error) {
    return fallback;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  const firstFieldError = extractFirstFieldError(error.errors);
  if (firstFieldError) {
    return firstFieldError;
  }

  const formErrors = error?.errors?.formErrors;
  if (Array.isArray(formErrors) && formErrors.length > 0) {
    return String(formErrors[0]);
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

export function notifyError(error, fallback) {
  toast.danger(getApiErrorMessage(error, fallback));
}

export function notifySuccess(message) {
  toast.success(String(message || 'Operación completada correctamente.'));
}
