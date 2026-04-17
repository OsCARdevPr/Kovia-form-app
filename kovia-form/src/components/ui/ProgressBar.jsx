// src/components/ui/ProgressBar.jsx
// Barra de progreso con step dots —  idéntica al diseño original

export default function ProgressBar({ currentStep, totalSteps, labels }) {
  if (currentStep < 1 || currentStep > totalSteps) return null;

  const percent = (currentStep / totalSteps) * 100;
  const glowSize = 10 + percent / 5;

  return (
    <div className="progress-container visible">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${percent}%`,
            boxShadow: `0 0 ${glowSize}px var(--primary-red-glow)`,
          }}
        />
      </div>
      <div className="step-indicators" id="stepIndicators">
        {labels.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          return (
            <div
              key={stepNum}
              className={`step-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              data-step={stepNum}
            >
              <div className="step-dot-circle" />
              <span className="step-dot-label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
