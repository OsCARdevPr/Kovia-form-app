import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Modal, Spinner } from '@heroui/react';
import { createTemplate, listTemplates } from '../lib/admin/forms';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

export default function AdminFormsTemplatesPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateDraft, setTemplateDraft] = useState({
    name: '',
    slug: '',
    description: '',
  });

  async function loadTemplates() {
    setIsLoading(true);
    setHasLoadError(false);

    try {
      const response = await listTemplates();
      setTemplates(response.items || []);
    } catch (err) {
      setHasLoadError(true);
      notifyError(err, 'No se pudieron cargar las plantillas.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await loadTemplates();
      if (cancelled) {
        return;
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateTemplate() {
    if (!templateDraft.name.trim()) {
      notifyError('El nombre de la plantilla es obligatorio.');
      return;
    }

    setIsCreating(true);

    try {
      const created = await createTemplate({
        name: templateDraft.name.trim(),
        slug: templateDraft.slug.trim() || undefined,
        description: templateDraft.description.trim() || undefined,
      });

      setTemplateDraft({ name: '', slug: '', description: '' });
      notifySuccess(`Plantilla creada: ${created.name}`);
      setIsCreateModalOpen(false);
      await loadTemplates();
    } catch (err) {
      notifyError(err, 'No se pudo crear la plantilla.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="default">
        <SectionCardHeader
          action={
            <Button onPress={() => setIsCreateModalOpen(true)} size="sm" variant="secondary">
              Agregar plantilla
            </Button>
          }
          description="Selecciona una plantilla para acceder a todos los formularios de ese proyecto."
          section="Formularios"
          title="Plantillas y proyectos"
        />
      </Card>

      <Modal>
        <Modal.Backdrop isOpen={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Crear plantilla de formularios</Modal.Heading>
                <p className="text-sm text-muted">Crea una plantilla de proyecto para agrupar formularios.</p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Nombre de la plantilla</label>
                  <input
                    className="kovia-input"
                    onChange={(event) => setTemplateDraft((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Ejemplo: Discovery Ventas"
                    value={templateDraft.name}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Slug (opcional)</label>
                  <input
                    className="kovia-input"
                    onChange={(event) => setTemplateDraft((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="discovery-sales"
                    value={templateDraft.slug}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="kovia-label">Descripción (opcional)</label>
                  <textarea
                    className="kovia-textarea"
                    onChange={(event) => setTemplateDraft((prev) => ({ ...prev, description: event.target.value }))}
                    rows={4}
                    value={templateDraft.description}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  Cancelar
                </Button>
                <Button isDisabled={isCreating} onPress={handleCreateTemplate}>
                  {isCreating ? 'Creando...' : 'Crear plantilla'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {isLoading ? (
        <Card variant="secondary">
          <Card.Content className="flex items-center gap-3 py-8">
            <Spinner size="sm" />
            <span>Cargando plantillas...</span>
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} variant="secondary">
            <Card.Header className="flex flex-col items-start gap-1">
              <Card.Title>{template.name}</Card.Title>
              <Card.Description>{template.slug}</Card.Description>
              <Card.Description>
                {template.active_forms_count} activos / {template.forms_count} formularios totales
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <p className="text-sm opacity-80">
                {template.description || 'No hay descripción disponible para esta plantilla.'}
              </p>
            </Card.Content>
            <Card.Footer>
              <Button
                onPress={() => navigate(`/forms/${encodeURIComponent(template.id)}`)}
                size="sm"
                variant="secondary"
              >
                Ver formularios
              </Button>
            </Card.Footer>
          </Card>
        ))}
      </div>

      {!isLoading && !hasLoadError && templates.length === 0 ? (
        <Card variant="secondary">
          <Card.Content>No hay plantillas disponibles todavía.</Card.Content>
        </Card>
      ) : null}
    </div>
  );
}
