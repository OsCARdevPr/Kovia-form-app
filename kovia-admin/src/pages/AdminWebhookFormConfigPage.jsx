import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Popover, Spinner, Table } from '@heroui/react';
import { getWebhookWithForms, listWebhookLogs, removeWebhookFormConfig, upsertWebhookFormConfig } from '../lib/admin/webhooks';
import { getFormById, listForms } from '../lib/admin/forms';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import WebhookBodyEditor, { SYSTEM_VARIABLES, extractFormVariables } from '../components/webhooks/WebhookBodyEditor';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

function setTemplateToken(template, tokenPath) {
  const segments = tokenPath.split('.').filter(Boolean);
  if (segments.length === 0) return;

  let current = template;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[segments[segments.length - 1]] = `{{${tokenPath}}}`;
}

function buildAutomaticBodyTemplate(tokens) {
  const template = {};
  for (const token of tokens) {
    setTemplateToken(template, token);
  }
  return template;
}

function formatLogDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'success') {
    return {
      label: 'Exitoso',
      className: 'bg-success-soft-hover text-success',
    };
  }

  if (normalized === 'http_error') {
    return {
      label: 'Error HTTP',
      className: 'bg-warning-soft-hover text-warning',
    };
  }

  if (normalized === 'error') {
    return {
      label: 'Error',
      className: 'bg-danger-soft-hover text-danger',
    };
  }

  return {
    label: 'Pendiente',
    className: 'bg-muted text-foreground/70',
  };
}

function shortId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (raw.length <= 14) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

export default function AdminWebhookFormConfigPage() {
  const { webhookId } = useParams();
  const navigate      = useNavigate();

  const [isLoading, setIsLoading]       = useState(true);
  const [isSaving, setIsSaving]         = useState(false);
  const [webhook, setWebhook]           = useState(null);
  const [allForms, setAllForms]         = useState([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [selectedForm, setSelectedForm] = useState(null);
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [configActive, setConfigActive] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [autoFieldTokens, setAutoFieldTokens] = useState([]);
  const [includeSystemTokens, setIncludeSystemTokens] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [logsPagination, setLogsPagination] = useState({
    total: 0,
    page: 1,
    limit: 50,
    totalPages: 0,
  });
  const [logsReloadSeed, setLogsReloadSeed] = useState(0);

  const formVariables = useMemo(
    () => extractFormVariables(selectedForm?.config),
    [selectedForm?.config]
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const [wh, formsResult] = await Promise.all([
          getWebhookWithForms(webhookId),
          listForms({ limit: 200 }),
        ]);
        if (cancelled) return;
        setWebhook(wh);
        setAllForms(formsResult.items || []);
      } catch (err) {
        if (!cancelled) notifyError(err, 'No se pudo cargar el webhook.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [webhookId]);

  // Al cambiar el formulario seleccionado, cargar su config y body template existente
  useEffect(() => {
    if (!selectedFormId || !webhook) {
      setSelectedForm(null);
      setBodyTemplate('');
      setConfigActive(true);
      return;
    }

    let cancelled = false;
    async function loadForm() {
      try {
        const form = await getFormById(selectedFormId);
        if (cancelled) return;
        setSelectedForm(form);

        // Buscar config existente para este webhook+form
        const existingConfig = (webhook.form_configs || []).find(
          (c) => c.form_id === selectedFormId
        );
        setBodyTemplate(existingConfig?.body_template || '');
        setConfigActive(existingConfig?.is_active ?? true);
      } catch (err) {
        if (!cancelled) notifyError(err, 'No se pudo cargar el formulario.');
      }
    }
    void loadForm();
    return () => { cancelled = true; };
  }, [selectedFormId, webhook]);

  useEffect(() => {
    if (!selectedFormId) {
      setAutoFieldTokens([]);
      setIncludeSystemTokens(true);
      setIsGeneratorOpen(false);
      return;
    }

    setAutoFieldTokens(formVariables.map((variable) => variable.token));
  }, [selectedFormId, formVariables]);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setIsLoadingLogs(true);
      try {
        const result = await listWebhookLogs(webhookId, {
          limit: 50,
          form_id: selectedFormId || undefined,
        });

        if (cancelled) return;

        setWebhookLogs(result.items || []);
        setLogsPagination(result.pagination || {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        });
      } catch (err) {
        if (!cancelled) {
          notifyError(err, 'No se pudieron cargar los logs del webhook.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLogs(false);
        }
      }
    }

    void loadLogs();
    return () => {
      cancelled = true;
    };
  }, [webhookId, selectedFormId, logsReloadSeed]);

  async function handleSave() {
    if (!selectedFormId) { notifyError('Selecciona un formulario primero.'); return; }
    setIsSaving(true);
    try {
      await upsertWebhookFormConfig(webhookId, selectedFormId, {
        body_template: bodyTemplate || null,
        is_active:     configActive,
      });
      notifySuccess('Configuración guardada correctamente.');
      // Recargar webhook para reflejar el cambio en la lista de forms vinculados
      const updated = await getWebhookWithForms(webhookId);
      setWebhook(updated);
      setLogsReloadSeed((current) => current + 1);
    } catch (err) {
      notifyError(err, 'No se pudo guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnlink() {
    if (!selectedFormId) return;
    try {
      await removeWebhookFormConfig(webhookId, selectedFormId);
      notifySuccess('Formulario desvinculado del webhook.');
      const updated = await getWebhookWithForms(webhookId);
      setWebhook(updated);
      setSelectedFormId('');
      setLogsReloadSeed((current) => current + 1);
    } catch (err) {
      notifyError(err, 'No se pudo desvincular el formulario.');
    }
  }

  function handleSelectAllFields() {
    setAutoFieldTokens(formVariables.map((variable) => variable.token));
  }

  function handleClearSelectedFields() {
    setAutoFieldTokens([]);
  }

  function handleToggleAutoField(token, isChecked) {
    setAutoFieldTokens((current) => {
      if (isChecked) return current.includes(token) ? current : [...current, token];
      return current.filter((item) => item !== token);
    });
  }

  function handleGenerateAutomaticTemplate() {
    const allTokens = [
      ...(includeSystemTokens ? SYSTEM_VARIABLES.map((variable) => variable.token) : []),
      ...autoFieldTokens,
    ];
    const uniqueTokens = [...new Set(allTokens)];

    if (uniqueTokens.length === 0) {
      notifyError('Selecciona al menos un campo o habilita variables de sistema.');
      return;
    }

    const template = buildAutomaticBodyTemplate(uniqueTokens);
    setBodyTemplate(JSON.stringify(template, null, 2));
    setIsGeneratorOpen(false);
    notifySuccess('Body generado automáticamente.');
  }

  if (isLoading) {
    return (
      <Card variant="secondary">
        <Card.Content className="flex items-center gap-3 py-8">
          <Spinner size="sm" /><span>Cargando webhook...</span>
        </Card.Content>
      </Card>
    );
  }

  if (!webhook) {
    return (
      <div className="flex flex-col gap-4">
        <Card variant="secondary">
          <Card.Content className="py-6 text-center text-sm opacity-70">Webhook no encontrado.</Card.Content>
        </Card>
        <Button variant="secondary" onPress={() => navigate('/webhooks')}>← Volver a Webhooks</Button>
      </div>
    );
  }

  const linkedFormIds = new Set((webhook.form_configs || []).map((c) => c.form_id));
  const existingConfig = selectedFormId
    ? (webhook.form_configs || []).find((c) => c.form_id === selectedFormId)
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <Card variant="default">
        <SectionCardHeader
          section="Webhooks"
          title={webhook.name}
          description={`${webhook.method} → ${webhook.url}`}
          action={
            <Button size="sm" variant="secondary" onPress={() => navigate('/webhooks')}>
              ← Volver
            </Button>
          }
        />
      </Card>

      {/* Formularios vinculados (resumen) */}
      {(webhook.form_configs || []).length > 0 && (
        <Card variant="secondary">
          <Card.Header>
            <Card.Title>Formularios vinculados</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-wrap gap-2">
            {webhook.form_configs.map((c) => (
              <button
                key={c.form_id}
                type="button"
                onClick={() => setSelectedFormId(c.form_id)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  selectedFormId === c.form_id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 hover:bg-muted/40'
                }`}
              >
                {c.form?.title || c.form_id}
                {!c.is_active && <span className="ml-1 opacity-50">(inactivo)</span>}
              </button>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Selector de formulario */}
      <Card variant="secondary">
        <Card.Header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <Card.Title>Configurar body por formulario</Card.Title>
            <Card.Description>
              Selecciona un formulario para definir el body que se enviará al disparar el webhook.
            </Card.Description>
          </div>

          <Popover isOpen={isHelpOpen} onOpenChange={setIsHelpOpen}>
            <Popover.Trigger>
              <Button size="sm" variant="secondary">¿Cómo usar esta sección?</Button>
            </Popover.Trigger>
            <Popover.Content className="w-[min(92vw,430px)]">
              <Popover.Dialog>
                <Popover.Arrow />
                <Popover.Heading>Guía rápida</Popover.Heading>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-muted">
                  <li>Selecciona un formulario desde el selector o desde la lista de vinculados.</li>
                  <li>Define el body manualmente con el editor o usa el generador automático.</li>
                  <li>Inserta variables con formato <code className="font-mono">{'{{token}}'}</code>.</li>
                  <li>Guarda la configuración para activar el payload en el webhook.</li>
                </ol>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </Card.Header>
        <Card.Content className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 flex-1 min-w-56">
            <label className="kovia-label">Formulario</label>
            <select
              className="kovia-input"
              value={selectedFormId}
              onChange={(e) => setSelectedFormId(e.target.value)}
            >
              <option value="">— Selecciona un formulario —</option>
              {allForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}{linkedFormIds.has(f.id) ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>
          {existingConfig && (
            <label className="flex items-center gap-2 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={configActive}
                onChange={(e) => setConfigActive(e.target.checked)}
              />
              <span className="text-sm">Activo para este formulario</span>
            </label>
          )}
        </Card.Content>
      </Card>

      {/* Editor de body */}
      {selectedFormId && (
        <Card variant="secondary">
          <Card.Header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <Card.Title>Body template</Card.Title>
              <Card.Description>
                Escribe el body que se enviará. Haz click en una variable para insertarla al cursor.
              </Card.Description>
            </div>

            <Popover isOpen={isGeneratorOpen} onOpenChange={setIsGeneratorOpen}>
              <Popover.Trigger>
                <Button size="sm" variant="secondary">Generar body automático</Button>
              </Popover.Trigger>
              <Popover.Content className="w-[min(92vw,460px)]">
                <Popover.Dialog>
                  <Popover.Arrow />
                  <Popover.Heading>Generador automático</Popover.Heading>

                  <div className="mt-2 flex flex-col gap-3">
                    <p className="text-sm text-muted">
                      Elige los campos que deseas incluir y se generará un JSON con variables listas para guardar.
                    </p>

                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={includeSystemTokens}
                        onChange={(e) => setIncludeSystemTokens(e.target.checked)}
                      />
                      <span>Incluir variables de sistema</span>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        isDisabled={formVariables.length === 0}
                        onPress={handleSelectAllFields}
                      >
                        Seleccionar todos
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        isDisabled={autoFieldTokens.length === 0}
                        onPress={handleClearSelectedFields}
                      >
                        Limpiar selección
                      </Button>
                    </div>

                    <p className="text-xs opacity-60">
                      Campos seleccionados: {autoFieldTokens.length}/{formVariables.length}
                    </p>

                    <div className="max-h-70 overflow-y-auto rounded-lg border border-border/50 p-3">
                      {formVariables.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {formVariables.map((variable) => {
                            const isChecked = autoFieldTokens.includes(variable.token);
                            return (
                              <label
                                key={variable.token}
                                className="flex cursor-pointer items-start gap-2 rounded-md border border-border/40 px-2 py-1.5 hover:bg-muted/20"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => handleToggleAutoField(variable.token, e.target.checked)}
                                />
                                <span className="flex flex-col gap-0.5">
                                  <span className="text-sm">{variable.label}</span>
                                  <span className="font-mono text-xs opacity-60">{`{{${variable.token}}}`}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm opacity-60">
                          Este formulario no tiene campos detectados en su configuración.
                        </p>
                      )}
                    </div>

                    <Button onPress={handleGenerateAutomaticTemplate}>
                      Generar e insertar en el editor
                    </Button>
                  </div>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </Card.Header>
          <Card.Content>
            <WebhookBodyEditor
              value={bodyTemplate}
              onChange={setBodyTemplate}
              formConfig={selectedForm?.config}
            />
          </Card.Content>
          <Card.Footer className="flex justify-between gap-2 border-t border-border/50">
            {existingConfig ? (
              <Button size="sm" variant="secondary" onPress={handleUnlink}>
                Desvincular formulario
              </Button>
            ) : (
              <span />
            )}
            <Button isDisabled={isSaving} onPress={handleSave}>
              {isSaving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </Card.Footer>
        </Card>
      )}

      <Card variant="secondary">
        <Card.Header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <Card.Title>Historial de envíos</Card.Title>
            <Card.Description>
              {selectedFormId
                ? 'Mostrando logs del formulario seleccionado para este webhook.'
                : 'Mostrando logs de todos los formularios vinculados a este webhook.'}
            </Card.Description>
          </div>

          <Button
            size="sm"
            variant="secondary"
            isDisabled={isLoadingLogs}
            onPress={() => setLogsReloadSeed((current) => current + 1)}
          >
            {isLoadingLogs ? 'Actualizando...' : 'Actualizar logs'}
          </Button>
        </Card.Header>

        <Card.Content>
          {isLoadingLogs ? (
            <div className="flex items-center gap-2 py-3 text-sm opacity-70">
              <Spinner size="sm" />
              <span>Cargando logs...</span>
            </div>
          ) : webhookLogs.length === 0 ? (
            <p className="py-3 text-sm opacity-70">No hay envíos registrados todavía para este filtro.</p>
          ) : (
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label="Historial de envíos del webhook" className="min-w-260">
                  <Table.Header>
                    <Table.Column isRowHeader className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      Fecha
                    </Table.Column>
                    <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      Formulario
                    </Table.Column>
                    <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      Submission
                    </Table.Column>
                    <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      Estado
                    </Table.Column>
                    <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      HTTP
                    </Table.Column>
                    <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      Duración
                    </Table.Column>
                    <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                      Detalle
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {webhookLogs.map((log) => {
                      const statusMeta = getStatusMeta(log.status);
                      const detailRaw = String(log.error_message || log.response_body || '').trim();
                      const detailPreview = detailRaw.length > 140
                        ? `${detailRaw.slice(0, 140)}...`
                        : (detailRaw || '—');

                      return (
                        <Table.Row key={log.id} id={log.id}>
                          <Table.Cell className="px-4 py-3 text-xs tabular-nums opacity-80">
                            {formatLogDate(log.triggered_at || log.created_at)}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-3 text-sm font-medium">
                            {log.form?.title || log.form_id || '—'}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-3 font-mono text-xs opacity-70">
                            {shortId(log.submission_id)}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="px-4 py-3 text-xs font-medium">
                            {log.response_status ?? '—'}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-3 text-xs">
                            {typeof log.duration_ms === 'number' ? `${log.duration_ms} ms` : '—'}
                          </Table.Cell>
                          <Table.Cell className="px-4 py-3 text-xs opacity-75" title={detailRaw || ''}>
                            {detailPreview}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </Card.Content>

        <Card.Footer className="border-t border-border/50 text-xs opacity-60">
          Total de envíos registrados: {logsPagination.total}
        </Card.Footer>
      </Card>
    </div>
  );
}
