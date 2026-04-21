import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumbs, Button, Card, Input, Modal, ScrollShadow, Spinner, Switch, Tabs } from '@heroui/react';
import { archiveFormSubmissions, deleteForm, exportForm, getFormById, importForm, updateForm, validateFormConfig } from '../lib/admin/forms';
import { formConfigSchema } from '../lib/admin/schemas';
import { notifyError, notifySuccess } from '../lib/ui/notifications';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPTION_BASED_TYPES = new Set(['radio', 'checkbox', 'select']);

const FIELD_TYPE_META = {
  text:        { label: 'Texto',             placeholder: 'Escribe tu respuesta',           icon: '✏️' },
  textarea:    { label: 'Texto largo',        placeholder: 'Escribe tu respuesta detallada', icon: '📝' },
  email:       { label: 'Correo',             placeholder: 'nombre@empresa.com',             icon: '✉️' },
  telefono:    { label: 'Teléfono',           placeholder: '77771234',                       icon: '📞' },
  radio:       { label: 'Selección única',    placeholder: '',                               icon: '⚪' },
  checkbox:    { label: 'Selección múltiple', placeholder: '',                               icon: '☑️' },
  select:      { label: 'Lista desplegable',  placeholder: '',                               icon: '▾'  },
  date:        { label: 'Fecha',              placeholder: 'YYYY-MM-DD',                     icon: '📅' },
  'date-time': { label: 'Fecha y hora',       placeholder: 'YYYY-MM-DD HH:mm',              icon: '🕐' },
  price:       { label: 'Precio',             placeholder: '0.00',                           icon: '💲' },
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
  } else {
    delete base.options;
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
        'w-full text-left rounded-lg border-2 px-3 py-2.5 transition-all group',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-transparent hover:border-default-200 hover:bg-default-50',
      ].join(' ')}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm shrink-0">{meta.icon}</span>
          <span className="text-sm font-medium text-default-800 truncate flex-1">
            {question.label}
            {question.required && <span className="text-danger ml-1 font-bold">*</span>}
          </span>
          <span className={[
            'text-xs px-1.5 py-0.5 rounded-full shrink-0 transition-all',
            isSelected
              ? 'bg-primary/10 text-primary opacity-100'
              : 'opacity-0 group-hover:opacity-70 bg-default-100 text-default-500',
          ].join(' ')}>
            {isSelected ? 'Editando' : 'Editar'}
          </span>
        </div>

        {shouldUseOptions(question.type) && Array.isArray(question.options) ? (
          <div className="flex flex-col gap-1 pl-6">
            {question.options.slice(0, 3).map((opt) => (
              <span key={opt} className="text-xs text-default-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-default-300 shrink-0" />
                {opt}
              </span>
            ))}
            {question.options.length > 3 && (
              <span className="text-xs text-default-400 pl-4">+{question.options.length - 3} más…</span>
            )}
          </div>
        ) : (
          <p className="pl-6 text-xs text-default-400 italic truncate">
            {question.placeholder || meta.placeholder || meta.label}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── FieldEditor — panel derecho de edición ───────────────────────────────────

function FieldEditor({ question, onUpdate, onRemove }) {
  const [questionJsonDraft, setQuestionJsonDraft] = useState('');

  useEffect(() => {
    setQuestionJsonDraft(question ? safeStringify(question) : '');
  }, [question?.id]);

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
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-default-400 text-center">
        <span className="text-4xl">👆</span>
        <p className="text-sm font-medium text-default-600">Selecciona un campo</p>
        <p className="text-xs max-w-50 leading-relaxed">
          Haz clic en cualquier campo de la izquierda para ver y editar sus propiedades aquí
        </p>
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{getTypeMeta(selectedQuestionType).icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-default-800 truncate">{question.label}</p>
            <p className="text-xs text-default-400">{getTypeMeta(selectedQuestionType).label}</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" color="danger" onPress={onRemove}>Eliminar</Button>
      </div>

      <FieldRow label="Etiqueta visible">
        <input
          className="kovia-input"
          value={question.label || ''}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
      </FieldRow>

      <FieldRow label="Tipo de campo">
        <select
          className="kovia-select"
          value={selectedQuestionType}
          onChange={(e) => onUpdate({ type: e.target.value })}
        >
          {QUESTION_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {getTypeMeta(type).icon}  {getTypeMeta(type).label}
            </option>
          ))}
        </select>
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Placeholder">
          <input
            className="kovia-input"
            value={question.placeholder || ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
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
            value={Array.isArray(question.options) ? question.options.join(', ') : ''}
            onChange={(e) => {
              const options = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
              onUpdate({ options });
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
  const [showJson,     setShowJson]     = useState(false);
  const [showEmbed,    setShowEmbed]    = useState(false);

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
  }

  function updateCompletionAction(patch) {
    syncJson({ ...config, completion_action: { ...(config.completion_action || {}), ...patch } });
  }

  function updateSubmissionPolicy(patch) {
    syncJson({ ...config, submission_policy: { ...(config.submission_policy || {}), ...patch } });
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

  async function handleArchiveResponses() {
    const confirmed = window.confirm('¿Deseas archivar todas las respuestas de este formulario? Esta acción oculta las respuestas de los listados.');
    if (!confirmed) return;

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

  async function handleDeleteForm() {
    const confirmed = window.confirm('¿Deseas desactivar este formulario? Podrás volver a activarlo después si lo editas.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteForm(formId);
      notifySuccess('Formulario desactivado correctamente.');
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
          <Button as={Link} size="sm" variant="ghost" to={`/forms/${templateId}`}>← Volver</Button>
          <Button size="sm" variant="secondary" onPress={() => setShowJson(true)}>{'</>'} JSON</Button>
          <Button size="sm" variant="secondary" onPress={() => setShowEmbed(true)}>🔗 Embed</Button>
          <Button size="sm" variant="secondary" onPress={() => setShowSettings(true)}>⚙️ Ajustes</Button>
          <Button
            size="sm"
            color="danger"
            variant="ghost"
            isDisabled={isArchiving || isDeleting}
            onPress={handleArchiveResponses}
          >
            {isArchiving ? 'Archivando…' : 'Archivar respuestas'}
          </Button>
          <Button
            size="sm"
            color="danger"
            variant="secondary"
            isDisabled={isDeleting || isArchiving}
            onPress={handleDeleteForm}
          >
            {isDeleting ? 'Desactivando…' : 'Eliminar formulario'}
          </Button>
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
                  <div className="grid min-h-130 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">

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
    </div>
  );
}