'use strict';

async function up(queryInterface, DataTypes) {
  const table = await queryInterface.describeTable('form_submissions');

  if (!table.is_archived) {
    await queryInterface.addColumn('form_submissions', 'is_archived', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Marca si la respuesta fue archivada desde admin',
    });
  }

  if (!table.archived_at) {
    await queryInterface.addColumn('form_submissions', 'archived_at', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de archivado de la respuesta',
    });
  }

  await queryInterface.addIndex(
    'form_submissions',
    ['form_id', 'is_archived', 'created_at'],
    { name: 'form_submission_archive_idx' },
  ).catch(() => {});
}

async function down(queryInterface) {
  await queryInterface.removeIndex('form_submissions', 'form_submission_archive_idx').catch(() => {});
  await queryInterface.removeColumn('form_submissions', 'archived_at').catch(() => {});
  await queryInterface.removeColumn('form_submissions', 'is_archived').catch(() => {});
}

module.exports = { up, down };
