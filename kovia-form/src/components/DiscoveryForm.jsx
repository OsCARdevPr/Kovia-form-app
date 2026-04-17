// src/components/DiscoveryForm.jsx
// Renderizado dinámico del formulario desde config del backend
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { stepSchemas as fallbackStepSchemas, buildStepSchemasFromConfig } from '../lib/schemas';
import { useFormDraft } from '../lib/useFormDraft';

import ProgressBar from './ui/ProgressBar';
import FormNavigation from './ui/FormNavigation';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001';
const FORM_SLUG = import.meta.env.PUBLIC_FORM_SLUG || 'kovia-discovery';

function buildDefaultValues(config) {
  const defaults = {};
  const steps = Array.isArray(config?.steps) ? config.steps : [];

  for (const step of steps) {
    if (!Array.isArray(step?.questions)) continue;

    for (const question of step.questions) {
      if (!question?.id) continue;

      if (question.type === 'checkbox') {
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

function SuccessStep({ onReset }) {
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

  const totalSteps = Array.isArray(dynamicConfig?.steps) ? dynamicConfig.steps.length : 0;
  const successStep = totalSteps + 1;
  const safeTotalForDraft = totalSteps > 0 ? totalSteps : 7;

  const stepLabels = useMemo(() => {
    const steps = Array.isArray(dynamicConfig?.steps) ? dynamicConfig.steps : [];
    return steps.map((step) => step.short_label || step.title || `Paso ${step.order}`);
  }, [dynamicConfig]);

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
    const visible = isQuestionVisible(question, watchedValues || {});
    if (!visible) return null;

    const error = methods.formState.errors?.[question.id]?.message;
    const inputId = `field-${stepOrder}-${question.id}`;

    const renderLabel = () => (
      <label className="form-label" htmlFor={question.type === 'radio' || question.type === 'checkbox' ? undefined : inputId}>
        {question.label} {question.required ? <span className="required">*</span> : null}
        {question.hint ? <span className="label-hint">{question.hint}</span> : null}
      </label>
    );

    if (question.type === 'radio') {
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

    if (question.type === 'checkbox') {
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

    if (question.type === 'textarea') {
      return (
        <div className="form-group" data-field={question.id} key={question.id}>
          {renderLabel()}
          <textarea
            id={inputId}
            className={`form-textarea ${error ? 'input-error' : ''}`}
            placeholder={question.placeholder || ''}
            {...methods.register(question.id)}
          />
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    if (question.type === 'select') {
      return (
        <div className="form-group" data-field={question.id} key={question.id}>
          {renderLabel()}
          <select id={inputId} className={`form-input ${error ? 'input-error' : ''}`} {...methods.register(question.id)}>
            <option value="">Selecciona una opción</option>
            {(question.options || []).map((option) => (
              <option key={`${question.id}-${option}`} value={option}>{option}</option>
            ))}
          </select>
          {error ? <div className="error-message">{error}</div> : null}
        </div>
      );
    }

    return (
      <div className="form-group" data-field={question.id} key={question.id}>
        {renderLabel()}
        <input
          id={inputId}
          type={question.type === 'email' || question.type === 'tel' ? question.type : 'text'}
          className={`form-input ${error ? 'input-error' : ''}`}
          placeholder={question.placeholder || ''}
          {...methods.register(question.id)}
        />
        {error ? <div className="error-message">{error}</div> : null}
      </div>
    );
  }, [methods, watchedValues]);

  const renderDynamicStep = () => {
    const step = dynamicConfig?.steps?.[currentStep - 1];

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
      return <SuccessStep onReset={handleReset} />;
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
