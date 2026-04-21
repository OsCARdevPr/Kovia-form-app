import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Spinner } from '@heroui/react';
import { getSubmission, reactivateSubmission } from '../lib/admin/submissions';
import SectionCardHeader from '../components/ui/SectionCardHeader';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

function formatDate(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function extractQuestions(config) {
  if (!config?.steps) return [];
  const questions = [];
  for (const step of config.steps) {
    if (step.questions) {
      for (const q of step.questions) {
        questions.push({ id: q.id, label: q.label, type: q.type, step: step.title });
      }
    }
  }
  return questions;
}

function renderAnswerValue(value) {
  if (value === null || value === undefined || value === '') {
    return <span className="italic opacity-30">Sin respuesta</span>;
  }
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span key={i} className="rounded-md bg-muted/40 px-2 py-0.5 text-xs font-medium">{v}</span>
        ))}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

const TYPE_ICON = {
  email: '✉️', telefono: '📞', date: '📅', 'date-time': '🕐',
  price: '💲', textarea: '📝', radio: '⚪', checkbox: '☑️',
  select: '▾', text: '✏️',
};

export default function AdminSubmissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading]           = useState(true);
  const [isReactivating, setIsReactivating] = useState(false);
  const [submission, setSubmission]         = useState(null);
  const [notFound, setNotFound]             = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const data = await getSubmission(id);
        if (cancelled) return;
        setSubmission(data);
      } catch (err) {
        if (cancelled) return;
        if (err.status === 404) setNotFound(true);
        else notifyError(err, 'No se pudo cargar la respuesta.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleReactivate() {
    setIsReactivating(true);
    try {
      await reactivateSubmission(id);
      notifySuccess('Reenvío reactivado correctamente.');
      const updated = await getSubmission(id);
      setSubmission(updated);
    } catch (err) {
      notifyError(err, 'No se pudo reactivar el reenvío.');
    } finally {
      setIsReactivating(false);
    }
  }

  if (isLoading) {
    return (
      <Card variant="secondary">
        <Card.Content className="flex items-center gap-3 py-10">
          <Spinner size="sm" />
          <span className="text-sm opacity-60">Cargando respuesta...</span>
        </Card.Content>
      </Card>
    );
  }

  if (notFound || !submission) {
    return (
      <div className="flex flex-col gap-4">
        <Card variant="secondary">
          <Card.Content className="py-8 text-center text-sm opacity-60">
            Respuesta no encontrada.
          </Card.Content>
        </Card>
        <Button variant="secondary" onPress={() => navigate('/submissions')}>
          ← Volver a Respuestas
        </Button>
      </div>
    );
  }

  const questions = extractQuestions(submission.form?.config);
  const answers   = submission.answers || {};

  // Agrupar preguntas por paso
  const byStep = {};
  for (const q of questions) {
    const stepKey = q.step || 'Sin paso';
    if (!byStep[stepKey]) byStep[stepKey] = [];
    byStep[stepKey].push(q);
  }

  // Fallback: raw answers si no hay config de preguntas
  const rawEntries = questions.length === 0 ? Object.entries(answers) : [];
  const submissionCreatedAt = submission?.created_at ?? null;

  return (
    <div className="flex flex-col gap-4">

      {/* ── Header ── */}
      <Card variant="default">
        <SectionCardHeader
          section="Respuestas"
          title="Detalle de envío"
          description={`ID: ${submission.id}`}
          action={
            <Button size="sm" variant="secondary" onPress={() => navigate('/submissions')}>
              ← Volver
            </Button>
          }
        />
      </Card>

      {/* ── Ficha de metadatos ── */}
      <Card variant="secondary">
        <Card.Content className="py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <MetaField label="Formulario" value={submission.form?.title ?? '—'} />
            <MetaField label="Template" value={submission.form?.template?.name ?? '—'} />
            <MetaField label="Fecha de envío" value={formatDate(submissionCreatedAt)} />
            <MetaField
              label="Estado"
              value={
                submission.submission_lock_active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft-hover px-2.5 py-0.5 text-xs text-warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />Bloqueado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft-hover px-2.5 py-0.5 text-xs text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />Libre
                  </span>
                )
              }
            />
            {submission.submission_identifier && (
              <MetaField
                label={`Identificador (${submission.submission_identifier_source})`}
                value={<span className="font-mono text-xs">{submission.submission_identifier}</span>}
              />
            )}
            {submission.metadata?.ip && (
              <MetaField label="IP" value={<span className="font-mono text-xs">{submission.metadata.ip}</span>} />
            )}
          </div>
        </Card.Content>
      </Card>

      {/* ── Respuestas por paso ── */}
      {Object.keys(byStep).length > 0 && Object.entries(byStep).map(([stepTitle, stepQuestions]) => (
        <Card key={stepTitle} variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm font-semibold opacity-70">{stepTitle}</Card.Title>
          </Card.Header>
          <Card.Content className="pt-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stepQuestions.map((q) => (
                <AnswerCard
                  key={q.id}
                  label={q.label}
                  type={q.type}
                  value={answers[q.id]}
                />
              ))}
            </div>
          </Card.Content>
        </Card>
      ))}

      {/* Fallback si no hay config */}
      {rawEntries.length > 0 && (
        <Card variant="secondary">
          <Card.Header>
            <Card.Title>Respuestas</Card.Title>
          </Card.Header>
          <Card.Content className="pt-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rawEntries.map(([key, value]) => (
                <AnswerCard key={key} label={key} type="text" value={value} mono />
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {questions.length === 0 && rawEntries.length === 0 && (
        <Card variant="secondary">
          <Card.Content className="py-6 text-center text-sm opacity-50">
            No hay respuestas registradas.
          </Card.Content>
        </Card>
      )}

      {/* ── Acciones admin ── */}
      <Card variant="secondary">
        <Card.Content className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Acción administrativa</p>
            {submission.submission_lock_active ? (
              <p className="mt-1 text-sm">El envío está bloqueado. Puedes reactivarlo para permitir un nuevo envío.</p>
            ) : (
              <p className="mt-1 text-sm opacity-60">El envío está libre. El usuario puede volver a enviar.</p>
            )}
          </div>
          {submission.submission_lock_active && (
            <Button
              size="sm"
              variant="secondary"
              isDisabled={isReactivating}
              onPress={handleReactivate}
            >
              {isReactivating ? 'Reactivando...' : 'Reactivar reenvío'}
            </Button>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function MetaField({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-widest opacity-40">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function AnswerCard({ label, type, value, mono = false }) {
  const icon = TYPE_ICON[type] || '·';
  const isEmpty = value === null || value === undefined || value === '';

  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 transition-colors ${
      isEmpty
        ? 'border-border/30 bg-muted/5'
        : 'border-border/50 bg-muted/10 hover:bg-muted/20'
    }`}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs opacity-40">{icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide opacity-50 ${mono ? 'font-mono' : ''}`}>
          {label}
        </span>
      </div>
      <div className="text-sm font-medium leading-snug">
        {renderAnswerValue(value)}
      </div>
    </div>
  );
}
