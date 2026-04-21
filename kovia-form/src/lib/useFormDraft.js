// src/lib/useFormDraft.js
// Hook para persistir el progreso del formulario en localStorage

import { useEffect, useRef } from 'react';

const DRAFT_KEY_PREFIX = 'kovia_form_draft';
const STEP_KEY_PREFIX = 'kovia_form_step';

function sanitizeDraftNamespace(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-');

  return normalized || 'default';
}

/**
 * Maneja la persistencia del borrador del formulario en localStorage.
 *
 * @param {object} methods  - Instancia de react-hook-form (useForm)
 * @param {number} currentStep
 * @param {function} setCurrentStep
 * @param {number} totalSteps
 * @param {string} draftNamespace
 * @returns {{ hasDraft: boolean, clearDraft: function }}
 */
export function useFormDraft(methods, currentStep, setCurrentStep, totalSteps = 7, draftNamespace = 'default') {
  const namespace = sanitizeDraftNamespace(draftNamespace);
  const draftKey = `${DRAFT_KEY_PREFIX}:${namespace}`;
  const stepKey = `${STEP_KEY_PREFIX}:${namespace}`;

  // ── Restaurar borrador al montar ────────────────────────
  // Usamos una referencia para sólo ejecutarlo una vez
  const restoredRef = useRef(false);

  useEffect(() => {
    restoredRef.current = false;
  }, [namespace]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    try {
      const rawValues = localStorage.getItem(draftKey);
      const rawStep = localStorage.getItem(stepKey);

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
  }, [draftKey, methods, setCurrentStep, stepKey, totalSteps]);

  // ── Guardar borrador cuando cambia el step ───────────────
  useEffect(() => {
    // No guardar en intro ni al llegar al paso de éxito
    if (currentStep === 0 || currentStep > totalSteps) return;

    try {
      const values = methods.getValues();
      localStorage.setItem(draftKey, JSON.stringify(values));
      localStorage.setItem(stepKey, String(currentStep));
    } catch (e) {
      console.warn('[Kovia Draft] No se pudo guardar el borrador:', e);
    }
  }, [currentStep, draftKey, methods, stepKey, totalSteps]);

  // ── Limpiar draft después del submit exitoso ─────────────
  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(stepKey);
    } catch (e) {
      // Silencioso
    }
  }

  // ── Detectar si existe un borrador previo ────────────────
  const hasDraft = (() => {
    try {
      const step = parseInt(localStorage.getItem(stepKey), 10);
      return step >= 1 && step <= totalSteps;
    } catch {
      return false;
    }
  })();

  return { hasDraft, clearDraft };
}
