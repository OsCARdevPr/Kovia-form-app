export default function DiscoveryFormIntroStep({ onStart, isLoadingConfig, introScreen }) {
  const leadText = introScreen?.leadText || 'Antes de nuestra reunión, completa este formulario.';
  const supportPrefixText = introScreen?.supportPrefixText || 'Con esta información';
  const supportHighlightPrimaryText = introScreen?.supportHighlightPrimaryText || 'trazaremos tu flujo de ventas actual';
  const supportMiddleText = introScreen?.supportMiddleText || 'y llegaremos con un';
  const supportHighlightSecondaryText = introScreen?.supportHighlightSecondaryText || 'borrador listo';
  const supportSuffixText = introScreen?.supportSuffixText || 'para revisar juntos.';
  const estimatedTimeText = introScreen?.estimatedTimeText || '≈ 8 minutos';
  const startButtonText = introScreen?.startButtonText || 'Comenzar';
  const loadingButtonText = introScreen?.loadingButtonText || 'Cargando...';

  return (
    <section className="form-section active" data-step="0" id="step-0">
      <div className="intro-content">
        <p>{leadText}</p>
        <div className="intro-divider" />
        <p>
          {supportPrefixText} <strong>{supportHighlightPrimaryText}</strong> {supportMiddleText}
          <strong> {supportHighlightSecondaryText}</strong> {` ${supportSuffixText}`}
        </p>
        <div className="intro-time">
          <svg viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{estimatedTimeText}</span>
        </div>
        <div className="intro-cta">
          <button type="button" className="btn btn-primary" id="btnStart" onClick={onStart} disabled={isLoadingConfig}>
            <span className="btn-text">{isLoadingConfig ? loadingButtonText : startButtonText}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
}
