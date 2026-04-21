import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, AlertDialog, Breadcrumbs, Button, Card, Dropdown, Input, ListBox, Modal, Select, Spinner } from '@heroui/react';
import {
  archiveFormSubmissions,
  archiveFormWebhooks,
  createForm,
  deleteForm,
  deleteFormPermanently,
  getFormAiContextMarkdown,
  getImportGuidelines,
  importForm,
  listForms,
  listTemplates,
  updateForm,
  validateFormConfig,
} from '../lib/admin/forms';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

const FORM_URL_BASE = String(import.meta.env.FORM_URL_BASE || import.meta.env.VITE_FORM_URL_BASE || '')
  .trim()
  .replace(/\/+$/, '');

const ADMIN_API_BASE = String(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:3000')
  .trim()
  .replace(/\/+$/, '');

const FORM_STATUS_FILTER_OPTIONS = [
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Desactivados' },
  { id: 'all', label: 'Todos' },
];

function getActionDialogContent(actionType, formTitle) {
  const safeTitle = formTitle ? `"${formTitle}"` : 'este formulario';

  if (actionType === 'archive') {
    return {
      heading: `¿Archivar webhooks y respuestas de ${safeTitle}?`,
      body: 'Se desactivarán los webhooks vinculados y las respuestas quedarán archivadas para no mostrarse por defecto.',
      confirmLabel: 'Archivar webhooks y respuestas',
      runningLabel: 'Archivando webhooks y respuestas...',
      confirmVariant: 'primary',
      status: 'warning',
    };
  }

  if (actionType === 'deactivate') {
    return {
      heading: `¿Desactivar ${safeTitle}?`,
      body: 'El formulario quedará inactivo y ya no aceptará respuestas públicas.',
      confirmLabel: 'Desactivar formulario',
      runningLabel: 'Desactivando...',
      confirmVariant: 'primary',
      status: 'warning',
    };
  }

  if (actionType === 'activate') {
    return {
      heading: `¿Activar ${safeTitle}?`,
      body: 'El formulario quedará activo y volverá a aceptar respuestas públicas.',
      confirmLabel: 'Activar formulario',
      runningLabel: 'Activando...',
      confirmVariant: 'primary',
      status: 'success',
    };
  }

  return {
    heading: `¿Eliminar para siempre ${safeTitle}?`,
    body: 'Esta acción es irreversible y eliminará también todas sus respuestas y configuraciones de webhook asociadas.',
    confirmLabel: 'Eliminar para siempre',
    runningLabel: 'Eliminando...',
    confirmVariant: 'danger',
    status: 'danger',
  };
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function extractErrorMessage(error, fallback) {
  const fieldErrors = error?.errors?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === 'object') {
    const firstEntry = Object.values(fieldErrors).find((messages) => Array.isArray(messages) && messages.length > 0);
    if (Array.isArray(firstEntry) && firstEntry.length > 0) {
      return firstEntry[0];
    }
  }

  return error?.message || fallback;
}

function parseImportJson(rawText) {
  const raw = JSON.parse(rawText || '{}');
  const candidateConfig = raw?.config && typeof raw.config === 'object' ? raw.config : raw;
  const titleFromJson = String(raw?.title || raw?.form?.title || '').trim();
  const slugFromJson = String(raw?.slug || raw?.form?.slug || '').trim();

  return {
    candidateConfig,
    slugFromJson,
    titleFromJson,
  };
}

function buildPublicFormUrl(slug) {
  const cleanSlug = String(slug || '').trim();
  if (!FORM_URL_BASE || !cleanSlug) {
    return '';
  }

  return `${FORM_URL_BASE}/${encodeURIComponent(cleanSlug)}`;
}

function buildMarkdownFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function sanitizeFilename(value) {
  return String(value || 'formulario')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'formulario';
}

function LinkIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M10 14L14 10M7 17H6A5 5 0 0 1 6 7h3M17 7h1a5 5 0 0 1 0 10h-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoreActionsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}

function ImportPreview({ config }) {
  if (!config || !Array.isArray(config.steps) || config.steps.length === 0) {
    return <p className="text-sm opacity-80">Valida una configuración JSON para ver la vista previa.</p>;
  }

  return (
    <div className="flex max-h-70 flex-col gap-2 overflow-auto pr-1">
      {config.steps.map((step) => (
        <div key={`step-${step.order}`} className="kovia-preview-question">
          <p className="text-sm font-semibold">Paso {step.order}: {step.title}</p>
          {(step.questions || []).map((question) => (
            <div key={question.id} className="mt-1">
              <span className="text-xs opacity-70">{question.type}</span>
              <p className="text-sm">{question.label}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminTemplateFormsPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isValidatingImport, setIsValidatingImport] = useState(false);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [forms, setForms] = useState([]);
  const [templateName, setTemplateName] = useState('Plantilla');
  const [formDraft, setFormDraft] = useState({ title: '', slug: '' });
  const [importDraft, setImportDraft] = useState({ title: '', slug: '', json: '' });
  const [guidelinesMarkdown, setGuidelinesMarkdown] = useState('Cargando guía Markdown...');
  const [importPreviewConfig, setImportPreviewConfig] = useState(null);
  const [importValidationMessage, setImportValidationMessage] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [runningContextAction, setRunningContextAction] = useState(null);

  const query = useMemo(() => ({
    template_id: templateId,
    search,
    ...(statusFilter === 'all'
      ? { include_inactive: true }
      : { is_active: statusFilter === 'active' }),
  }), [templateId, search, statusFilter]);

  useEffect(() => {
    if (!error) {
      return;
    }

    notifyError(error);
  }, [error]);

  useEffect(() => {
    if (!success) {
      return;
    }

    notifySuccess(success);
  }, [success]);

  async function loadData() {
    setIsLoading(true);
    setError('');

    try {
      const [formsResponse, templatesResponse] = await Promise.all([
        listForms(query),
        listTemplates(),
      ]);

      setForms(formsResponse.items || []);
      const selectedTemplate = (templatesResponse.items || []).find((item) => item.id === templateId);
      setTemplateName(selectedTemplate?.name || 'Plantilla');
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar los formularios de esta plantilla.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await loadData();
      if (cancelled) {
        return;
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [query, templateId]);

  async function handleCreateForm() {
    if (!formDraft.title.trim()) {
      setError('El título del formulario es obligatorio.');
      return;
    }

    const enteredSlug = formDraft.slug.trim();
    let autoGenerateSlug = false;

    if (!enteredSlug) {
      autoGenerateSlug = window.confirm(
        'No ingresaste slug. ¿Deseas generar uno automático de 10 caracteres (mayúsculas y números)?',
      );

      if (!autoGenerateSlug) {
        setError('El slug es obligatorio para crear el formulario.');
        return;
      }
    }

    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const created = await createForm({
        title: formDraft.title.trim(),
        slug: enteredSlug || undefined,
        auto_generate_slug: autoGenerateSlug,
        template_id: templateId,
        config: { version: 1, validation_engine: 'z-rules-v1', field_type_index: {}, steps: [] },
      });

      setFormDraft({ title: '', slug: '' });
      setSuccess(`Formulario creado: ${created.title} (${created.slug})`);
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err?.message || 'No se pudo crear el formulario.');
    } finally {
      setIsCreating(false);
    }
  }

  async function openImportModal() {
    setIsImportModalOpen(true);
    setImportValidationMessage('');
    setImportPreviewConfig(null);

    try {
      const response = await getImportGuidelines();
      setGuidelinesMarkdown(response.markdown);
    } catch (err) {
      setGuidelinesMarkdown('# No se pudo cargar la guía\n\nIntenta de nuevo en unos segundos.');
      setError(err?.message || 'No se pudo cargar la guía de importación.');
    }
  }

  async function copyGuidelines() {
    try {
      await navigator.clipboard.writeText(guidelinesMarkdown || '');
      setSuccess('Guía Markdown copiada al portapapeles.');
    } catch {
      setError('No se pudo copiar la guía Markdown.');
    }
  }

  async function handleValidateImportJson() {
    setImportValidationMessage('');
    setImportPreviewConfig(null);
    setError('');

    if (!importDraft.json.trim()) {
      setError('Pega una configuración JSON antes de validar.');
      return;
    }

    setIsValidatingImport(true);

    try {
      const { candidateConfig, titleFromJson, slugFromJson } = parseImportJson(importDraft.json);
      const validation = await validateFormConfig(candidateConfig);

      setImportPreviewConfig(validation.normalizedConfig);
      setImportValidationMessage(
        `JSON validado en servidor: ${validation.summary.steps} pasos y ${validation.summary.questions} preguntas.`,
      );

      if (!importDraft.title.trim()) {
        if (titleFromJson) {
          setImportDraft((prev) => ({ ...prev, title: titleFromJson }));
        }
      }

      if (!importDraft.slug.trim()) {
        if (slugFromJson) {
          setImportDraft((prev) => ({ ...prev, slug: slugFromJson }));
        }
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'JSON inválido o error de validación en servidor.'));
    } finally {
      setIsValidatingImport(false);
    }
  }

  async function handleImportFormJson() {
    if (!importDraft.json.trim()) {
      setError('Pega una configuración JSON antes de importar.');
      return;
    }

    setError('');
    setSuccess('');
    setIsImporting(true);

    try {
      const enteredSlug = importDraft.slug.trim();
      let slugFromJson = '';

      try {
        slugFromJson = parseImportJson(importDraft.json).slugFromJson;
      } catch {
        slugFromJson = '';
      }

      let autoGenerateSlug = false;
      if (!enteredSlug && !slugFromJson) {
        autoGenerateSlug = window.confirm(
          'No se detectó slug en la importación. ¿Deseas generar uno automático de 10 caracteres (mayúsculas y números)?',
        );

        if (!autoGenerateSlug) {
          setError('El slug es obligatorio para importar el formulario.');
          return;
        }
      }

      const created = await importForm({
        title: importDraft.title.trim() || undefined,
        slug: enteredSlug || undefined,
        auto_generate_slug: autoGenerateSlug,
        template_id: templateId,
        json: importDraft.json,
      });

      setSuccess(`Formulario importado: ${created.title} (${created.slug})`);
      setImportDraft({ title: '', slug: '', json: '' });
      setImportValidationMessage('');
      setImportPreviewConfig(null);
      setIsImportModalOpen(false);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err, 'No se pudo importar el formulario JSON.'));
    } finally {
      setIsImporting(false);
    }
  }

  function openActionDialog(form, actionType) {
    if (!form?.id) {
      setError('No se encontró el identificador del formulario.');
      return;
    }

    setPendingAction({ form, actionType });
  }

  function closeActionDialog() {
    if (isRunningAction) {
      return;
    }

    setPendingAction(null);
  }

  function handleCardActionSelection(form, actionKey) {
    if (actionKey === 'copy-ai-context' || actionKey === 'download-ai-context') {
      void handleAiContextAction(form, actionKey === 'copy-ai-context' ? 'copy' : 'download');
      return;
    }

    if (!['archive', 'toggle-active', 'permanent-delete'].includes(actionKey)) {
      return;
    }

    const actionType = actionKey === 'toggle-active'
      ? (form?.is_active ? 'deactivate' : 'activate')
      : actionKey;

    openActionDialog(form, actionType);
  }

  async function handleAiContextAction(form, mode) {
    if (!form?.id) {
      setError('No se encontró el identificador del formulario para generar el contexto IA.');
      return;
    }

    if (runningContextAction) {
      return;
    }

    setRunningContextAction({ formId: form.id, mode });
    setError('');
    setSuccess('');

    try {
      const { markdown } = await getFormAiContextMarkdown(form.id, {
        form_url_base: FORM_URL_BASE || undefined,
        admin_api_base: ADMIN_API_BASE || undefined,
      });

      if (mode === 'copy') {
        await navigator.clipboard.writeText(markdown);
        setSuccess(`Contexto IA copiado para ${form.title}.`);
      } else {
        const baseName = sanitizeFilename(form.slug || form.title);
        buildMarkdownFile(`${baseName}-contexto-ia.md`, markdown);
        setSuccess(`Contexto IA descargado para ${form.title}.`);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'No se pudo generar el archivo de contexto IA para este formulario.'));
    } finally {
      setRunningContextAction(null);
    }
  }

  async function handleConfirmFormAction() {
    if (!pendingAction?.form?.id || !pendingAction?.actionType) {
      return;
    }

    const { form, actionType } = pendingAction;

    setIsRunningAction(true);
    setError('');
    setSuccess('');

    try {
      if (actionType === 'archive') {
        const [webhookResult, submissionResult] = await Promise.all([
          archiveFormWebhooks(form.id),
          archiveFormSubmissions(form.id),
        ]);
        const archivedWebhooks = Number(webhookResult?.archivedCount || 0);
        const archivedResponses = Number(submissionResult?.archivedCount || 0);
        setSuccess(
          `Se archivaron ${archivedWebhooks} webhook${archivedWebhooks === 1 ? '' : 's'} y ${archivedResponses} respuesta${archivedResponses === 1 ? '' : 's'} del formulario ${form.title}.`,
        );
      }

      if (actionType === 'deactivate') {
        await deleteForm(form.id);
        setSuccess(`Formulario desactivado: ${form.title}.`);
      }

      if (actionType === 'activate') {
        await updateForm(form.id, { is_active: true });
        setSuccess(`Formulario activado: ${form.title}.`);
      }

      if (actionType === 'permanent-delete') {
        const result = await deleteFormPermanently(form.id);
        const deletedSubmissions = Number(result?.deletedSubmissions || 0);
        const deletedWebhookConfigs = Number(result?.deletedWebhookConfigs || 0);
        setSuccess(
          `Formulario eliminado permanentemente: ${form.title}. Respuestas eliminadas: ${deletedSubmissions}. Webhooks desvinculados: ${deletedWebhookConfigs}.`,
        );
      }

      setPendingAction(null);
      await loadData();
    } catch (err) {
      setError(extractErrorMessage(err, 'No se pudo completar la acción sobre el formulario.'));
    } finally {
      setIsRunningAction(false);
    }
  }

  const actionDialogContent = pendingAction
    ? getActionDialogContent(pendingAction.actionType, pendingAction.form?.title)
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/forms">Plantillas</Breadcrumbs.Item>
        <Breadcrumbs.Item>{templateName}</Breadcrumbs.Item>
      </Breadcrumbs>

      <Card variant="default">
        <SectionCardHeader
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button isDisabled={isCreating} size="sm" variant="secondary" onPress={() => setIsCreateModalOpen(true)}>
                Agregar formulario
              </Button>
              <Button size="sm" variant="secondary" onPress={openImportModal}>
                Importar JSON
              </Button>
            </div>
          }
          description="Gestiona los formularios asociados a esta plantilla."
          section="Formularios"
          title={templateName}
        />
        <Card.Content>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-64 flex-1"
              placeholder="Buscar por título o slug"
              size="sm"
              value={search}
              variant="secondary"
              onChange={(event) => setSearch(event.target.value)}
            />

            <Select
              aria-label="Filtrar formularios por estado"
              className="min-w-52 max-w-60"
              placeholder="Estado"
              size="sm"
              value={statusFilter}
              onChange={(value) => setStatusFilter(String(value || 'active'))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {FORM_STATUS_FILTER_OPTIONS.map((option) => (
                    <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </Card.Content>
      </Card>

      {isLoading ? (
        <Card variant="secondary">
          <Card.Content className="flex items-center gap-3 py-8">
            <Spinner size="sm" />
            <span>Cargando formularios...</span>
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {forms.map((form) => {
          const isContextActionForThisForm = runningContextAction?.formId === form.id;
          const contextActionLabel = runningContextAction?.mode === 'download' ? 'Descargando...' : 'Copiando...';

          return (
          <Card key={form.id} variant="secondary">
            <Card.Header className="flex flex-col items-start gap-1">
              <Card.Title>{form.title}</Card.Title>
              <Card.Description>{form.slug}</Card.Description>
            </Card.Header>
            <Card.Content>
              <p className="text-sm opacity-80">Estado: {form.is_active ? 'Activo' : 'Inactivo'}</p>
            </Card.Content>
            <Card.Footer>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    if (!form?.id) {
                      setError('No se encontró el identificador del formulario.');
                      return;
                    }

                    navigate(`/forms/${templateId}/${form.id}/builder`);
                  }}
                >
                  Abrir constructor
                </Button>
                <Button
                  aria-label="Abrir enlace público del formulario"
                  isDisabled={!buildPublicFormUrl(form.slug)}
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    const url = buildPublicFormUrl(form.slug);
                    if (!url) {
                      setError('FORM_URL_BASE no está configurado.');
                      return;
                    }
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <LinkIcon />
                </Button>

                <Dropdown>
                  <Dropdown.Trigger>
                    <Button
                      aria-label={`Acciones para ${form.title}`}
                      isDisabled={Boolean(runningContextAction)}
                      isIconOnly
                      size="sm"
                      variant="ghost"
                    >
                      <MoreActionsIcon />
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover>
                    <Dropdown.Menu
                      aria-label={`Menú de acciones para ${form.title}`}
                      onAction={(key) => handleCardActionSelection(form, String(key))}
                    >
                      <Dropdown.Item id="copy-ai-context" textValue="Copiar contexto IA">
                        {isContextActionForThisForm && runningContextAction?.mode === 'copy' ? contextActionLabel : 'Copiar contexto IA (.md)'}
                      </Dropdown.Item>
                      <Dropdown.Item id="download-ai-context" textValue="Descargar contexto IA">
                        {isContextActionForThisForm && runningContextAction?.mode === 'download' ? contextActionLabel : 'Descargar contexto IA (.md)'}
                      </Dropdown.Item>
                      <Dropdown.Item id="archive" textValue="Archivar webhooks y respuestas">
                        Archivar webhooks y respuestas
                      </Dropdown.Item>
                      <Dropdown.Item
                        id="toggle-active"
                        textValue={form.is_active ? 'Desactivar formulario' : 'Activar formulario'}
                      >
                        {form.is_active ? 'Desactivar formulario' : 'Activar formulario'}
                      </Dropdown.Item>
                      <Dropdown.Item id="permanent-delete" textValue="Eliminar para siempre" variant="danger">
                        Eliminar para siempre
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
            </Card.Footer>
          </Card>
          );
        })}
      </div>

      {!isLoading && !error && forms.length === 0 ? (
        <Card variant="secondary">
          <Card.Content>No se encontraron formularios para esta plantilla.</Card.Content>
        </Card>
      ) : null}

      <AlertDialog>
        <AlertDialog.Backdrop
          isKeyboardDismissDisabled
          isOpen={Boolean(pendingAction)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              closeActionDialog();
            }
          }}
        >
          <AlertDialog.Container placement="center" size="sm">
            <AlertDialog.Dialog className="sm:max-w-115">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status={actionDialogContent?.status || 'danger'} />
                <AlertDialog.Heading>{actionDialogContent?.heading || 'Confirmar acción'}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>{actionDialogContent?.body || 'Confirma si deseas continuar con esta acción.'}</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button isDisabled={isRunningAction} variant="tertiary" onPress={closeActionDialog}>
                  Cancelar
                </Button>
                <Button
                  isDisabled={isRunningAction}
                  variant={actionDialogContent?.confirmVariant || 'danger'}
                  onPress={handleConfirmFormAction}
                >
                  {isRunningAction
                    ? (actionDialogContent?.runningLabel || 'Procesando...')
                    : (actionDialogContent?.confirmLabel || 'Confirmar')}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <Modal>
        <Modal.Backdrop isOpen={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Crear formulario</Modal.Heading>
                <p className="text-sm text-muted">Crea un formulario nuevo dentro de esta plantilla.</p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Título del formulario</label>
                  <input
                    className="kovia-input"
                    placeholder="Ejemplo: Diagnóstico comercial"
                    value={formDraft.title}
                    onChange={(event) => setFormDraft((prev) => ({ ...prev, title: event.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Slug (obligatorio o autogenerado)</label>
                  <input
                    className="kovia-input"
                    placeholder="diagnostico-comercial"
                    value={formDraft.slug}
                    onChange={(event) => setFormDraft((prev) => ({ ...prev, slug: event.target.value }))}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">Cancelar</Button>
                <Button isDisabled={isCreating} onPress={handleCreateForm}>
                  {isCreating ? 'Creando...' : 'Crear formulario'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <Modal.Container placement="center" size="cover">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Importar formulario JSON</Modal.Heading>
                <p className="text-sm text-muted">Pega JSON, valida reglas, previsualiza e importa en esta plantilla.</p>
              </Modal.Header>
              <Modal.Body className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="kovia-label">Guía Markdown para IA</label>
                    <Button size="sm" variant="secondary" onPress={copyGuidelines}>Copiar Markdown</Button>
                  </div>
                  <textarea className="kovia-textarea kovia-textarea-lg" readOnly value={guidelinesMarkdown} />

                  <label className="kovia-label">Título del formulario</label>
                  <input
                    className="kovia-input"
                    value={importDraft.title}
                    onChange={(event) => setImportDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Título para el formulario importado"
                  />

                  <label className="kovia-label">Slug (opcional)</label>
                  <input
                    className="kovia-input"
                    value={importDraft.slug}
                    onChange={(event) => setImportDraft((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="Slug (obligatorio o autogenerado)"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label className="kovia-label">JSON del formulario</label>
                  <textarea
                    className="kovia-textarea kovia-textarea-lg"
                    value={importDraft.json}
                    onChange={(event) => setImportDraft((prev) => ({ ...prev, json: event.target.value }))}
                    placeholder={safeStringify({ version: 1, validation_engine: 'z-rules-v1', field_type_index: {}, steps: [] })}
                  />

                  {importValidationMessage ? (
                    <Alert status="accent">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Description>{importValidationMessage}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}

                  <label className="kovia-label">Vista previa</label>
                  <Card variant="secondary">
                    <Card.Content>
                      <ImportPreview config={importPreviewConfig} />
                    </Card.Content>
                  </Card>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">Cancelar</Button>
                <Button isDisabled={isValidatingImport || isImporting} variant="secondary" onPress={handleValidateImportJson}>
                  {isValidatingImport ? 'Validando...' : 'Validar JSON'}
                </Button>
                <Button isDisabled={isImporting || isValidatingImport} onPress={handleImportFormJson}>
                  {isImporting ? 'Importando...' : 'Importar formulario'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
