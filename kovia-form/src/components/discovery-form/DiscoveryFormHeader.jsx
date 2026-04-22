export default function DiscoveryFormHeader({ dynamicFormTitle, introScreen }) {
  const brandText = introScreen?.brandText || 'Kovia';
  const subtitleText = introScreen?.subtitleText || 'Pre-Onboarding';

  return (
    <header className="form-header">
      <div className="logo-container">
        <h1 className="logo-text">{brandText}</h1>
      </div>
      <p className="form-title">{dynamicFormTitle}</p>
      <p className="form-subtitle">{subtitleText}</p>
    </header>
  );
}
