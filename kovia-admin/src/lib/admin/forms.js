import { request } from './client';
import {
  createFormResponseSchema,
  createTemplateResponseSchema,
  exportFormResponseSchema,
  formAiContextMarkdownResponseSchema,
  formDetailResponseSchema,
  importGuidelinesResponseSchema,
  importFormResponseSchema,
  listFormsResponseSchema,
  listTemplatesResponseSchema,
  validateFormConfigResponseSchema,
} from './schemas';

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

export async function listTemplates(options = {}) {
  const payload = await request(`/api/admin/forms/templates${toQueryString(options)}`);
  return listTemplatesResponseSchema.parse(payload).data;
}

export async function createTemplate(body) {
  const payload = await request('/api/admin/forms/templates', {
    method: 'POST',
    body,
  });

  return createTemplateResponseSchema.parse(payload).data;
}

export async function listForms(options = {}) {
  const payload = await request(`/api/admin/forms${toQueryString(options)}`);
  return listFormsResponseSchema.parse(payload).data;
}

export async function getFormById(id) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}`);
  return formDetailResponseSchema.parse(payload).data;
}

export async function createForm(body) {
  const payload = await request('/api/admin/forms', {
    method: 'POST',
    body,
  });

  return createFormResponseSchema.parse(payload).data;
}

export async function updateForm(id, body) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });

  return formDetailResponseSchema.parse(payload).data;
}

export async function deleteForm(id) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  return payload.data;
}

export async function deleteFormPermanently(id) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}/permanent`, {
    method: 'DELETE',
  });

  return payload.data;
}

export async function archiveFormSubmissions(id) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}/archive-submissions`, {
    method: 'POST',
  });

  return payload.data;
}

export async function archiveFormWebhooks(id) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}/archive-webhooks`, {
    method: 'POST',
  });

  return payload.data;
}

export async function importForm(body) {
  const payload = await request('/api/admin/forms/import', {
    method: 'POST',
    body,
  });

  return importFormResponseSchema.parse(payload).data;
}

export async function exportForm(id) {
  const payload = await request(`/api/admin/forms/${encodeURIComponent(id)}/export`);
  return exportFormResponseSchema.parse(payload).data;
}

export async function getImportGuidelines() {
  const payload = await request('/api/admin/forms/import-guidelines');
  return importGuidelinesResponseSchema.parse(payload).data;
}

export async function getFormAiContextMarkdown(id, options = {}) {
  const payload = await request(
    `/api/admin/forms/${encodeURIComponent(id)}/ai-context-markdown${toQueryString(options)}`,
  );
  return formAiContextMarkdownResponseSchema.parse(payload).data;
}

export async function validateFormConfig(config) {
  const payload = await request('/api/admin/forms/validate-config', {
    method: 'POST',
    body: { config },
  });

  return validateFormConfigResponseSchema.parse(payload).data;
}
