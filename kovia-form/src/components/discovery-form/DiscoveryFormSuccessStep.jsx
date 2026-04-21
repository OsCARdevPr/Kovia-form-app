export default function DiscoveryFormSuccessStep({ onReset, completionAction }) {
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
