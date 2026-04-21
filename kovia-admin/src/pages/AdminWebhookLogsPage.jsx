import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs, Button, Card, Input, ListBox, Select, Spinner, Table } from '@heroui/react';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import { getWebhookWithForms, listWebhookLogs, retryWebhookLog } from '../lib/admin/webhooks';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

const STATUS_OPTIONS = [
  { id: '__all_status__', label: 'Todos los estados' },
  { id: 'success', label: 'Exitoso' },
  { id: 'http_error', label: 'Error HTTP' },
  { id: 'error', label: 'Error de ejecución' },
  { id: 'pending', label: 'Pendiente' },
];

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function shortId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (raw.length <= 18) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-6)}`;
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

function truncateText(value, max = 150) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}...`;
}

export default function AdminWebhookLogsPage() {
  const { webhookId } = useParams();
  const navigate = useNavigate();

  const [isLoadingWebhook, setIsLoadingWebhook] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [hasLogsError, setHasLogsError] = useState(false);

  const [webhook, setWebhook] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [reloadSeed, setReloadSeed] = useState(0);
  const [retryingLogId, setRetryingLogId] = useState('');
  const [filters, setFilters] = useState({
    form_id: '',
    status: '',
    search: '',
  });

  const availableForms = useMemo(() => {
    const map = new Map();
    for (const config of webhook?.form_configs || []) {
      if (!config?.form?.id) continue;
      if (!map.has(config.form.id)) {
        map.set(config.form.id, {
          id: config.form.id,
          title: config.form.title || config.form.id,
        });
      }
    }
    return Array.from(map.values());
  }, [webhook?.form_configs]);

  useEffect(() => {
    let cancelled = false;

    async function loadWebhook() {
      setIsLoadingWebhook(true);
      try {
        const response = await getWebhookWithForms(webhookId);
        if (cancelled) return;
        setWebhook(response);
      } catch (err) {
        if (!cancelled) {
          notifyError(err, 'No se pudo cargar el webhook.');
          setWebhook(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWebhook(false);
        }
      }
    }

    void loadWebhook();
    return () => {
      cancelled = true;
    };
  }, [webhookId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setIsLoadingLogs(true);
      setHasLogsError(false);

      try {
        const response = await listWebhookLogs(webhookId, {
          page: currentPage,
          limit: 20,
          form_id: filters.form_id || undefined,
          status: filters.status || undefined,
        });

        if (cancelled) return;
        setLogs(response.items || []);
        setPagination(response.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
      } catch (err) {
        if (!cancelled) {
          setHasLogsError(true);
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
  }, [webhookId, currentPage, filters.form_id, filters.status, reloadSeed]);

  const visibleLogs = useMemo(() => {
    const q = String(filters.search || '').trim().toLowerCase();
    if (!q) return logs;

    return logs.filter((entry) => {
      const haystack = [
        entry?.form?.title,
        entry?.submission_id,
        entry?.request_method,
        entry?.request_url,
        entry?.status,
        entry?.response_status,
        entry?.error_message,
        entry?.response_body,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');

      return haystack.includes(q);
    });
  }, [logs, filters.search]);

  function handleFilterChange(key, value) {
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRetryLog(logId) {
    const safeLogId = String(logId || '').trim();
    if (!safeLogId || retryingLogId) {
      return;
    }

    setRetryingLogId(safeLogId);

    try {
      const result = await retryWebhookLog(webhookId, safeLogId);
      const status = String(result?.status || '').trim();
      const statusLabel = getStatusMeta(status).label.toLowerCase();
      notifySuccess(`Reintento ejecutado. Resultado: ${statusLabel}.`);
      setReloadSeed((prev) => prev + 1);
    } catch (err) {
      notifyError(err, 'No se pudo rehacer la petición de este log.');
    } finally {
      setRetryingLogId('');
    }
  }

  if (isLoadingWebhook) {
    return (
      <Card variant="secondary">
        <Card.Content className="flex items-center gap-3 py-8">
          <Spinner size="sm" />
          <span>Cargando webhook...</span>
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

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/webhooks">Webhooks</Breadcrumbs.Item>
        <Breadcrumbs.Item href={`/webhooks/${encodeURIComponent(webhook.id)}`}>{webhook.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>Logs</Breadcrumbs.Item>
      </Breadcrumbs>

      <Card variant="default">
        <SectionCardHeader
          section="Webhooks"
          title="Historial de logs"
          description={`${webhook.method} → ${webhook.url}`}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onPress={() => navigate(`/webhooks/${encodeURIComponent(webhook.id)}`)}>
                Configurar webhook
              </Button>
              <Button size="sm" variant="secondary" onPress={() => navigate('/webhooks')}>
                ← Volver
              </Button>
            </div>
          }
        />
      </Card>

      <Card variant="secondary">
        <Card.Content className="py-3 px-4">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <Select
              aria-label="Filtrar logs por formulario"
              className="min-w-58 max-w-70 shrink-0"
              placeholder="Todos los formularios"
              size="sm"
              value={filters.form_id || '__all_forms__'}
              onChange={(value) => handleFilterChange('form_id', value === '__all_forms__' ? '' : String(value || ''))}
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
                  {availableForms.map((entry) => (
                    <ListBox.Item key={entry.id} id={entry.id} textValue={entry.title}>
                      {entry.title}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              aria-label="Filtrar logs por estado"
              className="min-w-50 max-w-60 shrink-0"
              placeholder="Todos los estados"
              size="sm"
              value={filters.status || '__all_status__'}
              onChange={(value) => handleFilterChange('status', value === '__all_status__' ? '' : String(value || ''))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {STATUS_OPTIONS.map((entry) => (
                    <ListBox.Item key={entry.id} id={entry.id} textValue={entry.label}>
                      {entry.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Input
              className="min-w-64 flex-1"
              placeholder="Buscar en submission, URL, estado o detalle"
              size="sm"
              variant="secondary"
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
            />

            {!isLoadingLogs && (
              <span className="shrink-0 text-xs opacity-55 sm:ml-auto">
                {visibleLogs.length} visibles en página · {pagination.total} total
              </span>
            )}
          </div>
        </Card.Content>
      </Card>

      {isLoadingLogs ? (
        <Card variant="secondary">
          <Card.Content className="flex items-center gap-3 py-8">
            <Spinner size="sm" />
            <span className="text-sm opacity-75">Cargando logs...</span>
          </Card.Content>
        </Card>
      ) : hasLogsError ? (
        <Card variant="secondary">
          <Card.Content className="py-6 text-center text-sm opacity-70">
            <p>Ocurrió un problema al cargar los logs.</p>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              onPress={() => {
                setHasLogsError(false);
                setReloadSeed((prev) => prev + 1);
              }}
            >
              Reintentar
            </Button>
          </Card.Content>
        </Card>
      ) : visibleLogs.length === 0 ? (
        <Card variant="secondary">
          <Card.Content className="py-8 text-center">
            <p className="text-sm font-medium opacity-65">Sin logs para los filtros actuales</p>
            <p className="mt-1 text-xs opacity-45">Envía nuevas respuestas o ajusta filtros.</p>
          </Card.Content>
        </Card>
      ) : (
        <Card variant="secondary">
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Historial profesional de logs de webhooks" className="min-w-300">
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
                    Destino
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60">
                    Detalle
                  </Table.Column>
                  <Table.Column className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest opacity-60 text-right">
                    Acción
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {visibleLogs.map((entry) => {
                    const statusMeta = getStatusMeta(entry.status);
                    const detailRaw = String(entry.error_message || entry.response_body || '').trim();
                    const isRetryingThisLog = retryingLogId === entry.id;

                    return (
                      <Table.Row key={entry.id} id={entry.id}>
                        <Table.Cell className="px-4 py-3 text-xs tabular-nums opacity-85">
                          {formatDate(entry.triggered_at || entry.created_at)}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-sm font-medium">
                          {entry.form?.title || entry.form_id || '—'}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 font-mono text-xs opacity-70">
                          {shortId(entry.submission_id)}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-xs font-medium">
                          {entry.response_status ?? '—'}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-xs">
                          {typeof entry.duration_ms === 'number' ? `${entry.duration_ms} ms` : '—'}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 font-mono text-xs opacity-65" title={entry.request_url || ''}>
                          {truncateText(entry.request_url, 52)}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-xs opacity-80" title={detailRaw || ''}>
                          {truncateText(detailRaw)}
                        </Table.Cell>
                        <Table.Cell className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={Boolean(retryingLogId)}
                            onPress={() => handleRetryLog(entry.id)}
                          >
                            {isRetryingThisLog ? 'Reintentando...' : 'Rehacer petición'}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>

          {pagination.totalPages > 1 && (
            <Card.Footer className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-2.5">
              <span className="text-xs opacity-55">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={currentPage <= 1}
                  onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={currentPage >= pagination.totalPages}
                  onPress={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </Card.Footer>
          )}
        </Card>
      )}
    </div>
  );
}
