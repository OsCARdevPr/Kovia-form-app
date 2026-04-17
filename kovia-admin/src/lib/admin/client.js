import { apiEnvelopeSchema } from './schemas';

const API_BASE = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000';

function toRequestError(message, status, errors = null) {
  const error = new Error(message || 'Request failed');
  error.status = status;
  error.errors = errors;
  return error;
}

export async function request(path, options = {}) {
  const { body, headers, method = 'GET' } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body,
  });

  const raw = await response.text();
  let payload = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  const parsed = apiEnvelopeSchema.safeParse(payload);

  if (!response.ok) {
    if (parsed.success && parsed.data.status === 'error') {
      throw toRequestError(parsed.data.message, response.status, parsed.data.errors || null);
    }

    throw toRequestError('Could not complete request', response.status);
  }

  if (!parsed.success || parsed.data.status !== 'success') {
    throw toRequestError('Unexpected API response', response.status || 500);
  }

  return parsed.data;
}
