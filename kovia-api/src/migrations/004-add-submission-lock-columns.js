'use strict';

async function up(queryInterface, DataTypes) {
  const table = await queryInterface.describeTable('form_submissions');

  if (!table.submission_identifier) {
    await queryInterface.addColumn('form_submissions', 'submission_identifier', {
      type: DataTypes.STRING(191),
      allowNull: true,
      comment: 'Identificador normalizado del usuario para bloqueo por formulario',
    });
  }

  if (!table.submission_identifier_source) {
    await queryInterface.addColumn('form_submissions', 'submission_identifier_source', {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Fuente del identificador (ip, header o anonymous-fingerprint)',
    });
  }

  if (!table.submission_lock_active) {
    await queryInterface.addColumn('form_submissions', 'submission_lock_active', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si esta activo, bloquea reenvio para este identificador en el formulario',
    });
  }

  if (!table.submission_lock_reactivated_at) {
    await queryInterface.addColumn('form_submissions', 'submission_lock_reactivated_at', {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha en que se desbloqueo el reenvio para esta submission',
    });
  }

  await queryInterface.addIndex(
    'form_submissions',
    ['form_id', 'submission_identifier', 'submission_lock_active'],
    { name: 'form_submission_lock_idx' },
  ).catch(() => {});
}

async function down(queryInterface) {
  await queryInterface.removeIndex('form_submissions', 'form_submission_lock_idx').catch(() => {});

  await queryInterface.removeColumn('form_submissions', 'submission_lock_reactivated_at').catch(() => {});
  await queryInterface.removeColumn('form_submissions', 'submission_lock_active').catch(() => {});
  await queryInterface.removeColumn('form_submissions', 'submission_identifier_source').catch(() => {});
  await queryInterface.removeColumn('form_submissions', 'submission_identifier').catch(() => {});
}

module.exports = { up, down };
