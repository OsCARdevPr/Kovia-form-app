// src/components/DiscoveryForm.jsx
// Renderizado dinámico del formulario desde config del backend
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, FormProvider, useWatch, Controller } from 'react-hook-form';
import IMask from 'imask';
import { IMaskInput } from 'react-imask';
import { stepSchemas as fallbackStepSchemas, buildStepSchemasFromConfig } from '../lib/schemas';
import { useFormDraft } from '../lib/useFormDraft';

import ProgressBar from './ui/ProgressBar';
import FormNavigation from './ui/FormNavigation';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000';
const FORM_SLUG = import.meta.env.PUBLIC_FORM_SLUG || 'kovia-discovery';

const FIELD_TYPE_ALIASES = Object.freeze({
  tel: 'telefono',
  phone: 'telefono',
  datetime: 'date-time',
  date_time: 'date-time',
});

const BUILTIN_FIELD_TYPE_INDEX = Object.freeze({
  text: { html_input_type: 'text' },
  textarea: { html_input_type: 'text' },
  radio: { html_input_type: 'radio' },
  checkbox: { html_input_type: 'checkbox' },
  select: { html_input_type: 'select' },
  telefono: {
    html_input_type: 'tel',
    mask_preset: 'telefono',
    default_placeholder: '77771234',
  },
  email: {
    html_input_type: 'email',
  },
  date: {
    html_input_type: 'text',
    mask_preset: 'date-iso',
    default_placeholder: 'YYYY-MM-DD',
  },
  'date-time': {
    html_input_type: 'text',
    mask_preset: 'date-time-iso',
    default_placeholder: 'YYYY-MM-DD HH:mm',
  },
  price: {
    html_input_type: 'text',
    mask_preset: 'price',
    default_placeholder: '0.00',
  },
});

function normalizeFieldType(type) {
  const rawType = String(type || '').trim().toLowerCase();
  return FIELD_TYPE_ALIASES[rawType] || rawType || 'text';
}

function getFieldTypeDefinition(question, config) {
  const normalizedType = normalizeFieldType(question?.type);
  const configuredIndex = config?.field_type_index && typeof config.field_type_index === 'object'
    ? config.field_type_index
    : {};
  const configuredType = configuredIndex[normalizedType] && typeof configuredIndex[normalizedType] === 'object'
    ? configuredIndex[normalizedType]
    : {};

  return {
    key: normalizedType,
    ...(BUILTIN_FIELD_TYPE_INDEX[normalizedType] || {}),
    ...configuredType,
  };
}

function resolvePlaceholder(question, fieldTypeDefinition) {
  if (typeof question?.placeholder === 'string') {
    return question.placeholder;
  }

  if (typeof fieldTypeDefinition?.default_placeholder === 'string') {
    return fieldTypeDefinition.default_placeholder;
  }

  return '';
}

function formatDateValue(date) {
  let day = date.getDate();
  let month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (day < 10) day = `0${day}`;
  if (month < 10) month = `0${month}`;

  return [year, month, day].join('-');
}

function parseDateValue(value) {
  const [yearToken, monthToken, dayToken] = String(value || '').split('-');
  const year = Number(yearToken);
  const month = Number(monthToken);
  const day = Number(dayToken);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date('');
  }

  return new Date(year, month - 1, day);
}

function formatDateTimeValue(date) {
  const datePart = formatDateValue(date);
  let hours = date.getHours();
  let minutes = date.getMinutes();

  if (hours < 10) hours = `0${hours}`;
  if (minutes < 10) minutes = `0${minutes}`;

  return `${datePart} ${hours}:${minutes}`;
}

function parseDateTimeValue(value) {
  const [dateToken, timeToken] = String(value || '').split(' ');
  if (!dateToken || !timeToken) return new Date('');

  const [yearToken, monthToken, dayToken] = dateToken.split('-');
  const [hoursToken, minutesToken] = timeToken.split(':');

  const year = Number(yearToken);
  const month = Number(monthToken);
  const day = Number(dayToken);
  const hours = Number(hoursToken);
  const minutes = Number(minutesToken);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date('');
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return new Date('');
  }

  return new Date(year, month - 1, day, hours, minutes);
}

function buildMaskOptions(question, fieldTypeDefinition) {
  const maskPreset = question?.mask_preset || fieldTypeDefinition?.mask_preset;
  const customMask = question?.mask && typeof question.mask === 'object' ? question.mask : {};

  if (maskPreset === 'telefono') {
    return {
      mask: '00000000',
      lazy: false,
      overwrite: true,
      ...customMask,
    };
  }

  if (maskPreset === 'date-iso') {
    return {
      mask: Date,
      pattern: 'Y-`m-`d',
      blocks: {
        d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
        m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
        Y: { mask: IMask.MaskedRange, from: 1900, to: 2999 },
      },
      format: formatDateValue,
      parse: parseDateValue,
      autofix: true,
      overwrite: true,
      lazy: false,
      ...customMask,
    };
  }

  if (maskPreset === 'date-time-iso') {
    return {
      mask: Date,
      pattern: 'Y-`m-`d `H:`M',
      blocks: {
        d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
        m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
        Y: { mask: IMask.MaskedRange, from: 1900, to: 2999 },
        H: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2 },
        M: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
      },
      format: formatDateTimeValue,
      parse: parseDateTimeValue,
      autofix: true,
      overwrite: true,
      lazy: false,
      ...customMask,
    };
  }

  if (maskPreset === 'price') {
    return {
      mask: Number,
      scale: 2,
      signed: false,
      thousandsSeparator: ',',
      radix: '.',
      mapToRadix: ['.'],
      normalizeZeros: true,
      padFractionalZeros: false,
      lazy: false,
      ...customMask,
    };
  }

  return null;
}

function buildDefaultValues(config) {
  const defaults = {};
  const steps = Array.isArray(config?.steps) ? config.steps : [];

  for (const step of steps) {
    if (!Array.isArray(step?.questions)) continue;

    for (const question of step.questions) {
      if (!question?.id) continue;

      const questionType = normalizeFieldType(question?.type);

      if (questionType === 'checkbox') {
        defaults[question.id] = [];
      } else {
        defaults[question.id] = '';
      }
    }
  }

  return defaults;
}

function isQuestionVisible(question, values) {
  const rule = question?.visible_when;
  if (!rule || typeof rule !== 'object' || !rule.field) return true;

  const sourceValue = values?.[rule.field];

  if (rule.includes != null) {
    if (Array.isArray(sourceValue)) {
      return sourceValue.includes(rule.includes);
    }
    if (typeof sourceValue === 'string') {
      return sourceValue.includes(String(rule.includes));
    }
    return false;
  }

  if (rule.equals != null) {
    return sourceValue === rule.equals;
  }

  if (rule.notEquals != null) {
    return sourceValue !== rule.notEquals;
  }

  return true;
}

function sanitizeExternalUrl(value) {
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

function extractIframeSrc(embedCode) {
  if (typeof embedCode !== 'string') return '';
  const match = embedCode.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  return match?.[1] || '';
}

function normalizeCompletionAction(rawAction) {
  if (!rawAction || typeof rawAction !== 'object') return null;

  const actionType = String(rawAction.type || '').trim().toLowerCase();

  if (actionType === 'redirect') {
    const targetUrl = sanitizeExternalUrl(rawAction.url || rawAction.redirect_url);
    if (!targetUrl) return null;

    return {
      type: 'redirect',
      url: targetUrl,
      buttonLabel: rawAction.button_label || rawAction.buttonLabel || 'Continuar',
      openInNewTab: rawAction.open_in_new_tab !== false,
      description: rawAction.description || '',
    };
  }

  if (actionType === 'embed') {
    const embedUrl = sanitizeExternalUrl(
      rawAction.embed_url || rawAction.url || extractIframeSrc(rawAction.embed_code),
    );
    if (!embedUrl) return null;

    const preferredHeight = Number(rawAction.embed_height || rawAction.height);
    return {
      type: 'embed',
      url: embedUrl,
      title: rawAction.title || 'Agenda tu reunión',
      description: rawAction.description || '',
      height: Number.isFinite(preferredHeight) && preferredHeight >= 360 ? preferredHeight : 680,
    };
  }

  return null;
}

function resolveCompletionAction(config) {
  const configuredAction = normalizeCompletionAction(config?.completion_action);
  if (configuredAction) return configuredAction;

  const steps = Array.isArray(config?.steps) ? config.steps : [];
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
  return normalizeCompletionAction(lastStep);
}

function IntroStep({ onStart, isLoadingConfig }) {
  return (
    <section className="form-section active" data-step="0" id="step-0">
      <div className="intro-content">
        <p>Antes de nuestra reunión, completa este formulario.</p>
        <div className="intro-divider" />
        <p>
          Con esta información <strong>trazaremos tu flujo de ventas actual</strong> y llegaremos con un
          <strong> borrador listo</strong> para revisar juntos.
        </p>
        <div className="intro-time">
          <svg viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>≈ 8 minutos</span>
        </div>
        <div className="intro-cta">
          <button type="button" className="btn btn-primary" id="btnStart" onClick={onStart} disabled={isLoadingConfig}>
            <span className="btn-text">{isLoadingConfig ? 'Cargando...' : 'Comenzar'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}

function SuccessStep({ onReset, completionAction }) {
  return (
    <section className="form-section active" data-step="success" id="step-success">
      <div className="success-content">
        <div className="success-icon">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="success-title">Información recibida</h2>
        <p className="success-message">
          Hemos recibido tu información correctamente.
          <br />
          <br />
          Nuestro equipo la revisará y preparará un <strong>borrador de tu flujo de ventas actual</strong>.
          <br />
          <br />
          <strong>Nos vemos en la reunión.</strong>
        </p>

        {completionAction?.description ? (
          <p className="success-action-description">{completionAction.description}</p>
        ) : null}

        {completionAction?.type === 'redirect' ? (
          <div className="success-action-block">
            <a
              href={completionAction.url}
              target={completionAction.openInNewTab ? '_blank' : '_self'}
              rel={completionAction.openInNewTab ? 'noreferrer noopener' : undefined}
              className="btn btn-primary"
              id="btnCompletionRedirect"
            >
              <span className="btn-text">{completionAction.buttonLabel}</span>
            </a>
          </div>
        ) : null}

        {completionAction?.type === 'embed' ? (
          <div className="success-action-block">
            <h3 className="success-embed-title">{completionAction.title}</h3>
            <div className="success-embed-frame-wrapper">
              <iframe
                className="success-embed-frame"
                src={completionAction.url}
                title={completionAction.title}
                loading="lazy"
                style={{ height: `${completionAction.height}px` }}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="camera; microphone; fullscreen; payment"
              />
            </div>
          </div>
        ) : null}

        <div className="success-cta">
          <button type="button" className="btn btn-secondary" id="btnReset" onClick={onReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span className="btn-text">Volver al inicio</span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default function DiscoveryForm({ onStepChange }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [dynamicStepSchemas, setDynamicStepSchemas] = useState(fallbackStepSchemas);
  const [dynamicFormTitle, setDynamicFormTitle] = useState('Discovery Form');
  const [dynamicConfig, setDynamicConfig] = useState({ steps: [] });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const methods = useForm({
    mode: 'onTouched',
    defaultValues: {},
  });

  const questionSteps = useMemo(() => {
    const steps = Array.isArray(dynamicConfig?.steps) ? dynamicConfig.steps : [];
    return steps.filter((step) => Array.isArray(step?.questions) && step.questions.length > 0);
  }, [dynamicConfig]);

  const completionAction = useMemo(() => resolveCompletionAction(dynamicConfig), [dynamicConfig]);

  const totalSteps = questionSteps.length;
  const successStep = totalSteps + 1;
  const safeTotalForDraft = totalSteps > 0 ? totalSteps : 7;

  const stepLabels = useMemo(() => {
    return questionSteps.map((step) => step.short_label || step.title || `Paso ${step.order}`);
  }, [questionSteps]);

  const watchedValues = useWatch({ control: methods.control });

  const { hasDraft, clearDraft } = useFormDraft(methods, currentStep, setCurrentStep, safeTotalForDraft);

  useEffect(() => {
    let cancelled = false;

    async function loadDynamicForm() {
      setIsLoadingConfig(true);

      try {
        const response = await fetch(`${API_URL}/api/forms/${FORM_SLUG}`);
        const payload = await response.json();

        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'No fue posible cargar la configuracion dinamica');
        }

        if (cancelled) return;

        const config = payload?.data?.config || { steps: [] };
        const parsedSchemas = buildStepSchemasFromConfig(config);
        const defaultValues = buildDefaultValues(config);

        setDynamicConfig(config);
        setDynamicStepSchemas(Object.keys(parsedSchemas).length > 0 ? parsedSchemas : fallbackStepSchemas);

        if (payload?.data?.title) {
          setDynamicFormTitle(payload.data.title);
        }

        methods.reset({
          ...defaultValues,
          ...methods.getValues(),
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('[Kovia Form] Dynamic schema fallback enabled:', error.message);
          setSubmitError('No se pudo cargar la configuración dinámica del formulario.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    }

    loadDynamicForm();

    return () => {
      cancelled = true;
    };
  }, [methods]);

  const validateCurrentStep = useCallback(async () => {
    if (currentStep < 1 || currentStep > totalSteps) return true;

    const schema = dynamicStepSchemas[currentStep];
    if (!schema) return true;

    const allValues = methods.getValues();
    const result = schema.safeParse(allValues);

    if (!result.success) {
      result.error.issues.forEach((err) => {
        const field = err.path[0];
        if (field) {
          methods.setError(field, { type: 'manual', message: err.message });
        }
      });
      return false;
    }

    const stepFields = Object.keys(schema.shape || {});
    stepFields.forEach((field) => methods.clearErrors(field));
    return true;
  }, [currentStep, dynamicStepSchemas, methods, totalSteps]);

  const goToStep = useCallback((step) => {
    const bounded = Math.max(0, Math.min(step, successStep));

    setCurrentStep(bounded);
    if (onStepChange) onStepChange(bounded);

    const card = document.querySelector('.form-card');
    if (card) {
      const y = card.getBoundingClientRect().top + window.scrollY - 50;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [onStepChange, successStep]);

  const handleNext = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (isValid) goToStep(currentStep + 1);
  }, [currentStep, goToStep, validateCurrentStep]);

  const handlePrev = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleStart = useCallback(() => {
    if (totalSteps > 0) {
      goToStep(1);
    }
  }, [goToStep, totalSteps]);

  const handleSubmit = useCallback(async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const formData = methods.getValues();
    const payload = { ...formData };

    if (Array.isArray(payload.canales_clientes) && payload.canales_clientes.includes('Otro') && payload.canales_clientes_otro) {
      payload.canales_clientes = payload.canales_clientes.map((channel) => {
        return channel === 'Otro' ? `Otro: ${payload.canales_clientes_otro}` : channel;
      });
    }
    delete payload.canales_clientes_otro;

    if (Array.isArray(payload.herramientas) && payload.herramientas.includes('Otra') && payload.herramientas_otro) {
      payload.herramientas = payload.herramientas.map((tool) => {
        return tool === 'Otra' ? `Otra: ${payload.herramientas_otro}` : tool;
      });
    }
    delete payload.herramientas_otro;

    try {
      const res = await fetch(`${API_URL}/api/forms/${FORM_SLUG}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        if (data?.errors?.fieldErrors) {
          Object.entries(data.errors.fieldErrors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              methods.setError(field, { type: 'server', message: messages[0] });
            }
          });
        }

        if (Array.isArray(data?.errors?.missingFields)) {
          data.errors.missingFields.forEach((field) => {
            methods.setError(field, { type: 'server', message: 'Este campo es obligatorio' });
          });
        }

        throw new Error(data.message || 'Error al enviar el formulario');
      }

      clearDraft();
      goToStep(successStep);
    } catch (err) {
      console.error('[Kovia Form] Submit error:', err);
      setSubmitError(err.message || 'Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }, [clearDraft, goToStep, methods, successStep, validateCurrentStep]);

  const handleReset = useCallback(() => {
    clearDraft();
    methods.reset(buildDefaultValues(dynamicConfig));
    goToStep(0);
  }, [clearDraft, dynamicConfig, goToStep, methods]);

  const renderQuestion = useCallback((question, stepOrder) => {
    const fieldTypeDefinition = getFieldTypeDefinition(question, dynamicConfig);
    const questionType = fieldTypeDefinition.key;
    const placeholder = resolvePlaceholder(question, fieldTypeDefinition);
    const maskOptions = buildMaskOptions(question, fieldTypeDefinition);

    const visible = isQuestionVisible(question, watchedValues || {});
    if (!visible) return null;

    const error = methods.formState.errors?.[question.id]?.message;
    const inputId = `field-${stepOrder}-${question.id}`;

    const renderLabel = () => (
      <label className="form-label" htmlFor={questionType === 'radio' || questionType === 'checkbox' ? undefined : inputId}>
        {question.label} {question.required ? <span className="required">*</span> : null}
        {question.hint ? <span className="label-hint">{question.hint}</span> : null}
      </label>
    );

    if (questionType === 'radio') {
      return (
        <div className="form-group" data-field={question.id} key={question.id}>
          {renderLabel()}
          <div className={`radio-group ${error ? 'group-error' : ''}`}>
            {(question.options || []).map((option, index) => (
              <div className="radio-option" key={`${question.id}-${option}`}>
                <input
                  type="radio"
                  id={`${inputId}-${index + 1}`}
                  value={option}
                  {...methods.register(question.id)}
                />
                <label htmlFor={`${inputId}-${index + 1}`}>{option}</label>
              </div>
            ))}
          </div>
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    if (questionType === 'checkbox') {
      return (
        <div className="form-group" data-field={question.id} data-type="checkbox" key={question.id}>
          {renderLabel()}
          <div className={`checkbox-group ${error ? 'group-error' : ''}`}>
            {(question.options || []).map((option, index) => (
              <div className="checkbox-option" key={`${question.id}-${option}`}>
                <input
                  type="checkbox"
                  id={`${inputId}-${index + 1}`}
                  value={option}
                  {...methods.register(question.id)}
                />
                <label htmlFor={`${inputId}-${index + 1}`}>{option}</label>
              </div>
            ))}
          </div>
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    if (questionType === 'textarea') {
      return (
        <div className="form-group" data-field={question.id} key={question.id}>
          {renderLabel()}
          <textarea
            id={inputId}
            className={`form-textarea ${error ? 'input-error' : ''}`}
            placeholder={placeholder}
            {...methods.register(question.id)}
          />
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    if (questionType === 'select') {
      return (
        <div className="form-group" data-field={question.id} key={question.id}>
          {renderLabel()}
          <select id={inputId} className={`form-input ${error ? 'input-error' : ''}`} {...methods.register(question.id)}>
            <option value="">{placeholder || 'Selecciona una opción'}</option>
            {(question.options || []).map((option) => (
              <option key={`${question.id}-${option}`} value={option}>{option}</option>
            ))}
          </select>
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    if (maskOptions) {
      return (
        <div className="form-group" data-field={question.id} data-type={questionType} key={question.id}>
          {renderLabel()}
          <Controller
            name={question.id}
            control={methods.control}
            render={({ field }) => (
              <IMaskInput
                {...maskOptions}
                id={inputId}
                value={typeof field.value === 'string' ? field.value : ''}
                inputRef={field.ref}
                onBlur={field.onBlur}
                className={`form-input ${error ? 'input-error' : ''}`}
                placeholder={placeholder}
                onAccept={(value) => field.onChange(value ?? '')}
              />
            )}
          />
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    const htmlInputType = fieldTypeDefinition?.html_input_type || 'text';

    return (
      <div className="form-group" data-field={question.id} key={question.id}>
        {renderLabel()}
        <input
          id={inputId}
          type={htmlInputType === 'email' || htmlInputType === 'tel' ? htmlInputType : 'text'}
          className={`form-input ${error ? 'input-error' : ''}`}
          placeholder={placeholder}
          {...methods.register(question.id)}
        />
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }, [dynamicConfig, methods, watchedValues]);

  const renderDynamicStep = () => {
    const step = questionSteps[currentStep - 1];

    if (!step) {
      return (
        <section className="form-section active" data-step="loading" id="step-loading">
          <div className="intro-content">
            <p>Cargando pasos del formulario...</p>
          </div>
        </section>
      );
    }

    return (
      <section className="form-section active" data-step={step.order} id={`step-${step.order}`}>
        <div className="section-header">
          <div className="section-number">Sección {String(step.order).padStart(2, '0')}</div>
          <h2 className="section-title">{step.title}</h2>
        </div>

        {(step.questions || []).map((question) => renderQuestion(question, step.order))}

        <FormNavigation
          stepNum={currentStep}
          totalSteps={totalSteps}
          onNext={currentStep < totalSteps ? handleNext : undefined}
          onPrev={currentStep > 1 ? handlePrev : undefined}
          onSubmit={currentStep === totalSteps ? handleSubmit : undefined}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      </section>
    );
  };

  const renderStep = () => {
    if (currentStep === 0) {
      return <IntroStep onStart={handleStart} isLoadingConfig={isLoadingConfig} />;
    }

    if (currentStep === successStep && totalSteps > 0) {
      return <SuccessStep onReset={handleReset} completionAction={completionAction} />;
    }

    return renderDynamicStep();
  };

  return (
    <FormProvider {...methods}>
      <div className="app-container">
        <div className="form-wrapper">
          <header className="form-header">
            <div className="logo-container">
              <h1 className="logo-text">Kovia</h1>
            </div>
            <p className="form-title">{dynamicFormTitle}</p>
            <p className="form-subtitle">Pre-Onboarding</p>
          </header>

          {hasDraft && !draftBannerDismissed && currentStep >= 1 && currentStep <= totalSteps && (
            <div className="draft-banner" role="status" aria-live="polite">
              <span className="draft-banner__icon">💾</span>
              <span className="draft-banner__text">
                Retomamos donde lo dejaste — tu progreso fue restaurado automáticamente.
              </span>
              <button
                className="draft-banner__dismiss"
                onClick={() => setDraftBannerDismissed(true)}
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>
          )}

          <ProgressBar
            currentStep={currentStep}
            totalSteps={totalSteps}
            labels={stepLabels}
          />

          <div className="form-card">
            <form noValidate onSubmit={(e) => e.preventDefault()}>
              {renderStep()}
            </form>
          </div>

          <footer className="form-footer">
            <p>Powered by <a href="#" target="_blank" rel="noreferrer">Kovia</a> · Automatización de Procesos</p>
          </footer>
        </div>
      </div>
    </FormProvider>
  );
}
