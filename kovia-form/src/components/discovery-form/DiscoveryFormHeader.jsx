export default function DiscoveryFormHeader({ dynamicFormTitle }) {
  return (
    <header className="form-header">
      <div className="logo-container">
        <h1 className="logo-text">Kovia</h1>
      </div>
      <p className="form-title">{dynamicFormTitle}</p>
      <p className="form-subtitle">Pre-Onboarding</p>
    </header>
  );
}
