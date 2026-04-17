'use strict';

async function up(queryInterface, DataTypes) {
  await queryInterface.createTable('form_submissions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    form_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'forms',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    answers: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
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

  await queryInterface.addIndex('form_submissions', ['form_id'], {
    name: 'form_submissions_form_id_idx',
  });

  await queryInterface.addIndex('form_submissions', ['created_at'], {
    name: 'form_submissions_created_at_idx',
  });
}

async function down(queryInterface) {
  await queryInterface.dropTable('form_submissions');
}

module.exports = { up, down };
