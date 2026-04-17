'use strict';

const sequelize = require('../config/database');
const FormTemplate = require('../models/FormTemplate');
const Form = require('../models/Form');
const { discoveryTemplate, discoveryFormConfig } = require('./seed-data/discovery-form-config');


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

async function runSeeds() {
  await sequelize.authenticate();
  const result = await seedDiscoveryForm();

  console.log('[seed] Discovery form ready:', {
    formId: result.form.id,
    slug: result.form.slug,
    templateSlug: result.template.slug,
    created: result.created,
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
  seedDiscoveryForm
};
