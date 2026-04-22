import { request } from './client';

function toQueryString(query) {
  const params = new URLSearchParams();

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export async function listWebhooks() {
  const payload = await request('/api/admin/webhooks');
  return payload.data;
}

export async function createWebhook(data) {
  const payload = await request('/api/admin/webhooks', {
    method: 'POST',
    body: data,
  });
  return payload.data;
}

export async function getWebhookWithForms(id) {
  const payload = await request(`/api/admin/webhooks/${encodeURIComponent(id)}`);
  return payload.data;
}

export async function listWebhookLogs(webhookId, query = {}) {
  const payload = await request(
    `/api/admin/webhooks/${encodeURIComponent(webhookId)}/logs${toQueryString(query)}`,
  );
  return payload.data;
}

export async function retryWebhookLog(webhookId, logId) {
  const payload = await request(
    `/api/admin/webhooks/${encodeURIComponent(webhookId)}/logs/${encodeURIComponent(logId)}/retry`,
    { method: 'POST' },
  );
  return payload.data;
}

export async function updateWebhook(id, data) {
  const payload = await request(`/api/admin/webhooks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
  });
  return payload.data;
}

export async function deleteWebhook(id) {
  const payload = await request(`/api/admin/webhooks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return payload.data;
}

export async function upsertWebhookFormConfig(webhookId, formId, config) {
  const payload = await request(
    `/api/admin/webhooks/${encodeURIComponent(webhookId)}/forms/${encodeURIComponent(formId)}`,
    { method: 'PUT', body: config },
  );
  return payload.data;
}

export async function removeWebhookFormConfig(webhookId, formId) {
  const payload = await request(
    `/api/admin/webhooks/${encodeURIComponent(webhookId)}/forms/${encodeURIComponent(formId)}`,
    { method: 'DELETE' },
  );
  return payload.data;
}
