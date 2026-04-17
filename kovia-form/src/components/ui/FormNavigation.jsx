// src/components/ui/FormNavigation.jsx
// Componente reutilizable de navegación entre steps

export function NavArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function NavArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default function FormNavigation({
  stepNum,
  totalSteps,
  onNext,
  onPrev,
  onSubmit,
  isSubmitting = false,
  submitError = null,
}) {
  const isLastStep = stepNum === totalSteps;

  return (
    <>
      {submitError && (
        <div style={{ color: 'var(--primary-red)', fontSize: '0.8rem', marginTop: '12px', textAlign: 'right' }}>
          ⚠ {submitError}
        </div>
      )}
      <div className="form-navigation">
        <div className="nav-left">
          {onPrev && (
            <button type="button" className="btn btn-secondary" onClick={onPrev}>
              <NavArrowLeft />
              <span className="btn-text">Atrás</span>
            </button>
          )}
        </div>

        <span className="step-counter">{stepNum} / {totalSteps}</span>

        <div className="nav-right">
          {isLastStep ? (
            <button
              type="button"
              className={`btn btn-submit ${isSubmitting ? 'btn-loading' : ''}`}
              onClick={onSubmit}
              disabled={isSubmitting}
              id="btnSubmit"
            >
              <span className="btn-text">{isSubmitting ? 'Enviando...' : 'Enviar formulario'}</span>
              <div className="spinner" />
              <svg className="btn-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              <span className="btn-text">Siguiente</span>
              <NavArrowRight />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
