'use strict';

async function up(queryInterface, DataTypes) {
  await queryInterface.createTable('forms', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
    template_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'form_templates',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    config: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: { steps: [] },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await queryInterface.addIndex('forms', ['slug'], {
    unique: true,
    name: 'forms_slug_unique',
  });

  await queryInterface.addIndex('forms', ['template_id'], {
    name: 'forms_template_id_idx',
  });
}

async function down(queryInterface) {
  await queryInterface.dropTable('forms');
}

module.exports = { up, down };
