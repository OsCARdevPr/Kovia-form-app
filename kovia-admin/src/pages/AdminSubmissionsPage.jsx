import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ButtonGroup, Card, Input, ListBox, Select, Separator, Spinner, Table } from '@heroui/react';
import { listSubmissions } from '../lib/admin/submissions';
import { listForms, listTemplates } from '../lib/admin/forms';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import { notifyError } from '../lib/ui/notifications';

const PERIOD_OPTIONS = [
  { value: '',    label: 'Todas' },
  { value: '24h', label: '24h' },
  { value: '7d',  label: '7 días' },
  { value: '30d', label: '30 días' },
];

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminSubmissionsPage() {
  const navigate = useNavigate();

  const [isLoading, setIsLoading]       = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [submissions, setSubmissions]   = useState([]);
  const [pagination, setPagination]     = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [templates, setTemplates]       = useState([]);
  const [forms, setForms]               = useState([]);
  const [currentPage, setCurrentPage]   = useState(1);
  const [filters, setFilters] = useState({
    template_id: '', form_id: '', period: '', search: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function loadSelectors() {
      try {
        const [tpl, frm] = await Promise.all([listTemplates(), listForms({ limit: 200 })]);
        if (cancelled) return;
        setTemplates(tpl.items || []);
        setForms(frm.items || []);
      } catch { /* selectores opcionales */ }
    }
    void loadSelectors();
    return () => { cancelled = true; };
  }, []);

  const filteredForms = filters.template_id
    ? forms.filter((f) => f.template_id === filters.template_id)
    : forms;

  async function loadSubmissions(page = 1) {
    setIsLoading(true);
    setHasLoadError(false);
    try {
      const result = await listSubmissions({
        page, limit: 20,
        form_id:     filters.form_id     || undefined,
        template_id: filters.template_id || undefined,
        period:      filters.period      || undefined,
        search:      filters.search      || undefined,
      });
      setSubmissions(result.items || []);
      setPagination(result.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err) {
      setHasLoadError(true);
      notifyError(err, 'No se pudieron cargar las respuestas.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() { await loadSubmissions(currentPage); if (cancelled) return; }
    void load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentPage]);

  function handleFilterChange(key, value) {
    setCurrentPage(1);
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'template_id' ? { form_id: '' } : {}),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card variant="default">
        <SectionCardHeader
          section="Respuestas"
          title="Todas las respuestas"
          description="Consulta y filtra todas las respuestas recibidas en tus formularios."
        />
      </Card>

      {/* ── Barra de filtros compacta ── */}
      <Card variant="secondary">
        <Card.Content className="py-3 px-4">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          {/* Selects de template y formulario */}
          <Select
            aria-label="Filtrar por template"
            className="min-w-45 max-w-60 shrink-0"
            placeholder="Todos los templates"
            size="sm"
            value={filters.template_id || '__all_templates__'}
            onChange={(value) => handleFilterChange('template_id', value === '__all_templates__' ? '' : String(value ?? ''))}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="__all_templates__" textValue="Todos los templates">
                  Todos los templates
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {templates.map((t) => (
                  <ListBox.Item key={t.id} id={String(t.id)} textValue={t.name}>
                    {t.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Select
            aria-label="Filtrar por formulario"
            className="min-w-50 max-w-70 shrink-0"
            placeholder="Todos los formularios"
            size="sm"
            value={filters.form_id || '__all_forms__'}
            onChange={(value) => handleFilterChange('form_id', value === '__all_forms__' ? '' : String(value ?? ''))}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="__all_forms__" textValue="Todos los formularios">
                  Todos los formularios
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {filteredForms.map((f) => (
                  <ListBox.Item key={f.id} id={String(f.id)} textValue={f.title}>
                    {f.title}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <Separator orientation="vertical" className="mx-1 hidden h-7 shrink-0 md:block" />

          {/* Período */}
          <ButtonGroup size="sm" className="shrink-0">
            {PERIOD_OPTIONS.map((opt, i) => (
              <Button
                key={opt.value || 'all'}
                onPress={() => handleFilterChange('period', opt.value)}
                variant={filters.period === opt.value ? 'primary' : 'secondary'}
              >
                {i > 0 && <ButtonGroup.Separator />}
                {opt.label}
              </Button>
            ))}
          </ButtonGroup>

          <Separator orientation="vertical" className="mx-1 hidden h-7 shrink-0 md:block" />

          {/* Búsqueda */}
          <Input
            className="min-w-56 flex-1"
            placeholder="Buscar en respuestas..."
            size="sm"
            value={filters.search}
            variant="secondary"
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />

          {/* Contador */}
          {!isLoading && (
            <span className="shrink-0 text-xs opacity-50 sm:ml-auto">
              {pagination.total} resultado{pagination.total !== 1 ? 's' : ''}
            </span>
          )}
          </div>
        </Card.Content>
      </Card>

      {/* ── Tabla ── */}
      {isLoading ? (
        <Card variant="secondary">
          <Card.Content className="flex items-center gap-3 py-8">
            <Spinner size="sm" /><span className="text-sm opacity-70">Cargando respuestas...</span>
          </Card.Content>
        </Card>
      ) : hasLoadError ? (
        <Card variant="secondary">
          <Card.Content className="py-6 text-center text-sm opacity-70">
            No se pudieron cargar las respuestas.{' '}
            <button className="underline" onClick={() => loadSubmissions(currentPage)}>Reintentar</button>
          </Card.Content>
        </Card>
      ) : submissions.length === 0 ? (
        <Card variant="secondary">
          <Card.Content className="py-8 text-center">
            <p className="text-sm font-medium opacity-60">Sin resultados</p>
            <p className="mt-1 text-xs opacity-40">Intenta cambiar los filtros</p>
          </Card.Content>
        </Card>
      ) : (
        <Card variant="secondary">
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Respuestas de formularios"
                className="min-w-245"
                onRowAction={(key) => navigate(`/submissions/${encodeURIComponent(String(key))}`)}
              >
                <Table.Header>
                  <Table.Column isRowHeader className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                    Formulario
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                    Template
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                    Fecha
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                    Identificador
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                    Estado
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5" />
                </Table.Header>
                <Table.Body>
                  {submissions.map((sub) => (
                    <Table.Row key={sub.id} id={sub.id} className="cursor-pointer">
                      <Table.Cell className="px-4 py-3 font-medium">{sub.form?.title ?? '—'}</Table.Cell>
                      <Table.Cell className="px-4 py-3 text-xs opacity-60">{sub.form?.template?.name ?? '—'}</Table.Cell>
                      <Table.Cell className="px-4 py-3 text-xs tabular-nums opacity-70">{formatDate(sub.created_at)}</Table.Cell>
                      <Table.Cell className="px-4 py-3 font-mono text-xs opacity-50">
                        {sub.submission_identifier
                          ? `${sub.submission_identifier_source}: ${sub.submission_identifier}`
                          : '—'}
                      </Table.Cell>
                      <Table.Cell className="px-4 py-3">
                        {sub.submission_lock_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft-hover px-2 py-0.5 text-xs text-warning">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft-hover px-2 py-0.5 text-xs text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Libre
                          </span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-4 py-3 text-right text-xs opacity-60">Ver →</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          {pagination.totalPages > 1 && (
            <Card.Footer className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-2.5">
              <span className="text-xs opacity-50">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" isDisabled={currentPage <= 1}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                <Button size="sm" variant="secondary" isDisabled={currentPage >= pagination.totalPages}
                  onPress={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}>Siguiente</Button>
              </div>
            </Card.Footer>
          )}
        </Card>
      )}
    </div>
  );
}
