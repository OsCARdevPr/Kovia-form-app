'use strict';

const sequelize = require('../config/database');
const FormTemplate = require('../models/FormTemplate');
const Form = require('../models/Form');
const { discoveryTemplate, discoveryFormConfig } = require('./seed-data/discovery-form-config');
const {
  leadQualificationTemplate,
  leadQualificationForm,
  leadQualificationFormConfig,
} = require('./seed-data/lead-qualification-form-config');


async function seedDiscoveryForm() {
  const [template] = await FormTemplate.findOrCreate({
    where: { slug: discoveryTemplate.slug },
    defaults: {
      name: discoveryTemplate.name,
      slug: discoveryTemplate.slug,
      description: discoveryTemplate.description,
      is_active: true,
    },
  });

  const [form, created] = await Form.findOrCreate({
    where: { slug: 'kovia-discovery' },
    defaults: {
      title: 'Kovia Discovery Form',
      slug: 'kovia-discovery',
      template_id: template.id,
      config: discoveryFormConfig,
      is_active: true,
    },
  });

  if (!created) {
    await form.update({
      title: 'Kovia Discovery Form',
      template_id: template.id,
      config: discoveryFormConfig,
      is_active: true,
    });
  }

  return {
    template,
    form,
    created,
  };
}

async function seedLeadQualificationForm() {
  const [template] = await FormTemplate.findOrCreate({
    where: { slug: leadQualificationTemplate.slug },
    defaults: {
      name: leadQualificationTemplate.name,
      slug: leadQualificationTemplate.slug,
      description: leadQualificationTemplate.description,
      is_active: true,
    },
  });

  const [form, created] = await Form.findOrCreate({
    where: { slug: leadQualificationForm.slug },
    defaults: {
      title: leadQualificationForm.title,
      slug: leadQualificationForm.slug,
      template_id: template.id,
      config: leadQualificationFormConfig,
      is_active: true,
    },
  });

  if (!created) {
    await form.update({
      title: leadQualificationForm.title,
      template_id: template.id,
      config: leadQualificationFormConfig,
      is_active: true,
    });
  }

  return {
    template,
    form,
    created,
  };
}

async function runSeeds() {
  await sequelize.authenticate();
  const discoveryResult = await seedDiscoveryForm();
  const leadQualificationResult = await seedLeadQualificationForm();

  console.log('[seed] Discovery form ready:', {
    formId: discoveryResult.form.id,
    slug: discoveryResult.form.slug,
    templateSlug: discoveryResult.template.slug,
    created: discoveryResult.created,
  });

  console.log('[seed] Lead qualification form ready:', {
    formId: leadQualificationResult.form.id,
    slug: leadQualificationResult.form.slug,
    templateSlug: leadQualificationResult.template.slug,
    created: leadQualificationResult.created,
  });
}

if (require.main === module) {
  runSeeds()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('[seed] Failed:', error.message);
      await sequelize.close();
      process.exit(1);
    });
}

module.exports = {
  runSeeds,
  seedDiscoveryForm,
  seedLeadQualificationForm,
};
