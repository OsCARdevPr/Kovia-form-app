import FormNavigation from '../ui/FormNavigation';
import DiscoveryFormQuestionField from './DiscoveryFormQuestionField';

export default function DiscoveryFormStepSection({
  step,
  currentStep,
  totalSteps,
  methods,
  dynamicConfig,
  watchedValues,
  onNext,
  onPrev,
  onSubmit,
  isSubmitting,
  submitError,
}) {
  return (
    <section className="form-section active" data-step={step.order} id={`step-${step.order}`}>
      <div className="section-header">
        <div className="section-number">Sección {String(step.order).padStart(2, '0')}</div>
        <h2 className="section-title">{step.title}</h2>
      </div>

      {(step.questions || []).map((question) => (
        <DiscoveryFormQuestionField
          key={question.id}
          question={question}
          stepOrder={step.order}
          dynamicConfig={dynamicConfig}
          methods={methods}
          watchedValues={watchedValues}
        />
      ))}

      <FormNavigation
        stepNum={currentStep}
        totalSteps={totalSteps}
        onNext={currentStep < totalSteps ? onNext : undefined}
        onPrev={currentStep > 1 ? onPrev : undefined}
        onSubmit={currentStep === totalSteps ? onSubmit : undefined}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </section>
  );
}
