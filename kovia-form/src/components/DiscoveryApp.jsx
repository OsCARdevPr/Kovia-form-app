// src/components/DiscoveryApp.jsx
// Componente raíz — renderiza el canvas y el formulario dentro del árbol React
import { useState, useCallback } from 'react';
import BackgroundCanvas from './ui/BackgroundCanvas';
import DiscoveryForm from './DiscoveryForm';
import '../styles/global.css';

export default function DiscoveryApp({ formSlug }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleStepChange = useCallback((step) => {
    setCurrentStep(step);
  }, []);

  return (
    <>
      {/* Canvas 3D — renderizado directamente en React, fuera del flujo del form */}
      <BackgroundCanvas currentStep={currentStep} />

      {/* Formulario multi-step */}
      <DiscoveryForm onStepChange={handleStepChange} formSlug={formSlug} />
    </>
  );
}
