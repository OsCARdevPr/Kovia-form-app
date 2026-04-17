// src/lib/useFormDraft.js
// Hook para persistir el progreso del formulario en localStorage

import { useEffect, useRef } from 'react';

const DRAFT_KEY  = 'kovia_form_draft';
const STEP_KEY   = 'kovia_form_step';

/**
 * Maneja la persistencia del borrador del formulario en localStorage.
 *
 * @param {object} methods  - Instancia de react-hook-form (useForm)
 * @param {number} currentStep
 * @param {function} setCurrentStep
 * @param {number} totalSteps
 * @returns {{ hasDraft: boolean, clearDraft: function }}
 */
export function useFormDraft(methods, currentStep, setCurrentStep, totalSteps = 7) {
  // ── Restaurar borrador al montar ────────────────────────
  // Usamos una referencia para sólo ejecutarlo una vez
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      const rawValues = localStorage.getItem(DRAFT_KEY);
      const rawStep   = localStorage.getItem(STEP_KEY);

      if (rawValues) {
        const saved = JSON.parse(rawValues);
        // reset() aplica los valores sin disparar validaciones
        methods.reset(saved, { keepDefaultValues: false });
      }

      if (rawStep) {
        const step = parseInt(rawStep, 10);
        // Solo restaurar si es un step válido dentro del formulario dinámico
        if (step >= 1 && step <= totalSteps) {
          setCurrentStep(step);
        }
      }
    } catch (e) {
      console.warn('[Kovia Draft] No se pudo restaurar el borrador:', e);
    }
  }, [setCurrentStep, totalSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guardar borrador cuando cambia el step ───────────────
  useEffect(() => {
    // No guardar en step 0 (intro) ni 8 (success)
    if (currentStep === 0 || currentStep === 8) return;

    try {
      const values = methods.getValues();
      localStorage.setItem(DRAFT_KEY,  JSON.stringify(values));
      localStorage.setItem(STEP_KEY,   String(currentStep));
    } catch (e) {
      console.warn('[Kovia Draft] No se pudo guardar el borrador:', e);
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Limpiar draft después del submit exitoso ─────────────
  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(STEP_KEY);
    } catch (e) {
      // Silencioso
    }
  }

  // ── Detectar si existe un borrador previo ────────────────
  const hasDraft = (() => {
    try {
      const step = parseInt(localStorage.getItem(STEP_KEY), 10);
      return step >= 1 && step <= totalSteps;
    } catch {
      return false;
    }
  })();

  return { hasDraft, clearDraft };
}
