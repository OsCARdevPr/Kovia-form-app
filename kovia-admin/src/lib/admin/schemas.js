import { z } from 'zod';

export const adminUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  is_active: z.boolean().optional(),
  last_login_at: z.string().nullable().optional(),
});

export const successEnvelopeSchema = z.object({
  status: z.literal('success'),
  message: z.string(),
  data: z.any().optional(),
});

export const errorEnvelopeSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
  errors: z.any().optional(),
});

export const apiEnvelopeSchema = z.union([successEnvelopeSchema, errorEnvelopeSchema]);

export const authResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    user: adminUserSchema,
  }),
});

export const formsAccessResponseSchema = successEnvelopeSchema.extend({
  data: z
    .object({
      items: z.array(z.any()).optional(),
    })
    .passthrough()
    .optional(),
});
