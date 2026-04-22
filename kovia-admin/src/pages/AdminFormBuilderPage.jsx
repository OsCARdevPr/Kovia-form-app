import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertDialog, Breadcrumbs, Button, Card, Dropdown, Input, Label, Modal, ScrollShadow, Separator, Spinner, Switch, Tabs } from '@heroui/react';
import { archiveFormSubmissions, deleteForm, exportForm, getFormById, importForm, updateForm, validateFormConfig } from '../lib/admin/forms';
import { formConfigSchema } from '../lib/admin/schemas';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPTION_BASED_TYPES = new Set(['radio', 'checkbox', 'select']);

const FIELD_TYPE_META = {
  text:        { label: 'Texto',             short: 'Texto',   placeholder: 'Escribe tu respuesta',           icon: '✏️' },
  textarea:    { label: 'Texto largo',        short: 'Párrafo', placeholder: 'Escribe tu respuesta detallada', icon: '📝' },
  email:       { label: 'Correo',             short: 'Email',   placeholder: 'nombre@empresa.com',             icon: '✉️' },
  telefono:    { label: 'Teléfono',           short: 'Tel.',    placeholder: '77771234',                       icon: '📞' },
  radio:       { label: 'Selección única',    short: 'Radio',   placeholder: '',                               icon: '⚪' },
  checkbox:    { label: 'Selección múltiple', short: 'Check',   placeholder: '',                               icon: '☑️' },
  select:      { label: 'Lista desplegable',  short: 'Select',  placeholder: '',                               icon: '▾'  },
  date:        { label: 'Fecha',              short: 'Fecha',   placeholder: 'YYYY-MM-DD',                     icon: '📅' },
  'date-time': { label: 'Fecha y hora',       short: 'F+Hora',  placeholder: 'YYYY-MM-DD HH:mm',              icon: '🕐' },
  price:       { label: 'Precio',             short: 'Precio',  placeholder: '0.00',                           icon: '💲' },
};

const QUESTION_TYPE_OPTIONS = Object.keys(FIELD_TYPE_META);
const IDENTIFIER_STRATEGIES = ['ip', 'header', 'ip_then_header', 'header_then_ip'];
const FORM_SUBMISSION_ID_SOURCE_FIELD = '__form_submission_id__';
const FORM_SUBMISSION_ID_SOURCE_LABEL = 'Sistema: ID del envio (form_submission.id)';
const FORM_URL_BASE = String(import.meta.env.FORM_URL_BASE || import.meta.env.VITE_FORM_URL_BASE || '')
  .trim()
  .replace(/\/+$/, '');
const EMBED_SANDBOX_ATTR = 'allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';
const EMBED_ALLOW_ATTR_BASE = 'fullscreen';

const DEFAULT_INTRO_SCREEN_CONFIG = {
  brand_text: 'Kovia',
  subtitle_text: 'Pre-Onboarding',
  lead_text: 'Antes de nuestra reunión, completa este formulario.',
  support_prefix_text: 'Con esta información',
  support_highlight_primary_text: 'trazaremos tu flujo de ventas actual',
  support_middle_text: 'y llegaremos con un',
  support_highlight_secondary_text: 'borrador listo',
  support_suffix_text: 'para revisar juntos.',
  estimated_time_text: '≈ 8 minutos',
  start_button_text: 'Comenzar',
  loading_button_text: 'Cargando...',
};

const DEFAULT_CONFIG = {
  version: 1,
  validation_engine: 'z-rules-v1',
  field_type_index: {
    text:        { ui: 'input',        html_input_type: 'text'  },
    textarea:    { ui: 'textarea'                               },
    radio:       { ui: 'radio-group'                            },
    checkbox:    { ui: 'checkbox-group'                         },
    select:      { ui: 'select'                                 },
    telefono:    { ui: 'masked-input', html_input_type: 'tel',  mask_preset: 'telefono',     validation_preset: 'telefono',     default_placeholder: '77771234'         },
    email:       { ui: 'input',        html_input_type: 'email',                             validation_preset: 'email',        default_placeholder: 'nombre@empresa.com'},
    date:        { ui: 'masked-input', html_input_type: 'text', mask_preset: 'date-iso',     validation_preset: 'date-iso',     default_placeholder: 'YYYY-MM-DD'       },
    'date-time': { ui: 'masked-input', html_input_type: 'text', mask_preset: 'date-time-iso',validation_preset: 'date-time-iso',default_placeholder: 'YYYY-MM-DD HH:mm' },
    price:       { ui: 'masked-input', html_input_type: 'text', mask_preset: 'price',        validation_preset: 'price',        default_placeholder: '0.00'             },
  },
  completion_action: {
    type: 'redirect', url: '', button_label: 'Continuar', open_in_new_tab: true,
    title: '', description: '', embed_url: '', embed_height: 720, redirect_params: [],
  },
  submission_policy: {
    enabled: true, once_per_identifier: true, identifier_strategy: 'ip_then_header',
    identifier_header: 'x-form-identifier', allow_reactivation: true,
  },
  intro_screen: { ...DEFAULT_INTRO_SCREEN_CONFIG },
  steps: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTypeMeta(type) {
  return FIELD_TYPE_META[String(type || '').trim()] || FIELD_TYPE_META.text;
}
function shouldUseOptions(type) {
  return OPTION_BASED_TYPES.has(String(type || '').trim());
}
function createQuestionId() {
  return `field_${Math.random().toString(36).slice(2, 8)}`;
}
function safeStringify(v) {
  try { return JSON.stringify(v, null, 2); } catch { return '{}'; }
}
function buildDownloadFile(filename, content) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeHttpUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }

    return '';
  } catch {
    return '';
  }
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeEmbedDimension(value, { min, max, fallback }) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function buildPublicFormUrl(slug) {
  const cleanSlug = String(slug || '').trim();
  if (!FORM_URL_BASE || !cleanSlug) return '';

  return sanitizeHttpUrl(`${FORM_URL_BASE}/${encodeURIComponent(cleanSlug)}`);
}

function buildIframeEmbedCode({
  formUrl,
  frameTitle,
  height,
  maxWidth,
  allowCameraAndMicrophone,
}) {
  const safeFormUrl = sanitizeHttpUrl(formUrl);
  if (!safeFormUrl) return '';

  const safeTitle = String(frameTitle || 'Formulario Lead Qualificator de Kovia').trim() || 'Formulario Lead Qualificator de Kovia';
  const safeHeight = normalizeEmbedDimension(height, { min: 520, max: 2200, fallback: 920 });
  const safeMaxWidth = normalizeEmbedDimension(maxWidth, { min: 360, max: 1800, fallback: 980 });
  const allowAttr = allowCameraAndMicrophone
    ? `${EMBED_ALLOW_ATTR_BASE}; camera; microphone`
    : EMBED_ALLOW_ATTR_BASE;

  return [
    '<!-- Kovia Form Embed (Lead Qualificator) -->',
    `<div style="width:100%;max-width:${safeMaxWidth}px;margin:0 auto;">`,
    '  <iframe',
    `    src="${escapeHtmlAttribute(safeFormUrl)}"`,
    `    title="${escapeHtmlAttribute(safeTitle)}"`,
    '    loading="lazy"',
    '    referrerpolicy="strict-origin-when-cross-origin"',
    `    sandbox="${EMBED_SANDBOX_ATTR}"`,
    `    allow="${escapeHtmlAttribute(allowAttr)}"`,
    `    style="width:100%;height:${safeHeight}px;border:0;border-radius:24px;overflow:hidden;background:transparent;"`,
    '  ></iframe>',
    '</div>',
  ].join('\n');
}

function resolveSwitchValue(valueOrEvent) {
  if (typeof valueOrEvent === 'boolean') return valueOrEvent;
  if (valueOrEvent && typeof valueOrEvent === 'object') {
    if (typeof valueOrEvent.target?.checked === 'boolean') return valueOrEvent.target.checked;
    if (typeof valueOrEvent.currentTarget?.checked === 'boolean') return valueOrEvent.currentTarget.checked;
  }
  return Boolean(valueOrEvent);
}

function normalizeSliderMarks(rawMarks, min, max) {
  if (!Array.isArray(rawMarks)) return [];

  return rawMarks
    .map((mark) => {
      if (!mark || typeof mark !== 'object') return null;
      const value = toFiniteNumber(mark.value, NaN);
      if (!Number.isFinite(value)) return null;
      return {
        value,
        label: String(mark.label || '').trim() || String(value),
      };
    })
    .filter((mark) => mark && mark.value >= min && mark.value <= max);
}

function normalizeSliderConfig(rawSlider, validation) {
  const rules = Array.isArray(validation?.z) ? validation.z : [];

  const minFromRules = rules.find((rule) => rule?.rule === 'minValue');
  const maxFromRules = rules.find((rule) => rule?.rule === 'maxValue');

  let min = toFiniteNumber(rawSlider?.min, toFiniteNumber(minFromRules?.value, 0));
  let max = toFiniteNumber(rawSlider?.max, toFiniteNumber(maxFromRules?.value, Math.max(min + 1, 100)));
  if (max <= min) {
    max = min + 1;
  }

  const step = toFiniteNumber(rawSlider?.step, 1);

  return {
    min,
    max,
    step: step > 0 ? step : 1,
    prefix: typeof rawSlider?.prefix === 'string' ? rawSlider.prefix : '$',
    unitSuffix: typeof rawSlider?.unitSuffix === 'string' ? rawSlider.unitSuffix : '',
    showPlusAtMax: Boolean(rawSlider?.showPlusAtMax),
    confirmLabel: typeof rawSlider?.confirmLabel === 'string' ? rawSlider.confirmLabel : '',
    marks: normalizeSliderMarks(rawSlider?.marks, min, max),
  };
}

function normalizeRedirectParams(rawParams) {
  if (!Array.isArray(rawParams)) return [];

  return rawParams
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;

      return {
        key: String(entry.key || entry.param || entry.name || '').trim(),
        source_field: String(entry.source_field || entry.field || entry.from || '').trim(),
      };
    })
    .filter(Boolean);
}

function normalizeIntroScreenConfig(rawIntroScreen) {
  const source = rawIntroScreen && typeof rawIntroScreen === 'object' ? rawIntroScreen : {};
  const normalized = {};

  for (const [key, fallback] of Object.entries(DEFAULT_INTRO_SCREEN_CONFIG)) {
    const candidate = typeof source[key] === 'string' ? source[key].trim() : '';
    normalized[key] = candidate || fallback;
  }

  return normalized;
}

function normalizeQuestion(question, index) {
  const normalizedType = String(question?.type || 'text').trim() || 'text';
  const meta = getTypeMeta(normalizedType);
  const base = {
    id:               String(question?.id || createQuestionId()).trim() || createQuestionId(),
    type:             normalizedType,
    label:            String(question?.label || `Pregunta ${index + 1}`).trim() || `Pregunta ${index + 1}`,
    required:         Boolean(question?.required),
    placeholder:      String(question?.placeholder || '').trim(),
    hint:             typeof question?.hint === 'string' ? question.hint : '',
    required_message: typeof question?.required_message === 'string' ? question.required_message : '',
    validation:       question?.validation && typeof question.validation === 'object' ? question.validation : { z: [] },
    visible_when:     question?.visible_when && typeof question.visible_when === 'object' ? question.visible_when : undefined,
    mask:             question?.mask && typeof question.mask === 'object' ? question.mask : undefined,
    mask_preset:      typeof question?.mask_preset === 'string' ? question.mask_preset : undefined,
  };
  if (!base.placeholder && meta.placeholder) base.placeholder = meta.placeholder;
  if (shouldUseOptions(base.type)) {
    const options = Array.isArray(question?.options)
      ? question.options.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    base.options = options.length > 0 ? options : ['Opción 1', 'Opción 2'];

    // Keep enum z-rule in sync with current options
    const zRules = Array.isArray(base.validation?.z) ? [...base.validation.z] : [];
    const enumIdx = zRules.findIndex((r) => r?.rule === 'enum');
    if (enumIdx >= 0) {
      zRules[enumIdx] = { ...zRules[enumIdx], options: [...base.options] };
    } else {
      zRules.push({ rule: 'enum', message: 'Selecciona una opción válida', options: [...base.options] });
    }
    base.validation = { ...(base.validation || { z: [] }), z: zRules };
  } else {
    delete base.options;
    // Remove stale enum rule when field is not option-based
    if (Array.isArray(base.validation?.z) && base.validation.z.some((r) => r?.rule === 'enum')) {
      base.validation = { ...base.validation, z: base.validation.z.filter((r) => r?.rule !== 'enum') };
    }
  }

  if (base.type === 'price' && question?.slider && typeof question.slider === 'object') {
    base.slider = normalizeSliderConfig(question.slider, base.validation);
  } else {
    delete base.slider;
  }

  const normalizedQuestion = { ...question, ...base };

  if (!shouldUseOptions(base.type)) {
    delete normalizedQuestion.options;
  }

  if (base.type !== 'price') {
    delete normalizedQuestion.slider;
  }

  return normalizedQuestion;
}

function normalizeConfigForEditor(rawConfig) {
  const safe = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const ca   = safe.completion_action  && typeof safe.completion_action  === 'object' ? safe.completion_action  : {};
  const sp   = safe.submission_policy  && typeof safe.submission_policy  === 'object' ? safe.submission_policy  : {};
  const intro = safe.intro_screen && typeof safe.intro_screen === 'object' ? safe.intro_screen : {};

  const normalizedCompletionAction = {
    ...DEFAULT_CONFIG.completion_action,
    ...ca,
    redirect_params: normalizeRedirectParams(ca.redirect_params || ca.query_params),
  };

  return {
    ...DEFAULT_CONFIG, ...safe,
    field_type_index:  { ...DEFAULT_CONFIG.field_type_index,  ...(safe.field_type_index  || {}) },
    completion_action: normalizedCompletionAction,
    submission_policy: { ...DEFAULT_CONFIG.submission_policy, ...sp },
    intro_screen: normalizeIntroScreenConfig(intro),
    steps: (Array.isArray(safe.steps) ? safe.steps : []).map((step, i) => ({
      ...step,
      order:       i + 1,
      title:       String(step?.title || `Paso ${i + 1}`).trim() || `Paso ${i + 1}`,
      short_label: typeof step?.short_label === 'string' ? step.short_label : '',
      questions:   Array.isArray(step?.questions)
        ? step.questions.map((q, qi) => normalizeQuestion(q, qi))
        : [],
    })),
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-default-500 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-default-400">{hint}</p>}
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs font-bold text-default-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-default-200" />
    </div>
  );
}

// ─── PreviewQuestion — campo clickeable en la vista previa ───────────────────

function PreviewQuestion({ question, isSelected, onSelect }) {
  const meta = getTypeMeta(question.type);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-xl border transition-all group relative overflow-hidden',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/15'
          : 'border-default-200 hover:border-primary/30 hover:bg-default-50',
      ].join(' ')}
    >
      {/* Left accent strip */}
      <span
        aria-hidden="true"
        className={[
          'absolute inset-y-0 left-0 w-0.75 transition-opacity',
          isSelected
            ? 'bg-primary opacity-100'
            : 'bg-primary/40 opacity-0 group-hover:opacity-100',
        ].join(' ')}
      />

      <div className="pl-4 pr-3 py-2.5 flex flex-col gap-1.5">
        {/* Top row: type chip · required badge · edit indicator */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={[
            'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 leading-none',
            isSelected
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-default-100 text-default-500 border-default-200',
          ].join(' ')}>
            <span>{meta.icon}</span>
            <span>{meta.short}</span>
          </span>

          {question.required && (
            <span className="text-[9px] font-bold text-danger bg-danger/8 px-1.5 py-0.5 rounded border border-danger-soft shrink-0 leading-none">
              req
            </span>
          )}

          <span className={[
            'ml-auto text-[10px] font-medium shrink-0 transition-all',
            isSelected
              ? 'text-primary opacity-100'
              : 'text-default-400 opacity-0 group-hover:opacity-100',
          ].join(' ')}>
            {isSelected ? '✎ editando' : 'editar →'}
          </span>
        </div>

        {/* Question label */}
        <p className="text-sm font-semibold text-default-800 truncate leading-snug">
          {question.label}
        </p>

        {/* Options preview as pills / placeholder text */}
        {shouldUseOptions(question.type) && Array.isArray(question.options) ? (
          <div className="flex flex-wrap gap-1">
            {question.options.slice(0, 3).map((opt) => (
              <span
                key={opt}
                className="text-[10px] bg-default-100 text-default-500 px-2 py-0.5 rounded-full border border-default-200 truncate max-w-32.5 leading-none"
              >
                {opt}
              </span>
            ))}
            {question.options.length > 3 && (
              <span className="text-[10px] text-default-400 px-1 leading-none self-center">
                +{question.options.length - 3}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-default-400 italic truncate leading-snug">
            {question.placeholder || meta.placeholder || '—'}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── FieldEditor — panel derecho de edición ───────────────────────────────────

function FieldEditor({ question, onUpdate, onRemove }) {
  const [labelDraft,       setLabelDraft]       = useState(question?.label ?? '');
  const [placeholderDraft, setPlaceholderDraft] = useState(question?.placeholder ?? '');
  const [optionsDraft,     setOptionsDraft]     = useState(
    Array.isArray(question?.options) ? question.options.join(', ') : ''
  );
  const [questionJsonDraft, setQuestionJsonDraft] = useState('');

  // Sync all drafts when a different question is selected or when its type changes
  // (type change resets options so we need to re-read them from the normalized question)
  useEffect(() => {
    setLabelDraft(question?.label ?? '');
    setPlaceholderDraft(question?.placeholder ?? '');
    setOptionsDraft(Array.isArray(question?.options) ? question.options.join(', ') : '');
    setQuestionJsonDraft(question ? safeStringify(question) : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, question?.type]);

  function applyQuestionJsonDraft() {
    try {
      const parsed = JSON.parse(questionJsonDraft || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Debe ser un objeto JSON.');
      onUpdate(parsed);
      notifySuccess('JSON de pregunta aplicado.');
    } catch (err) {
      notifyError(err?.message || 'JSON de pregunta inválido.');
    }
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 px-4">
        <div className="flex flex-col items-center gap-3 text-center rounded-2xl border-2 border-dashed border-default-200 px-8 py-10 w-full max-w-xs">
          <span className="text-4xl opacity-30 select-none">◎</span>
          <p className="text-sm font-semibold text-default-500">Sin campo seleccionado</p>
          <p className="text-xs text-default-400 leading-relaxed">
            Haz clic en cualquier campo del panel izquierdo para editar sus propiedades
          </p>
        </div>
      </div>
    );
  }

  const selectedQuestionType = question.type || 'text';
  const sliderEnabled = selectedQuestionType === 'price' && question?.slider && typeof question.slider === 'object';
  const sliderConfig = sliderEnabled ? normalizeSliderConfig(question.slider, question?.validation) : null;

  function toggleSlider(enabled) {
    if (selectedQuestionType !== 'price') return;
    if (enabled) {
      onUpdate({ slider: normalizeSliderConfig(question?.slider, question?.validation) });
      return;
    }
    onUpdate({ slider: undefined });
  }

  function updateSlider(patch) {
    if (!sliderConfig) return;

    let nextSlider = {
      ...sliderConfig,
      ...patch,
    };

    nextSlider = normalizeSliderConfig(nextSlider, question?.validation);
    onUpdate({ slider: nextSlider });
  }

  function updateSliderMark(markIndex, patch) {
    if (!sliderConfig) return;
    const marks = Array.isArray(sliderConfig.marks) ? sliderConfig.marks : [];
    const nextMarks = marks.map((mark, index) => (index === markIndex ? { ...mark, ...patch } : mark));
    updateSlider({ marks: nextMarks });
  }

  function addSliderMark() {
    if (!sliderConfig) return;
    const marks = Array.isArray(sliderConfig.marks) ? sliderConfig.marks : [];
    updateSlider({ marks: [...marks, { value: sliderConfig.min, label: String(sliderConfig.min) }] });
  }

  function removeSliderMark(markIndex) {
    if (!sliderConfig) return;
    const marks = Array.isArray(sliderConfig.marks) ? sliderConfig.marks : [];
    updateSlider({ marks: marks.filter((_, index) => index !== markIndex) });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-default-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0 leading-none">{getTypeMeta(selectedQuestionType).icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-default-800 truncate">{question.label}</p>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-default-400 uppercase tracking-wide">
              <span>{getTypeMeta(selectedQuestionType).label}</span>
              {question.required && <span className="text-danger">· requerido</span>}
            </span>
          </div>
        </div>
        <Button size="sm" variant="ghost" color="danger" onPress={onRemove}>Eliminar</Button>
      </div>

      <FieldRow label="Etiqueta visible">
        <input
          className="kovia-input"
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={() => {
            const trimmed = labelDraft.trim();
            if (!trimmed) {
              setLabelDraft(question?.label ?? '');
            } else {
              onUpdate({ label: trimmed });
            }
          }}
        />
      </FieldRow>

      <FieldRow label="Tipo de campo">
        <div className="grid grid-cols-5 gap-1">
          {QUESTION_TYPE_OPTIONS.map((type) => {
            const tm = getTypeMeta(type);
            const isActive = selectedQuestionType === type;
            return (
              <button
                key={type}
                type="button"
                title={tm.label}
                onClick={() => onUpdate({ type })}
                className={[
                  'flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-center transition-all',
                  isActive
                    ? 'border-primary bg-primary/8 text-primary shadow-sm'
                    : 'border-default-200 hover:border-primary/40 hover:bg-default-50 text-default-500 hover:text-default-700',
                ].join(' ')}
              >
                <span className="text-base leading-none">{tm.icon}</span>
                <span className="text-[9px] font-semibold leading-tight">{tm.short}</span>
              </button>
            );
          })}
        </div>
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Placeholder">
          <input
            className="kovia-input"
            value={placeholderDraft}
            onChange={(e) => setPlaceholderDraft(e.target.value)}
            onBlur={() => {
              const trimmed = placeholderDraft.trim();
              if (trimmed !== (question?.placeholder ?? '')) {
                onUpdate({ placeholder: trimmed });
              }
            }}
            placeholder={getTypeMeta(selectedQuestionType).placeholder}
          />
        </FieldRow>
        <FieldRow label="Hint">
          <input
            className="kovia-input"
            value={question.hint || ''}
            onChange={(e) => onUpdate({ hint: e.target.value })}
            placeholder="Texto de ayuda"
          />
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="ID del campo">
          <input
            className="kovia-input font-mono text-xs"
            value={question.id || ''}
            onChange={(e) => onUpdate({ id: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Mensaje obligatorio">
          <input
            className="kovia-input"
            value={question.required_message || ''}
            onChange={(e) => onUpdate({ required_message: e.target.value })}
            placeholder="Este campo es obligatorio"
          />
        </FieldRow>
      </div>

      <Switch
        isSelected={Boolean(question.required)}
        onChange={(v) => onUpdate({ required: v })}
      >
        <Switch.Control><Switch.Thumb /></Switch.Control>
        <Switch.Content className="text-sm">Campo obligatorio</Switch.Content>
      </Switch>

      {shouldUseOptions(selectedQuestionType) && (
        <FieldRow label="Opciones" hint="Separadas por coma">
          <input
            className="kovia-input"
            value={optionsDraft}
            onChange={(e) => setOptionsDraft(e.target.value)}
            onBlur={() => {
              const options = optionsDraft.split(',').map((v) => v.trim()).filter(Boolean);
              if (options.length === 0) {
                setOptionsDraft(Array.isArray(question?.options) ? question.options.join(', ') : '');
              } else {
                setOptionsDraft(options.join(', '));
                onUpdate({ options });
              }
            }}
            placeholder="Opción 1, Opción 2, Opción 3"
          />
        </FieldRow>
      )}

      {selectedQuestionType === 'price' && (
        <div className="flex flex-col gap-3 rounded-lg border border-default-200 p-3 bg-default-50">
          <SectionDivider label="Slider" />

          <Switch
            isSelected={sliderEnabled}
            onChange={(value) => toggleSlider(resolveSwitchValue(value))}
          >
            <Switch.Control><Switch.Thumb /></Switch.Control>
            <Switch.Content className="text-sm">Usar slider para este campo de precio</Switch.Content>
          </Switch>

          {sliderConfig && (
            <>

              <div className="grid grid-cols-3 gap-3">
                <FieldRow label="Minimo">
                  <input
                    className="kovia-input"
                    type="number"
                    value={String(sliderConfig.min)}
                    onChange={(e) => updateSlider({ min: toFiniteNumber(e.target.value, sliderConfig.min) })}
                  />
                </FieldRow>
                <FieldRow label="Maximo">
                  <input
                    className="kovia-input"
                    type="number"
                    value={String(sliderConfig.max)}
                    onChange={(e) => updateSlider({ max: toFiniteNumber(e.target.value, sliderConfig.max) })}
                  />
                </FieldRow>
                <FieldRow label="Step">
                  <input
                    className="kovia-input"
                    type="number"
                    min={0.01}
                    step="any"
                    value={String(sliderConfig.step)}
                    onChange={(e) => updateSlider({ step: toFiniteNumber(e.target.value, sliderConfig.step) })}
                  />
                </FieldRow>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldRow label="Prefijo">
                  <input
                    className="kovia-input"
                    value={sliderConfig.prefix || ''}
                    onChange={(e) => updateSlider({ prefix: e.target.value })}
                    placeholder="$"
                  />
                </FieldRow>
                <FieldRow label="Sufijo unidad">
                  <input
                    className="kovia-input"
                    value={sliderConfig.unitSuffix || ''}
                    onChange={(e) => updateSlider({ unitSuffix: e.target.value })}
                    placeholder=" USD"
                  />
                </FieldRow>
              </div>

              <FieldRow label="Texto de confirmacion">
                <input
                  className="kovia-input"
                  value={sliderConfig.confirmLabel || ''}
                  onChange={(e) => updateSlider({ confirmLabel: e.target.value })}
                  placeholder="Confirmar valor"
                />
              </FieldRow>

              <Switch
                isSelected={Boolean(sliderConfig.showPlusAtMax)}
                onChange={(value) => updateSlider({ showPlusAtMax: resolveSwitchValue(value) })}
              >
                <Switch.Control><Switch.Thumb /></Switch.Control>
                <Switch.Content className="text-sm">Mostrar + cuando llegue al maximo</Switch.Content>
              </Switch>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-default-500 uppercase tracking-wide">Marcas</p>
                  <Button size="sm" variant="flat" onPress={addSliderMark}>+ Marca</Button>
                </div>

                {!Array.isArray(sliderConfig.marks) || sliderConfig.marks.length === 0 ? (
                  <p className="text-xs text-default-400">Sin marcas configuradas.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sliderConfig.marks.map((mark, markIndex) => (
                      <div key={`${question.id}-mark-${markIndex}`} className="grid grid-cols-[96px_minmax(0,1fr)_auto] gap-2 items-center">
                        <input
                          className="kovia-input"
                          type="number"
                          value={String(mark.value)}
                          onChange={(e) => updateSliderMark(markIndex, { value: toFiniteNumber(e.target.value, mark.value) })}
                        />
                        <input
                          className="kovia-input"
                          value={mark.label || ''}
                          onChange={(e) => updateSliderMark(markIndex, { label: e.target.value })}
                          placeholder="Etiqueta"
                        />
                        <Button size="sm" variant="ghost" color="danger" onPress={() => removeSliderMark(markIndex)}>
                          Quitar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* JSON avanzado colapsable */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-semibold text-default-400 uppercase tracking-wide hover:text-default-600 select-none flex items-center gap-1 py-1">
          <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
          JSON avanzado
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            className="kovia-textarea font-mono text-xs"
            rows={8}
            value={questionJsonDraft}
            onChange={(e) => setQuestionJsonDraft(e.target.value)}
          />
          <Button size="sm" variant="secondary" onPress={applyQuestionJsonDraft}>
            Aplicar JSON
          </Button>
          <p className="text-xs text-default-400">
            Para reglas avanzadas: <code>validation.z</code>, <code>visible_when</code>, <code>mask</code>, <code>mask_preset</code>.
          </p>
        </div>
      </details>
    </div>
  );
}

// ─── Advanced settings modal ──────────────────────────────────────────────────

function AdvancedSettingsModal({ isOpen, onClose, config, onUpdateCompletionAction, onUpdateSubmissionPolicy }) {
  const completionAction = config.completion_action || DEFAULT_CONFIG.completion_action;
  const submissionPolicy = config.submission_policy || DEFAULT_CONFIG.submission_policy;
  const redirectParams = normalizeRedirectParams(completionAction.redirect_params || completionAction.query_params);

  const availableQuestionFields = useMemo(() => {
    const steps = Array.isArray(config?.steps) ? config.steps : [];

    return steps.flatMap((step, stepIndex) => {
      const stepTitle = String(step?.title || `Paso ${stepIndex + 1}`).trim() || `Paso ${stepIndex + 1}`;
      const questions = Array.isArray(step?.questions) ? step.questions : [];

      return questions
        .map((question) => {
          const fieldId = String(question?.id || '').trim();
          if (!fieldId) return null;

          const fieldLabel = String(question?.label || fieldId).trim() || fieldId;
          return {
            id: fieldId,
            label: `${stepTitle}: ${fieldLabel} (${fieldId})`,
          };
        })
        .filter(Boolean);
    });
  }, [config?.steps]);

  function updateRedirectParams(nextParams) {
    onUpdateCompletionAction({ redirect_params: normalizeRedirectParams(nextParams) });
  }

  function addRedirectParam() {
    const fallbackFieldId = FORM_SUBMISSION_ID_SOURCE_FIELD;
    updateRedirectParams([...redirectParams, { key: '', source_field: fallbackFieldId }]);
  }

  function patchRedirectParam(index, patch) {
    updateRedirectParams(
      redirectParams.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
    );
  }

  function removeRedirectParam(index) {
    updateRedirectParams(redirectParams.filter((_, entryIndex) => entryIndex !== index));
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <Modal.Container placement="center" size="xl">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Configuración avanzada</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-5">

              <div className="flex flex-col gap-3">
                <SectionDivider label="Política de envío" />
                <Switch isSelected={Boolean(submissionPolicy.enabled)} onChange={(v) => onUpdateSubmissionPolicy({ enabled: v })}>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                  <Switch.Content className="text-sm">Habilitar bloqueo por identificador</Switch.Content>
                </Switch>
                <Switch isSelected={Boolean(submissionPolicy.once_per_identifier)} onChange={(v) => onUpdateSubmissionPolicy({ once_per_identifier: v })}>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                  <Switch.Content className="text-sm">Un solo envío por identificador</Switch.Content>
                </Switch>
                <Switch isSelected={Boolean(submissionPolicy.allow_reactivation)} onChange={(v) => onUpdateSubmissionPolicy({ allow_reactivation: v })}>
                  <Switch.Control><Switch.Thumb /></Switch.Control>
                  <Switch.Content className="text-sm">Permitir reactivación desde admin</Switch.Content>
                </Switch>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Estrategia de identificador">
                    <select
                      className="kovia-select"
                      value={String(submissionPolicy.identifier_strategy || 'ip_then_header')}
                      onChange={(e) => onUpdateSubmissionPolicy({ identifier_strategy: e.target.value })}
                    >
                      {IDENTIFIER_STRATEGIES.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </FieldRow>
                  <FieldRow label="Header de identificador">
                    <input
                      className="kovia-input"
                      value={String(submissionPolicy.identifier_header || '')}
                      onChange={(e) => onUpdateSubmissionPolicy({ identifier_header: e.target.value })}
                      placeholder="x-form-identifier"
                    />
                  </FieldRow>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <SectionDivider label="Al completar el formulario" />
                <FieldRow label="Tipo de acción">
                  <select
                    className="kovia-select"
                    value={String(completionAction.type || 'redirect')}
                    onChange={(e) => onUpdateCompletionAction({ type: e.target.value })}
                  >
                    <option value="redirect">Redirigir a URL</option>
                    <option value="embed">Mostrar embed</option>
                  </select>
                </FieldRow>

                {String(completionAction.type || 'redirect') === 'embed' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Título">
                      <input className="kovia-input" value={String(completionAction.title || '')} onChange={(e) => onUpdateCompletionAction({ title: e.target.value })} placeholder="Agenda tu reunión" />
                    </FieldRow>
                    <FieldRow label="Altura del embed (px)">
                      <input className="kovia-input" type="number" min={360} value={String(completionAction.embed_height || 720)} onChange={(e) => onUpdateCompletionAction({ embed_height: Number(e.target.value) || 720 })} />
                    </FieldRow>
                    <div className="col-span-2">
                      <FieldRow label="URL del embed">
                        <input className="kovia-input" value={String(completionAction.embed_url || completionAction.url || '')} onChange={(e) => onUpdateCompletionAction({ embed_url: e.target.value })} placeholder="https://cal.com/..." />
                      </FieldRow>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="URL de redirección">
                      <input className="kovia-input" value={String(completionAction.url || '')} onChange={(e) => onUpdateCompletionAction({ url: e.target.value })} placeholder="https://kovia.com/gracias" />
                    </FieldRow>
                    <FieldRow label="Texto del botón">
                      <input className="kovia-input" value={String(completionAction.button_label || 'Continuar')} onChange={(e) => onUpdateCompletionAction({ button_label: e.target.value })} placeholder="Continuar" />
                    </FieldRow>
                    <Switch isSelected={Boolean(completionAction.open_in_new_tab ?? true)} onChange={(v) => onUpdateCompletionAction({ open_in_new_tab: v })}>
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                      <Switch.Content className="text-sm">Abrir en nueva pestaña</Switch.Content>
                    </Switch>

                    <div className="col-span-2 rounded-lg border border-default-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-default-500">Parámetros dinámicos en URL</p>
                          <p className="text-xs text-default-400">Usa respuestas del formulario para enviar query params en la redirección.</p>
                        </div>
                        <Button size="sm" variant="secondary" onPress={addRedirectParam}>
                          Agregar parámetro
                        </Button>
                      </div>

                      {redirectParams.length === 0 ? (
                        <p className="mt-3 text-xs text-default-400">Sin parámetros dinámicos. Se usará la URL fija tal como está.</p>
                      ) : (
                        <div className="mt-3 flex flex-col gap-2">
                          {redirectParams.map((param, index) => (
                            <div key={`redirect-param-${index}`} className="grid grid-cols-12 gap-2 rounded border border-default-200 p-2">
                              <div className="col-span-4">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-default-500">Query param</label>
                                <input
                                  className="kovia-input mt-1"
                                  value={String(param.key || '')}
                                  onChange={(e) => patchRedirectParam(index, { key: e.target.value })}
                                  placeholder="utm_source"
                                />
                              </div>

                              <div className="col-span-6">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-default-500">Campo de respuesta</label>
                                {(() => {
                                  const currentSourceField = String(param.source_field || '');
                                  const hasKnownQuestionField = availableQuestionFields.some((field) => field.id === currentSourceField);
                                  const isKnownSystemField = currentSourceField === FORM_SUBMISSION_ID_SOURCE_FIELD;
                                  const hasLegacyCustomField = currentSourceField && !hasKnownQuestionField && !isKnownSystemField;

                                  return (
                                    <>
                                <select
                                  className="kovia-select mt-1"
                                  value={String(param.source_field || '')}
                                  onChange={(e) => patchRedirectParam(index, { source_field: e.target.value })}
                                >
                                  <option value="">Selecciona campo</option>
                                  <optgroup label="Sistema">
                                    <option value={FORM_SUBMISSION_ID_SOURCE_FIELD}>{FORM_SUBMISSION_ID_SOURCE_LABEL}</option>
                                  </optgroup>
                                  {hasLegacyCustomField ? (
                                    <optgroup label="Personalizado (legacy)">
                                      <option value={currentSourceField}>{currentSourceField}</option>
                                    </optgroup>
                                  ) : null}
                                  {availableQuestionFields.length > 0 ? (
                                    <optgroup label="Respuestas del formulario">
                                      {availableQuestionFields.map((field) => (
                                        <option key={field.id} value={field.id}>{field.label}</option>
                                      ))}
                                    </optgroup>
                                  ) : null}
                                </select>
                                {hasLegacyCustomField ? (
                                  <p className="mt-1 text-[11px] text-default-400">Valor legado detectado: {currentSourceField}</p>
                                ) : null}
                                    </>
                                  );
                                })()}
                              </div>

                              <div className="col-span-2 flex items-end justify-end">
                                <Button size="sm" variant="ghost" color="danger" onPress={() => removeRedirectParam(index)}>
                                  Quitar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <FieldRow label="Descripción final (opcional)">
                  <input className="kovia-input" value={String(completionAction.description || '')} onChange={(e) => onUpdateCompletionAction({ description: e.target.value })} placeholder="Texto de apoyo al finalizar" />
                </FieldRow>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">Cerrar</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

const INTRO_SCREEN_HEADER_FIELDS = [
  { key: 'brand_text', label: 'Marca / logo texto', placeholder: 'Kovia' },
  { key: 'subtitle_text', label: 'Subtitulo', placeholder: 'Pre-Onboarding' },
];

const INTRO_SCREEN_SUPPORT_FIELDS = [
  { key: 'support_prefix_text', label: 'Inicio del texto secundario' },
  { key: 'support_highlight_primary_text', label: 'Texto destacado 1' },
  { key: 'support_middle_text', label: 'Texto intermedio' },
  { key: 'support_highlight_secondary_text', label: 'Texto destacado 2' },
];

const INTRO_SCREEN_CTA_FIELDS = [
  { key: 'estimated_time_text', label: 'Tiempo estimado', placeholder: '≈ 8 minutos' },
  { key: 'start_button_text', label: 'Boton iniciar', placeholder: 'Comenzar' },
  { key: 'loading_button_text', label: 'Boton cargando', placeholder: 'Cargando...' },
];

function resolveIntroScreenPreviewValue(source, key) {
  const candidate = String(source?.[key] || '').trim();
  return candidate || DEFAULT_INTRO_SCREEN_CONFIG[key];
}

function IntroScreenField({ field, value, onChange }) {
  return (
    <FieldRow label={field.label}>
      <input
        className="kovia-input"
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
        placeholder={field.placeholder || ''}
      />
    </FieldRow>
  );
}

function IntroScreenShadowPreview({ source }) {
  const previewBrandText = resolveIntroScreenPreviewValue(source, 'brand_text');
  const previewSubtitleText = resolveIntroScreenPreviewValue(source, 'subtitle_text');
  const previewLeadText = resolveIntroScreenPreviewValue(source, 'lead_text');
  const previewSupportPrefixText = resolveIntroScreenPreviewValue(source, 'support_prefix_text');
  const previewSupportHighlightPrimaryText = resolveIntroScreenPreviewValue(source, 'support_highlight_primary_text');
  const previewSupportMiddleText = resolveIntroScreenPreviewValue(source, 'support_middle_text');
  const previewSupportHighlightSecondaryText = resolveIntroScreenPreviewValue(source, 'support_highlight_secondary_text');
  const previewSupportSuffixText = resolveIntroScreenPreviewValue(source, 'support_suffix_text');
  const previewEstimatedTimeText = resolveIntroScreenPreviewValue(source, 'estimated_time_text');
  const previewStartButtonText = resolveIntroScreenPreviewValue(source, 'start_button_text');

  return (
    <div className="rounded-xl border border-default-200 bg-default-50 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-default-500">Shadow preview</p>
        <span className="text-[11px] text-default-400">Vista previa en vivo</span>
      </div>

      <div className="rounded-2xl border border-default-200 bg-white p-4 shadow-xl">
        <div className="mb-4 border-b border-default-200 pb-3">
          <h3 className="text-base font-black tracking-wide text-default-900">{previewBrandText}</h3>
          <p className="mt-1 text-sm font-semibold text-default-500">{previewSubtitleText}</p>
        </div>

        <div className="space-y-3 text-sm text-default-700">
          <p>{previewLeadText}</p>
          <p>
            {previewSupportPrefixText}{' '}
            <strong>{previewSupportHighlightPrimaryText}</strong>{' '}
            {previewSupportMiddleText}{' '}
            <strong>{previewSupportHighlightSecondaryText}</strong>{' '}
            {previewSupportSuffixText}
          </p>

          <div className="inline-flex items-center gap-2 rounded-full bg-default-100 px-3 py-1 text-xs font-medium text-default-600">
            <span aria-hidden="true">🕒</span>
            <span>{previewEstimatedTimeText}</span>
          </div>

          <div className="pt-1">
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md">
              {previewStartButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntroScreenModal({ isOpen, onClose, introScreen, onUpdateIntroScreen }) {
  const source = introScreen && typeof introScreen === 'object'
    ? introScreen
    : DEFAULT_INTRO_SCREEN_CONFIG;

  function updateField(field, value) {
    onUpdateIntroScreen({ [field]: value });
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <Modal.Container placement="center" size="4xl">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Pantalla de inicio</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="flex flex-col gap-4">
                <p className="text-sm text-default-500">
                  Personaliza los textos del header e introduccion que ve el usuario antes de empezar el formulario.
                </p>

                <SectionDivider label="Header" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {INTRO_SCREEN_HEADER_FIELDS.map((field) => (
                    <IntroScreenField
                      key={field.key}
                      field={field}
                      value={String(source[field.key] || '')}
                      onChange={updateField}
                    />
                  ))}
                </div>

                <SectionDivider label="Introduccion" />
                <FieldRow label="Texto principal">
                  <textarea
                    className="kovia-textarea"
                    rows={2}
                    value={String(source.lead_text || '')}
                    onChange={(event) => updateField('lead_text', event.target.value)}
                  />
                </FieldRow>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {INTRO_SCREEN_SUPPORT_FIELDS.map((field) => (
                    <IntroScreenField
                      key={field.key}
                      field={field}
                      value={String(source[field.key] || '')}
                      onChange={updateField}
                    />
                  ))}
                </div>

                <FieldRow label="Cierre del texto secundario">
                  <input
                    className="kovia-input"
                    value={String(source.support_suffix_text || '')}
                    onChange={(event) => updateField('support_suffix_text', event.target.value)}
                  />
                </FieldRow>

                <SectionDivider label="CTA" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {INTRO_SCREEN_CTA_FIELDS.map((field) => (
                    <IntroScreenField
                      key={field.key}
                      field={field}
                      value={String(source[field.key] || '')}
                      onChange={updateField}
                    />
                  ))}
                </div>
              </div>

              <IntroScreenShadowPreview source={source} />
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">Cerrar</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// ─── JSON modal ───────────────────────────────────────────────────────────────

function JsonModal({ isOpen, onClose, jsonDraft, onChangeJson, onApply, onExport, onImportFile, onDuplicate }) {
  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <Modal.Container placement="center" size="cover">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{'</>'} Editor JSON global</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <textarea
                className="kovia-textarea font-mono text-xs"
                onChange={(e) => onChangeJson(e.target.value)}
                rows={20}
                value={jsonDraft}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onPress={onApply}>Aplicar JSON</Button>
                <Button size="sm" variant="ghost" onPress={onExport}>↓ Exportar</Button>
                <Button size="sm" variant="ghost" onPress={onDuplicate}>Duplicar como nuevo</Button>
                <label className="kovia-file-upload text-xs">
                  ↑ Importar archivo
                  <input accept="application/json,.json" onChange={onImportFile} type="file" />
                </label>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">Cerrar</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function EmbedCodeModal({ isOpen, onClose, formSlug, formTitle, suggestedHeight }) {
  const publicFormUrl = useMemo(() => buildPublicFormUrl(formSlug), [formSlug]);

  const [embedHeight, setEmbedHeight] = useState(920);
  const [embedMaxWidth, setEmbedMaxWidth] = useState(980);
  const [embedTitle, setEmbedTitle] = useState('Formulario Lead Qualificator de Kovia');
  const [allowCameraAndMicrophone, setAllowCameraAndMicrophone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const safeHeight = normalizeEmbedDimension(suggestedHeight, { min: 520, max: 2200, fallback: 920 });
    const normalizedFormTitle = String(formTitle || 'Lead Qualificator').trim().replace(/\s+/g, ' ');

    setEmbedHeight(safeHeight);
    setEmbedMaxWidth(980);
    setEmbedTitle(`Formulario ${normalizedFormTitle}`);
    setAllowCameraAndMicrophone(false);
  }, [formTitle, isOpen, suggestedHeight]);

  const embedCode = useMemo(() => {
    return buildIframeEmbedCode({
      formUrl: publicFormUrl,
      frameTitle: embedTitle,
      height: embedHeight,
      maxWidth: embedMaxWidth,
      allowCameraAndMicrophone,
    });
  }, [allowCameraAndMicrophone, embedHeight, embedMaxWidth, embedTitle, publicFormUrl]);

  const hasPublicBaseConfigured = Boolean(FORM_URL_BASE);

  async function copyPublicUrl() {
    if (!publicFormUrl) {
      notifyError('No se pudo resolver la URL pública del formulario. Verifica FORM_URL_BASE.');
      return;
    }

    try {
      await navigator.clipboard.writeText(publicFormUrl);
      notifySuccess('URL pública copiada al portapapeles.');
    } catch {
      notifyError('No se pudo copiar la URL pública del formulario.');
    }
  }

  async function copyEmbedCode() {
    if (!embedCode) {
      notifyError('No se pudo generar el código embed. Revisa la URL pública del formulario.');
      return;
    }

    try {
      await navigator.clipboard.writeText(embedCode);
      notifySuccess('Código embed copiado al portapapeles.');
    } catch {
      notifyError('No se pudo copiar el código embed.');
    }
  }

  function openPublicForm() {
    if (!publicFormUrl) {
      notifyError('No se pudo abrir el formulario público. Verifica FORM_URL_BASE.');
      return;
    }

    window.open(publicFormUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
        <Modal.Container placement="center" size="2xl">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Embed seguro del formulario</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-4">
              <p className="text-sm text-default-500">
                Inserta este código en tu web para embeber el formulario con el mismo diseño del Lead Qualificator.
                Se genera con configuración segura por defecto (sandbox, referrer policy y lazy loading).
              </p>

              {!hasPublicBaseConfigured ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-700">
                  FORM_URL_BASE no está configurado en el admin. Define FORM_URL_BASE o VITE_FORM_URL_BASE para generar el embed.
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldRow label="URL pública del formulario">
                  <input className="kovia-input font-mono text-xs" readOnly value={publicFormUrl} />
                </FieldRow>

                <FieldRow label="Slug del formulario">
                  <input className="kovia-input font-mono text-xs" readOnly value={String(formSlug || '')} />
                </FieldRow>

                <FieldRow label="Título accesible del iframe">
                  <input
                    className="kovia-input"
                    value={embedTitle}
                    onChange={(event) => setEmbedTitle(event.target.value)}
                    placeholder="Formulario Lead Qualificator de Kovia"
                  />
                </FieldRow>

                <FieldRow label="Altura del iframe (px)">
                  <input
                    className="kovia-input"
                    min={520}
                    max={2200}
                    step={10}
                    type="number"
                    value={String(embedHeight)}
                    onChange={(event) => {
                      setEmbedHeight(normalizeEmbedDimension(event.target.value, { min: 520, max: 2200, fallback: embedHeight }));
                    }}
                  />
                </FieldRow>

                <FieldRow label="Ancho máximo del contenedor (px)">
                  <input
                    className="kovia-input"
                    min={360}
                    max={1800}
                    step={10}
                    type="number"
                    value={String(embedMaxWidth)}
                    onChange={(event) => {
                      setEmbedMaxWidth(normalizeEmbedDimension(event.target.value, { min: 360, max: 1800, fallback: embedMaxWidth }));
                    }}
                  />
                </FieldRow>
              </div>

              <Switch
                isSelected={allowCameraAndMicrophone}
                onChange={(valueOrEvent) => setAllowCameraAndMicrophone(resolveSwitchValue(valueOrEvent))}
              >
                <Switch.Control><Switch.Thumb /></Switch.Control>
                <Switch.Content className="text-sm">Permitir cámara y micrófono (solo si tu agenda final lo necesita)</Switch.Content>
              </Switch>

              <FieldRow label="Código iframe listo para insertar">
                <textarea
                  className="kovia-textarea kovia-textarea-lg font-mono text-xs"
                  readOnly
                  rows={14}
                  value={embedCode || '<!-- Configura FORM_URL_BASE para generar el embed -->'}
                />
              </FieldRow>

              <div className="rounded-lg border border-default-200 bg-default-50 p-3 text-xs text-default-500">
                <p className="font-semibold uppercase tracking-wide text-default-700">Hardening aplicado</p>
                <p className="mt-1">sandbox restringido, referrerpolicy estricta y carga diferida para minimizar riesgos y mejorar rendimiento.</p>
              </div>
            </Modal.Body>

            <Modal.Footer className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" isDisabled={!publicFormUrl} onPress={copyPublicUrl}>Copiar URL pública</Button>

              <div className="flex items-center gap-2">
                <Button variant="secondary" isDisabled={!publicFormUrl} onPress={openPublicForm}>Abrir vista pública</Button>
                <Button color="primary" isDisabled={!embedCode} onPress={copyEmbedCode}>Copiar código embed</Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminFormBuilderPage() {
  const { templateId, formId } = useParams();
  const navigate = useNavigate();

  const [isLoading,    setIsLoading]    = useState(true);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isArchiving,  setIsArchiving]  = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);

  const [formMeta, setFormMeta] = useState(null);
  const [config,   setConfig]   = useState(DEFAULT_CONFIG);
  const [jsonDraft,setJsonDraft]= useState('');

  const [selectedStepKey,       setSelectedStepKey]       = useState(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showIntroScreen, setShowIntroScreen] = useState(false);
  const [showJson,     setShowJson]     = useState(false);
  const [showEmbed,    setShowEmbed]    = useState(false);
  const [isDirty,            setIsDirty]            = useState(false);
  const [showUnsavedDialog,  setShowUnsavedDialog]  = useState(false);
  const [showArchiveDialog,  setShowArchiveDialog]  = useState(false);
  const [showDeleteDialog,   setShowDeleteDialog]   = useState(false);

  // ── Unsaved-changes guard ────────────────────────────────────────────────────

  useEffect(() => {
    function onBeforeUnload(e) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function handleGoBack() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      navigate(`/forms/${templateId}`);
    }
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const form       = await getFormById(formId);
        if (cancelled) return;
        const normalized = normalizeConfigForEditor(form.config || DEFAULT_CONFIG);
        setFormMeta(form);
        setConfig(normalized);
        setJsonDraft(safeStringify(normalized));
        setIsDirty(false);
        if (normalized.steps.length > 0) setSelectedStepKey(String(normalized.steps[0].order));
      } catch (err) {
        if (!cancelled) notifyError(err?.message || 'No se pudieron cargar los datos del formulario.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [formId]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const steps = useMemo(() => (Array.isArray(config?.steps) ? config.steps : []), [config]);

  const selectedStepIndex = useMemo(
    () => steps.findIndex((s) => String(s.order) === selectedStepKey),
    [steps, selectedStepKey],
  );

  const selectedStep     = selectedStepIndex >= 0 ? steps[selectedStepIndex] : null;
  const selectedQuestion = (selectedQuestionIndex !== null && selectedStep?.questions?.[selectedQuestionIndex]) || null;

  // ── Mutations ────────────────────────────────────────────────────────────────

  function syncJson(nextConfig) {
    setConfig(nextConfig);
    setJsonDraft(safeStringify(nextConfig));
    setIsDirty(true);
  }

  function updateCompletionAction(patch) {
    syncJson({ ...config, completion_action: { ...(config.completion_action || {}), ...patch } });
  }

  function updateSubmissionPolicy(patch) {
    syncJson({ ...config, submission_policy: { ...(config.submission_policy || {}), ...patch } });
  }

  function updateIntroScreen(patch) {
    syncJson({
      ...config,
      intro_screen: normalizeIntroScreenConfig({ ...(config.intro_screen || {}), ...patch }),
    });
  }

  function updateStep(patch) {
    if (!selectedStep) return;
    syncJson({ ...config, steps: steps.map((s, i) => i === selectedStepIndex ? { ...s, ...patch } : s) });
  }

  function addStep() {
    const nextOrder = steps.length + 1;
    syncJson({ ...config, steps: [...steps, { order: nextOrder, title: `Paso ${nextOrder}`, short_label: `P${nextOrder}`, questions: [] }] });
    setSelectedStepKey(String(nextOrder));
    setSelectedQuestionIndex(null);
  }

  function removeStep() {
    if (!selectedStep) return;
    const nextSteps = steps
      .filter((_, i) => i !== selectedStepIndex)
      .map((s, i) => ({ ...s, order: i + 1 }));
    syncJson({ ...config, steps: nextSteps });
    setSelectedStepKey(nextSteps.length > 0 ? String(nextSteps[Math.max(0, selectedStepIndex - 1)].order) : null);
    setSelectedQuestionIndex(null);
  }

  function addQuestion() {
    if (!selectedStep) return;
    const questions = Array.isArray(selectedStep.questions) ? selectedStep.questions : [];
    const newQ      = normalizeQuestion({ id: createQuestionId(), type: 'text', label: `Pregunta ${questions.length + 1}`, required: false }, questions.length);
    const nextSteps = steps.map((s, i) => i === selectedStepIndex ? { ...s, questions: [...questions, newQ] } : s);
    syncJson({ ...config, steps: nextSteps });
    setSelectedQuestionIndex(questions.length);
  }

  function removeQuestion() {
    if (!selectedStep || selectedQuestionIndex === null) return;
    const nextSteps = steps.map((s, i) => {
      if (i !== selectedStepIndex) return s;
      return { ...s, questions: (s.questions || []).filter((_, qi) => qi !== selectedQuestionIndex) };
    });
    syncJson({ ...config, steps: nextSteps });
    setSelectedQuestionIndex(null);
  }

  function updateQuestion(patch) {
    if (!selectedStep || selectedQuestionIndex === null) return;
    const nextSteps = steps.map((s, si) => {
      if (si !== selectedStepIndex) return s;
      const questions = (s.questions || []).map((q, qi) => {
        if (qi !== selectedQuestionIndex) return q;
        const next = normalizeQuestion({ ...q, ...patch }, qi);
        if (!shouldUseOptions(next.type)) delete next.options;
        return next;
      });
      return { ...s, questions };
    });
    syncJson({ ...config, steps: nextSteps });
  }

  // ── JSON actions ─────────────────────────────────────────────────────────────

  function applyJsonDraft() {
    try {
      const parsed     = JSON.parse(jsonDraft);
      const validated  = formConfigSchema.parse(parsed);
      const normalized = normalizeConfigForEditor(validated);
      setConfig(normalized);
      setJsonDraft(safeStringify(normalized));
      setIsDirty(true);
      notifySuccess('JSON aplicado correctamente.');
    } catch (err) {
      notifyError(err?.message || 'JSON inválido.');
    }
  }

  function handleJsonFileImport(event) {
    const [file] = Array.from(event.target.files || []);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw     = String(reader.result || '{}');
        const parsed  = JSON.parse(raw);
        const payload = parsed?.config && typeof parsed.config === 'object' ? parsed.config : parsed;
        const norm    = normalizeConfigForEditor(formConfigSchema.parse(payload));
        setConfig(norm);
        setJsonDraft(safeStringify(norm));
        setIsDirty(true);
        notifySuccess('Archivo JSON importado correctamente.');
      } catch (err) { notifyError(err?.message || 'Archivo JSON inválido.'); }
    };
    reader.onerror = () => notifyError('No se pudo leer el archivo.');
    reader.readAsText(file, 'utf-8');
    event.target.value = '';
  }

  async function validateBuilderRules() {
    setIsValidating(true);
    try {
      const local  = formConfigSchema.parse(config);
      const server = await validateFormConfig(local);
      const norm   = normalizeConfigForEditor(server.normalizedConfig);
      syncJson(norm);
      notifySuccess(`Validado: ${server.summary.steps} pasos, ${server.summary.questions} preguntas.`);
    } catch (err) { notifyError(err?.message || 'Error al validar.'); }
    finally { setIsValidating(false); }
  }

  async function saveBuilder() {
    setIsSaving(true);
    try {
      const local  = formConfigSchema.parse(config);
      const server = await validateFormConfig(local);
      const saved  = await updateForm(formId, { config: server.normalizedConfig });
      const norm   = normalizeConfigForEditor(saved.config);
      setConfig(norm);
      setJsonDraft(safeStringify(norm));
      setIsDirty(false);
      notifySuccess('Formulario guardado correctamente.');
    } catch (err) { notifyError(err?.message || 'Error al guardar.'); }
    finally { setIsSaving(false); }
  }

  async function exportJson() {
    try {
      const payload = await exportForm(formId);
      buildDownloadFile(`${payload.form.slug}-export.json`, safeStringify(payload));
      notifySuccess('Exportación descargada.');
    } catch (err) { notifyError(err?.message || 'Error al exportar.'); }
  }

  async function importCurrentJsonAsNewForm() {
    try {
      const parsedConfig = formConfigSchema.parse(JSON.parse(jsonDraft));
      const norm         = normalizeConfigForEditor(parsedConfig);
      const imported     = await importForm({ title: `${formMeta?.title || 'Formulario'} copia`, template_id: templateId, config: norm });
      notifySuccess(`Formulario importado: ${imported.title}`);
    } catch (err) { notifyError(err?.message || 'Error al importar.'); }
  }

  function handleArchiveResponses() {
    setShowArchiveDialog(true);
  }

  async function confirmArchiveResponses() {
    setShowArchiveDialog(false);
    setIsArchiving(true);
    try {
      const result = await archiveFormSubmissions(formId);
      const archivedCount = Number(result?.archivedCount || 0);
      notifySuccess(`Se archivaron ${archivedCount} respuesta${archivedCount === 1 ? '' : 's'}.`);
    } catch (err) {
      notifyError(err, 'No se pudieron archivar las respuestas.');
    } finally {
      setIsArchiving(false);
    }
  }

  function handleDeleteForm() {
    setShowDeleteDialog(true);
  }

  async function confirmDeleteForm() {
    setShowDeleteDialog(false);
    setIsDeleting(true);
    try {
      await deleteForm(formId);
      notifySuccess('Formulario desactivado correctamente.');
      setIsDirty(false);
      navigate(`/forms/${templateId}`);
    } catch (err) {
      notifyError(err, 'No se pudo desactivar el formulario.');
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-default-500">
        <Spinner size="sm" /><span>Cargando constructor…</span>
      </div>
    );
  }

  const totalQuestions = steps.reduce((acc, s) => acc + (s.questions?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">

      {/* Breadcrumbs */}
      <Breadcrumbs>
        <Breadcrumbs.Item href="/forms">Plantillas</Breadcrumbs.Item>
        <Breadcrumbs.Item href={`/forms/${templateId}`}>{formMeta?.template?.name || 'Formularios'}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{formMeta?.title || 'Constructor'}</Breadcrumbs.Item>
      </Breadcrumbs>

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{formMeta?.title || 'Constructor de formularios'}</h1>
          <p className="text-sm text-default-500 mt-0.5">
            {steps.length} {steps.length === 1 ? 'paso' : 'pasos'} · {totalQuestions} {totalQuestions === 1 ? 'campo' : 'campos'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="ghost" onPress={handleGoBack}>← Volver</Button>

          {/* Vista: JSON editor + Embed */}
          <Dropdown>
            <Button size="sm" variant="secondary">Vista ▾</Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === 'json')  setShowJson(true);
                  if (key === 'embed') setShowEmbed(true);
                }}
              >
                <Dropdown.Item id="json" textValue="Editor JSON">
                  <Label>{'</>'} Editor JSON</Label>
                </Dropdown.Item>
                <Dropdown.Item id="embed" textValue="Código embed">
                  <Label>🔗 Código embed</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* Configurar: Pantalla inicio + Ajustes avanzados */}
          <Dropdown>
            <Button size="sm" variant="secondary">Configurar ▾</Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === 'intro')    setShowIntroScreen(true);
                  if (key === 'settings') setShowSettings(true);
                }}
              >
                <Dropdown.Item id="intro" textValue="Pantalla de inicio">
                  <Label>🪄 Pantalla de inicio</Label>
                </Dropdown.Item>
                <Dropdown.Item id="settings" textValue="Ajustes avanzados">
                  <Label>⚙️ Ajustes avanzados</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* Acciones destructivas */}
          <Dropdown>
            <Button
              size="sm"
              color="danger"
              variant="ghost"
              isDisabled={isArchiving || isDeleting}
            >
              {isArchiving ? 'Archivando…' : isDeleting ? 'Eliminando…' : '⚠ Acciones ▾'}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === 'archive') handleArchiveResponses();
                  if (key === 'delete')  handleDeleteForm();
                }}
              >
                <Dropdown.Item id="archive" textValue="Archivar respuestas">
                  <Label>Archivar respuestas</Label>
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item id="delete" textValue="Eliminar formulario" variant="danger">
                  <Label>Eliminar formulario</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          <Button size="sm" variant="secondary" isDisabled={isValidating} onPress={validateBuilderRules}>
            {isValidating ? 'Validando…' : '✓ Validar'}
          </Button>
          <Button size="sm" color="primary" isDisabled={isSaving} onPress={saveBuilder}>
            {isSaving ? 'Guardando…' : '💾 Guardar'}
          </Button>
        </div>
      </div>

      {/* Main card con tabs */}
      <Card variant="default" className="overflow-hidden min-w-0 w-full">
        <Card.Content className="p-0 min-w-0">
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-default-400">
              <span className="text-5xl">📋</span>
              <p className="font-medium text-default-600">Sin pasos todavía</p>
              <p className="text-sm">Crea el primer paso para comenzar</p>
              <Button color="primary" className="mt-2" onPress={addStep}>Crear primer paso</Button>
            </div>
          ) : (
            <Tabs
              selectedKey={selectedStepKey}
              onSelectionChange={(key) => {
                setSelectedStepKey(String(key));
                setSelectedQuestionIndex(null);
              }}
            >
              {/* Tab bar: acciones fijas a la derecha, tabs con scroll horizontal */}
              <div className="flex min-w-0 flex-col border-b border-default-200 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:pl-3">
                <div className="min-w-0 px-3 py-2 sm:px-0">
                  <ScrollShadow orientation="horizontal" className="min-w-0 overflow-x-scroll pb-1">
                    <Tabs.ListContainer>
                      <Tabs.List aria-label="Pasos del formulario" className="w-max *:h-7 *:px-1.5 *:text-xs *:font-medium *:shrink-0">
                      {steps.map((step) => (
                        <Tabs.Tab key={String(step.order)} id={String(step.order)} className="shrink-0">
                          <span className="flex items-center gap-1 text-xs whitespace-nowrap leading-none">
                            <span className={[
                              'w-3.5 h-3.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                              selectedStepKey === String(step.order) ? 'bg-primary text-white' : 'bg-default-200 text-default-600',
                            ].join(' ')}>
                              {step.order}
                            </span>
                            <span className="inline-block max-w-28 truncate align-bottom">{step.title}</span>
                            <span className="text-[10px] text-default-400">({step.questions?.length ?? 0})</span>
                          </span>
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      ))}
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </ScrollShadow>
                </div>

                {/* Acciones contextuales — siempre visibles, no se comprimen */}
                <div className="flex flex-wrap items-center gap-1 px-3 pb-3 sm:shrink-0 sm:py-2 sm:pl-2 sm:pr-3">
                  <Button size="sm" variant="flat" color="primary" onPress={addStep}>+ Paso</Button>
                  {selectedStep && (
                    <>
                      <Button size="sm" variant="flat" color="primary" onPress={addQuestion}>+ Campo</Button>
                      <Button size="sm" variant="ghost" color="danger" onPress={removeStep}>Eliminar paso</Button>
                    </>
                  )}
                </div>
              </div>

              {/* Panels */}
              {steps.map((step, stepIdx) => (
                <Tabs.Panel key={String(step.order)} id={String(step.order)} className="p-0">
                  <div className="grid min-h-130 grid-cols-1 lg:grid-cols-2">

                    {/* Izquierda: título del paso + campos como vista previa clickeable */}
                    <div className="flex flex-col gap-3 p-4 border-r border-default-200 overflow-y-auto">
                      {/* Edición del título del paso */}
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Título del paso"
                          className="flex-1"
                          variant="secondary"
                          value={step.title || ''}
                          onChange={(e) => updateStep({ title: e.target.value })}
                          placeholder="Título del paso"
                        />
                        <Input
                          aria-label="Etiqueta corta del paso"
                          className="w-16 text-center"
                          variant="secondary"
                          maxLength={4}
                          value={step.short_label || ''}
                          onChange={(e) => updateStep({ short_label: e.target.value })}
                          placeholder="P1"
                        />
                      </div>

                      {/* Campos clickeables */}
                      {(step.questions || []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 py-14 gap-3 text-default-400 border-2 border-dashed border-default-200 rounded-xl">
                          <span className="text-3xl">➕</span>
                          <p className="text-sm font-medium">Sin campos en este paso</p>
                          <Button size="sm" variant="flat" color="primary" onPress={addQuestion}>
                            Agregar primer campo
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {(step.questions || []).map((question, qi) => (
                            <PreviewQuestion
                              key={question.id}
                              question={question}
                              isSelected={stepIdx === selectedStepIndex && qi === selectedQuestionIndex}
                              onSelect={() => setSelectedQuestionIndex(qi)}
                            />
                          ))}
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="mt-1 self-start"
                            onPress={addQuestion}
                          >
                            + Agregar campo
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Derecha: editor del campo seleccionado */}
                    <div className="p-4 bg-default-50/40 overflow-y-auto">
                      <FieldEditor
                        question={selectedQuestion}
                        onUpdate={updateQuestion}
                        onRemove={removeQuestion}
                      />
                    </div>
                  </div>
                </Tabs.Panel>
              ))}
            </Tabs>
          )}
        </Card.Content>
      </Card>

      {/* Modals */}
      <AdvancedSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onUpdateCompletionAction={updateCompletionAction}
        onUpdateSubmissionPolicy={updateSubmissionPolicy}
      />

      <IntroScreenModal
        isOpen={showIntroScreen}
        onClose={() => setShowIntroScreen(false)}
        introScreen={config?.intro_screen}
        onUpdateIntroScreen={updateIntroScreen}
      />

      <JsonModal
        isOpen={showJson}
        onClose={() => setShowJson(false)}
        jsonDraft={jsonDraft}
        onChangeJson={setJsonDraft}
        onApply={applyJsonDraft}
        onExport={exportJson}
        onImportFile={handleJsonFileImport}
        onDuplicate={importCurrentJsonAsNewForm}
      />

      <EmbedCodeModal
        isOpen={showEmbed}
        onClose={() => setShowEmbed(false)}
        formSlug={formMeta?.slug}
        formTitle={formMeta?.title}
        suggestedHeight={toFiniteNumber(config?.completion_action?.embed_height, 920)}
      />

      {/* Archivar respuestas */}
      <AlertDialog.Backdrop
        isOpen={showArchiveDialog}
        onOpenChange={(open) => { if (!open) setShowArchiveDialog(false); }}
      >
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>¿Archivar todas las respuestas?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-default-600">
                Las respuestas de este formulario quedarán ocultas en los listados. Esta acción se puede revertir reactivando las respuestas desde el panel de administración.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => setShowArchiveDialog(false)}>
                Cancelar
              </Button>
              <Button color="danger" variant="secondary" isDisabled={isArchiving} onPress={confirmArchiveResponses}>
                {isArchiving ? 'Archivando…' : 'Archivar respuestas'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      {/* Eliminar formulario */}
      <AlertDialog.Backdrop
        isOpen={showDeleteDialog}
        onOpenChange={(open) => { if (!open) setShowDeleteDialog(false); }}
      >
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>¿Desactivar el formulario?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-default-600">
                El formulario dejará de estar disponible para nuevos envíos. Podrás volver a activarlo editándolo desde el panel de administración.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => setShowDeleteDialog(false)}>
                Cancelar
              </Button>
              <Button color="danger" variant="secondary" isDisabled={isDeleting} onPress={confirmDeleteForm}>
                {isDeleting ? 'Desactivando…' : 'Desactivar formulario'}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      {/* Guardia de cambios sin guardar */}
      <AlertDialog.Backdrop
        isOpen={showUnsavedDialog}
        onOpenChange={(open) => { if (!open) setShowUnsavedDialog(false); }}
      >
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>¿Salir sin guardar?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-default-600">
                Tienes cambios sin guardar en el formulario. Si sales ahora perderás todo lo que editaste desde el último guardado.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="tertiary" onPress={() => setShowUnsavedDialog(false)}>
                Quedarme
              </Button>
              <Button color="danger" variant="secondary" onPress={() => { setIsDirty(false); navigate(`/forms/${templateId}`); }}>
                Salir sin guardar
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}