export default function DiscoveryFormIntroStep({ onStart, isLoadingConfig }) {
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
