import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Spinner, Table } from '@heroui/react';
import {
  createWebhook,
  deleteWebhook,
  getWebhookWithForms,
  listWebhooks,
  updateWebhook,
} from '../lib/admin/webhooks';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

const EMPTY_DRAFT = { name: '', url: '', method: 'POST', headers: '', is_active: true };
const METHOD_OPTIONS = ['POST', 'GET', 'PUT'];

function headersToString(headers) {
  if (!headers || typeof headers !== 'object' || !Object.keys(headers).length) return '';
  try { return JSON.stringify(headers, null, 2); } catch { return ''; }
}

function parseHeaders(raw) {
  const text = (raw || '').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return null; }
}

export default function AdminWebhooksPage() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading]         = useState(true);
  const [webhooks, setWebhooks]           = useState([]);
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [editingId, setEditingId]         = useState(null);
  const [draft, setDraft]                 = useState(EMPTY_DRAFT);
  const [headersError, setHeadersError]   = useState('');

  async function loadWebhooks() {
    setIsLoading(true);
    try {
      const result = await listWebhooks();
      setWebhooks(result.items || []);
    } catch (err) {
      notifyError(err, 'No se pudieron cargar los webhooks.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() { await loadWebhooks(); if (cancelled) return; }
    void load();
    return () => { cancelled = true; };
  }, []);

  function openCreateModal() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setHeadersError('');
    setIsModalOpen(true);
  }

  async function openEditModal(id) {
    try {
      const webhook = await getWebhookWithForms(id);
      setEditingId(id);
      setDraft({
        name:      webhook.name,
        url:       webhook.url,
        method:    webhook.method,
        headers:   headersToString(webhook.headers),
        is_active: webhook.is_active,
      });
      setHeadersError('');
      setIsModalOpen(true);
    } catch (err) {
      notifyError(err, 'No se pudo cargar el webhook.');
    }
  }

  async function handleSave() {
    if (!draft.name.trim()) { notifyError('El nombre es requerido.'); return; }
    if (!draft.url.trim())  { notifyError('La URL es requerida.'); return; }

    const headers = parseHeaders(draft.headers);
    if (headers === null) { setHeadersError('JSON inválido en headers.'); return; }
    setHeadersError('');

    setIsSaving(true);
    try {
      const payload = { name: draft.name.trim(), url: draft.url.trim(), method: draft.method, headers, is_active: draft.is_active };
      if (editingId) {
        await updateWebhook(editingId, payload);
        notifySuccess('Webhook actualizado correctamente.');
      } else {
        await createWebhook(payload);
        notifySuccess('Webhook creado correctamente.');
      }
      setIsModalOpen(false);
      await loadWebhooks();
    } catch (err) {
      notifyError(err, 'No se pudo guardar el webhook.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteWebhook(id);
      notifySuccess('Webhook desactivado.');
      await loadWebhooks();
    } catch (err) {
      notifyError(err, 'No se pudo desactivar el webhook.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="default">
        <SectionCardHeader
          section="Webhooks"
          title="Gestión de webhooks"
          description="Configura destinos de notificación y el body que se enviará por cada formulario."
          action={
            <Button size="sm" variant="secondary" onPress={openCreateModal}>
              Nuevo webhook
            </Button>
          }
        />
      </Card>

      <Modal>
        <Modal.Backdrop isOpen={isModalOpen} onOpenChange={setIsModalOpen}>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{editingId ? 'Editar webhook' : 'Nuevo webhook'}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Nombre</label>
                  <input
                    className="kovia-input"
                    placeholder="Ej: Notificación a CRM"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="kovia-label">URL destino</label>
                  <input
                    className="kovia-input"
                    placeholder="https://hooks.example.com/..."
                    value={draft.url}
                    onChange={(e) => setDraft((p) => ({ ...p, url: e.target.value }))}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="kovia-label">Método HTTP</label>
                    <select
                      className="kovia-input"
                      value={draft.method}
                      onChange={(e) => setDraft((p) => ({ ...p, method: e.target.value }))}
                    >
                      {METHOD_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 justify-end">
                    <label className="kovia-label">Activo</label>
                    <label className="flex items-center gap-2 cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={draft.is_active}
                        onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))}
                      />
                      <span className="text-sm">{draft.is_active ? 'Activo' : 'Inactivo'}</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Headers adicionales (JSON opcional)</label>
                  <textarea
                    className="kovia-textarea font-mono text-sm"
                    rows={4}
                    placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                    value={draft.headers}
                    onChange={(e) => { setHeadersError(''); setDraft((p) => ({ ...p, headers: e.target.value })); }}
                  />
                  {headersError && <p className="text-xs text-danger">{headersError}</p>}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">Cancelar</Button>
                <Button isDisabled={isSaving} onPress={handleSave}>
                  {isSaving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear webhook'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {isLoading ? (
        <Card variant="secondary">
          <Card.Content className="flex items-center gap-3 py-8">
            <Spinner size="sm" /><span>Cargando webhooks...</span>
          </Card.Content>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card variant="secondary">
          <Card.Content className="py-6 text-center text-sm opacity-70">
            No hay webhooks configurados. Crea el primero con el botón de arriba.
          </Card.Content>
        </Card>
      ) : (
        <Card variant="secondary">
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Listado de webhooks" className="min-w-270">
                <Table.Header>
                  <Table.Column isRowHeader className="px-4 py-3 text-xs font-semibold uppercase tracking-wide opacity-60">
                    Nombre
                  </Table.Column>
                  <Table.Column className="px-4 py-3 text-xs font-semibold uppercase tracking-wide opacity-60">
                    URL
                  </Table.Column>
                  <Table.Column className="px-4 py-3 text-xs font-semibold uppercase tracking-wide opacity-60">
                    Método
                  </Table.Column>
                  <Table.Column className="px-4 py-3 text-xs font-semibold uppercase tracking-wide opacity-60 text-center">
                    Formularios
                  </Table.Column>
                  <Table.Column className="px-4 py-3 text-xs font-semibold uppercase tracking-wide opacity-60">
                    Estado
                  </Table.Column>
                  <Table.Column className="px-4 py-3" />
                </Table.Header>
                <Table.Body>
                  {webhooks.map((wh) => (
                    <Table.Row key={wh.id} id={wh.id}>
                      <Table.Cell className="px-4 py-3 font-medium">{wh.name}</Table.Cell>
                      <Table.Cell className="px-4 py-3 max-w-xs truncate font-mono text-xs opacity-70">{wh.url}</Table.Cell>
                      <Table.Cell className="px-4 py-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{wh.method}</span>
                      </Table.Cell>
                      <Table.Cell className="px-4 py-3 text-center">
                        {(wh.form_configs || []).length}
                      </Table.Cell>
                      <Table.Cell className="px-4 py-3">
                        {wh.is_active ? (
                          <span className="rounded-full bg-success-soft-hover px-2 py-0.5 text-xs text-success">Activo</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs opacity-60">Inactivo</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onPress={() => navigate(`/webhooks/${encodeURIComponent(wh.id)}/logs`)}>
                            Ver logs
                          </Button>
                          <Button size="sm" variant="secondary" onPress={() => navigate(`/webhooks/${encodeURIComponent(wh.id)}`)}>
                            Configurar forms
                          </Button>
                          <Button size="sm" variant="secondary" onPress={() => openEditModal(wh.id)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={!wh.is_active}
                            onPress={() => handleDelete(wh.id)}
                          >
                            Desactivar
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>
      )}
    </div>
  );
}
