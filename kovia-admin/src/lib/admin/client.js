import axios from 'axios';
import { apiEnvelopeSchema } from './schemas';

const API_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000';
const REQUEST_TIMEOUT_MS = 15000;

function toRequestError(message, status, errors = null, code = '') {
  const error = new Error(message || 'No se pudo completar la solicitud');
  error.status = status;
  error.errors = errors;
  error.code = code;
  return error;
}

function parseErrorEnvelope(payload) {
  const parsed = apiEnvelopeSchema.safeParse(payload);

  if (parsed.success && parsed.data.status === 'error') {
    return parsed.data;
  }

  return null;
}

function normalizeTransportError(error) {
  if (!axios.isAxiosError(error)) {
    return toRequestError('No se pudo completar la solicitud', 0);
  }

  const status = error.response?.status || 0;
  const apiError = parseErrorEnvelope(error.response?.data);

  if (apiError) {
    return toRequestError(apiError.message, status, apiError.errors || null, apiError.code || '');
  }

  if (error.code === 'ECONNABORTED') {
    return toRequestError('La solicitud excedio el tiempo de espera', status || 408);
  }

  if (error.request && !error.response) {
    return toRequestError('No se recibio respuesta del servidor', 0);
  }

  return toRequestError(error.message, status);
}

export const adminApiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
  validateStatus: () => true,
});

adminApiClient.interceptors.request.use((config) => {
  const hasBody = config.data !== undefined && config.data !== null;
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

  if (!hasBody || isFormData) {
    return config;
  }

  if (typeof config.headers?.set === 'function') {
    config.headers.set('Content-Type', 'application/json');
    return config;
  }

  config.headers = {
    ...(config.headers || {}),
    'Content-Type': 'application/json',
  };

  return config;
});

export async function request(path, options = {}) {
  const { body, headers, method = 'GET', timeout } = options;

  try {
    const response = await adminApiClient.request({
      url: path,
      method,
      headers,
      data: body,
      ...(timeout ? { timeout } : {}),
    });

    const parsed = apiEnvelopeSchema.safeParse(response.data);

    if (response.status < 200 || response.status >= 300) {
      if (parsed.success && parsed.data.status === 'error') {
        throw toRequestError(parsed.data.message, response.status, parsed.data.errors || null, parsed.data.code || '');
      }

      throw toRequestError('No se pudo completar la solicitud', response.status);
    }

    if (!parsed.success || parsed.data.status !== 'success') {
      throw toRequestError('Respuesta inesperada del servidor', response.status || 500);
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error;
    }

    throw normalizeTransportError(error);
  }
}
