// src/components/DiscoveryForm.jsx
// Renderizado dinámico del formulario desde config del backend
import { useState, useCallback, useMemo } from 'react';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { useFormDraft } from '../lib/useFormDraft';

import ProgressBar from './ui/ProgressBar';
import DiscoveryFormDraftBanner from './discovery-form/DiscoveryFormDraftBanner';
import DiscoveryFormFooter from './discovery-form/DiscoveryFormFooter';
import DiscoveryFormHeader from './discovery-form/DiscoveryFormHeader';
import DiscoveryFormIntroStep from './discovery-form/DiscoveryFormIntroStep';
import DiscoveryFormStepSection from './discovery-form/DiscoveryFormStepSection';
import DiscoveryFormSuccessStep from './discovery-form/DiscoveryFormSuccessStep';
import { FORM_SUBMISSION_ID_SOURCE_FIELD } from './discovery-form/formConstants';
import {
  buildDefaultValues,
  buildFormEndpoint,
  buildRedirectUrlWithDynamicParams,
  resolveCompletionAction,
} from './discovery-form/formUtils';
import { useDynamicFormConfig } from './discovery-form/useDynamicFormConfig';

export default function DiscoveryForm({ onStepChange, formSlug }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState({});

  const methods = useForm({
    mode: 'onTouched',
    defaultValues: {},
  });

  const handleConfigLoaded = useCallback(() => {
    setSubmittedAnswers({});
  }, []);

  const {
    dynamicConfig,
    dynamicFormTitle,
    dynamicIntroScreen,
    dynamicStepSchemas,
    isLoadingConfig,
  } = useDynamicFormConfig({
    formSlug,
    methods,
    setSubmitError,
    onConfigLoaded: handleConfigLoaded,
  });

  const questionSteps = useMemo(() => {
    const steps = Array.isArray(dynamicConfig?.steps) ? dynamicConfig.steps : [];
    return steps.filter((step) => Array.isArray(step?.questions) && step.questions.length > 0);
  }, [dynamicConfig]);

  const completionAction = useMemo(() => resolveCompletionAction(dynamicConfig), [dynamicConfig]);

  const resolvedCompletionAction = useMemo(() => {
    if (!completionAction || completionAction.type !== 'redirect') {
      return completionAction;
    }

    return {
      ...completionAction,
      url: buildRedirectUrlWithDynamicParams(
        completionAction.url,
        completionAction.redirectParams,
        submittedAnswers,
      ),
    };
  }, [completionAction, submittedAnswers]);

  const totalSteps = questionSteps.length;
  const successStep = totalSteps + 1;
  const safeTotalForDraft = totalSteps > 0 ? totalSteps : 7;

  const stepLabels = useMemo(() => {
    return questionSteps.map((step) => step.short_label || step.title || `Paso ${step.order}`);
  }, [questionSteps]);

  const watchedValues = useWatch({ control: methods.control });

  const { hasDraft, clearDraft } = useFormDraft(
    methods,
    currentStep,
    setCurrentStep,
    safeTotalForDraft,
    formSlug,
  );

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
      const endpoint = buildFormEndpoint(formSlug, 'submit');
      if (!endpoint) {
        throw new Error('No se encontró el slug del formulario en la URL.');
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });

      const data = await res.json();
      const isSuccessfulSubmit = res.ok && (data.status === 'success' || data.status === 'warning');

      if (!isSuccessfulSubmit) {
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
      const submissionId = data?.data?.id;
      setSubmittedAnswers({
        ...payload,
        ...(submissionId !== undefined && submissionId !== null
          ? {
            [FORM_SUBMISSION_ID_SOURCE_FIELD]: submissionId,
            form_submission_id: submissionId,
          }
          : {}),
      });
      goToStep(successStep);
    } catch (err) {
      console.error('[Kovia Form] Submit error:', err);
      setSubmitError(err.message || 'Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }, [clearDraft, formSlug, goToStep, methods, successStep, validateCurrentStep]);

  const handleReset = useCallback(() => {
    clearDraft();
    setSubmittedAnswers({});
    methods.reset(buildDefaultValues(dynamicConfig));
    goToStep(0);
  }, [clearDraft, dynamicConfig, goToStep, methods]);

  const renderStep = () => {
    if (currentStep === 0) {
      return (
        <DiscoveryFormIntroStep
          onStart={handleStart}
          isLoadingConfig={isLoadingConfig}
          introScreen={dynamicIntroScreen}
        />
      );
    }

    if (currentStep === successStep && totalSteps > 0) {
      return <DiscoveryFormSuccessStep onReset={handleReset} completionAction={resolvedCompletionAction} />;
    }

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
      <DiscoveryFormStepSection
        step={step}
        currentStep={currentStep}
        totalSteps={totalSteps}
        methods={methods}
        dynamicConfig={dynamicConfig}
        watchedValues={watchedValues}
        onNext={handleNext}
        onPrev={handlePrev}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    );
  };

  return (
    <FormProvider {...methods}>
      <div className="app-container">
        <div className="form-wrapper">
          <DiscoveryFormHeader dynamicFormTitle={dynamicFormTitle} introScreen={dynamicIntroScreen} />

          {hasDraft && !draftBannerDismissed && currentStep >= 1 && currentStep <= totalSteps && (
            <DiscoveryFormDraftBanner onDismiss={() => setDraftBannerDismissed(true)} />
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

          <DiscoveryFormFooter />
        </div>
      </div>
    </FormProvider>
  );
}
