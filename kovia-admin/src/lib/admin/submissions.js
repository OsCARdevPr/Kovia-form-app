import { request } from './client';

function toQueryString(query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export async function listSubmissions(params = {}) {
  const payload = await request(`/api/admin/submissions${toQueryString(params)}`);
  return payload.data;
}

export async function getSubmission(id) {
  const payload = await request(`/api/admin/submissions/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function reactivateSubmission(id) {
  const payload = await request(`/api/admin/submissions/${encodeURIComponent(id)}/reactivate`, {
    method: 'POST',
  });
  return payload.data;
}
