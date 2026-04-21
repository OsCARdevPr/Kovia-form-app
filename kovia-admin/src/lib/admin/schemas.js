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
  code: z.string().optional(),
  errors: z.any().optional(),
}).passthrough();

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

export const templateItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  is_active: z.boolean(),
  forms_count: z.number().int().nonnegative(),
  active_forms_count: z.number().int().nonnegative(),
});

export const listTemplatesResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    items: z.array(templateItemSchema),
    total: z.number().int().nonnegative(),
  }),
});

export const importGuidelinesResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    markdown: z.string().min(1),
  }),
});

export const formAiContextMarkdownResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    markdown: z.string().min(1),
  }),
});

export const createTemplateResponseSchema = successEnvelopeSchema.extend({
  data: templateItemSchema,
});

export const formListItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  template_id: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  template: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
  }).nullable().optional(),
});

export const listFormsResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    items: z.array(formListItemSchema),
    pagination: z.object({
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      totalPages: z.number().int().nonnegative(),
    }),
  }),
});

export const formConfigSchema = z.object({
  version: z.number().int().positive().optional(),
  validation_engine: z.string().optional(),
  field_type_index: z.record(z.any()).optional(),
  completion_action: z.record(z.any()).optional(),
  submission_policy: z.record(z.any()).optional(),
  steps: z.array(z.object({
    order: z.number().int().positive(),
    title: z.string().min(1),
    questions: z.array(z.object({
      id: z.string().min(1),
      type: z.string().min(1),
      label: z.string().min(1),
      placeholder: z.string().optional(),
      hint: z.string().optional(),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      validation: z.record(z.any()).optional(),
    }).passthrough()),
  }).passthrough()),
}).passthrough();

export const validateFormConfigResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    normalizedConfig: formConfigSchema,
    summary: z.object({
      steps: z.number().int().nonnegative(),
      questions: z.number().int().nonnegative(),
    }),
  }),
});

export const formDetailResponseSchema = successEnvelopeSchema.extend({
  data: formListItemSchema.extend({
    config: formConfigSchema,
  }),
});

export const createFormResponseSchema = successEnvelopeSchema.extend({
  data: formListItemSchema.extend({
    config: formConfigSchema,
  }),
});

export const importFormResponseSchema = successEnvelopeSchema.extend({
  data: formListItemSchema.extend({
    config: formConfigSchema,
  }),
});

export const exportFormResponseSchema = successEnvelopeSchema.extend({
  data: z.object({
    form: formListItemSchema,
    config: formConfigSchema,
  }),
});
