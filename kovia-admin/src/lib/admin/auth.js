import { request } from './client';
import { authResponseSchema, formsAccessResponseSchema } from './schemas';

export async function loginAdmin(credentials) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });

  return authResponseSchema.parse(payload).data.user;
}

export async function getCurrentAdmin() {
  const payload = await request('/api/auth/me');
  return authResponseSchema.parse(payload).data.user;
}

export async function logoutAdmin() {
  await request('/api/auth/logout', {
    method: 'POST',
    body: {},
  });
}

export async function verifyAdminAccess() {
  const payload = await request('/api/admin/forms?limit=1');
  return formsAccessResponseSchema.parse(payload);
}
