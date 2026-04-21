export default function DiscoveryFormDraftBanner({ onDismiss }) {
  return (
    <div className="draft-banner" role="status" aria-live="polite">
      <span className="draft-banner__icon">💾</span>
      <span className="draft-banner__text">
        Retomamos donde lo dejaste — tu progreso fue restaurado automáticamente.
      </span>
      <button
        className="draft-banner__dismiss"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  );
}
