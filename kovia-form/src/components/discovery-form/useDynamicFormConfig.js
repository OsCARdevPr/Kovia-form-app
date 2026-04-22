import { useEffect, useState } from 'react';
import { stepSchemas as fallbackStepSchemas, buildStepSchemasFromConfig } from '../../lib/schemas';
import { buildDefaultValues, buildFormEndpoint, resolveIntroScreen } from './formUtils';

export function useDynamicFormConfig({
  formSlug,
  methods,
  setSubmitError,
  onConfigLoaded,
}) {
  const [dynamicStepSchemas, setDynamicStepSchemas] = useState(fallbackStepSchemas);
  const [dynamicFormTitle, setDynamicFormTitle] = useState('Discovery Form');
  const [dynamicConfig, setDynamicConfig] = useState({ steps: [] });
  const [dynamicIntroScreen, setDynamicIntroScreen] = useState(resolveIntroScreen({}));
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDynamicForm() {
      setIsLoadingConfig(true);
      setSubmitError(null);

      try {
        const endpoint = buildFormEndpoint(formSlug);
        if (!endpoint) {
          throw new Error('No se encontró el slug del formulario en la URL.');
        }

        const response = await fetch(endpoint);
        const payload = await response.json();

        if (!response.ok || payload.status !== 'success') {
          throw new Error(payload.message || 'No fue posible cargar la configuracion dinamica');
        }

        if (cancelled) return;

        const config = payload?.data?.config || { steps: [] };
        const parsedSchemas = buildStepSchemasFromConfig(config);
        const defaultValues = buildDefaultValues(config);

        setDynamicConfig(config);
        setDynamicIntroScreen(resolveIntroScreen(config));
        setDynamicStepSchemas(Object.keys(parsedSchemas).length > 0 ? parsedSchemas : fallbackStepSchemas);

        if (payload?.data?.title) {
          setDynamicFormTitle(payload.data.title);
        }

        methods.reset({
          ...defaultValues,
          ...methods.getValues(),
        });

        if (typeof onConfigLoaded === 'function') {
          onConfigLoaded(config);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[Kovia Form] Dynamic schema fallback enabled:', error.message);
          setSubmitError('No se pudo cargar la configuración dinámica del formulario.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false);
        }
      }
    }

    void loadDynamicForm();

    return () => {
      cancelled = true;
    };
  }, [formSlug, methods, onConfigLoaded, setSubmitError]);

  return {
    dynamicConfig,
    dynamicFormTitle,
    dynamicIntroScreen,
    dynamicStepSchemas,
    isLoadingConfig,
  };
}
