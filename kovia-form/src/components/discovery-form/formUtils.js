import IMask from 'imask';
import {
  API_URL,
  BUILTIN_FIELD_TYPE_INDEX,
  DEFAULT_INTRO_SCREEN_CONFIG,
  FIELD_TYPE_ALIASES,
} from './formConstants';

function buildFormEndpoint(formSlug, action = '') {
  const normalizedSlug = String(formSlug || '').trim();
  if (!normalizedSlug) return '';

  const encodedSlug = encodeURIComponent(normalizedSlug);
  const cleanAction = String(action || '').replace(/^\/+/, '');
  const suffix = cleanAction ? `/${cleanAction}` : '';
  const path = `/api/forms/${encodedSlug}${suffix}`;

  const baseUrl = API_URL.replace(/\/+$/, '');
  if (!baseUrl) {
    return path;
  }

  return `${baseUrl}${path}`;
}

function normalizeFieldType(type) {
  const rawType = String(type || '').trim().toLowerCase();
  return FIELD_TYPE_ALIASES[rawType] || rawType || 'text';
}

function getFieldTypeDefinition(question, config) {
  const normalizedType = normalizeFieldType(question?.type);
  const configuredIndex = config?.field_type_index && typeof config.field_type_index === 'object'
    ? config.field_type_index
    : {};
  const configuredType = configuredIndex[normalizedType] && typeof configuredIndex[normalizedType] === 'object'
    ? configuredIndex[normalizedType]
    : {};

  return {
    key: normalizedType,
    ...(BUILTIN_FIELD_TYPE_INDEX[normalizedType] || {}),
    ...configuredType,
  };
}

function resolvePlaceholder(question, fieldTypeDefinition) {
  if (typeof question?.placeholder === 'string') {
    return question.placeholder;
  }

  if (typeof fieldTypeDefinition?.default_placeholder === 'string') {
    return fieldTypeDefinition.default_placeholder;
  }

  return '';
}

function formatDateValue(date) {
  let day = date.getDate();
  let month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (day < 10) day = `0${day}`;
  if (month < 10) month = `0${month}`;

  return [year, month, day].join('-');
}

function parseDateValue(value) {
  const [yearToken, monthToken, dayToken] = String(value || '').split('-');
  const year = Number(yearToken);
  const month = Number(monthToken);
  const day = Number(dayToken);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date('');
  }

  return new Date(year, month - 1, day);
}

function formatDateTimeValue(date) {
  const datePart = formatDateValue(date);
  let hours = date.getHours();
  let minutes = date.getMinutes();

  if (hours < 10) hours = `0${hours}`;
  if (minutes < 10) minutes = `0${minutes}`;

  return `${datePart} ${hours}:${minutes}`;
}

function parseDateTimeValue(value) {
  const [dateToken, timeToken] = String(value || '').split(' ');
  if (!dateToken || !timeToken) return new Date('');

  const [yearToken, monthToken, dayToken] = dateToken.split('-');
  const [hoursToken, minutesToken] = timeToken.split(':');

  const year = Number(yearToken);
  const month = Number(monthToken);
  const day = Number(dayToken);
  const hours = Number(hoursToken);
  const minutes = Number(minutesToken);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date('');
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return new Date('');
  }

  return new Date(year, month - 1, day, hours, minutes);
}

function buildMaskOptions(question, fieldTypeDefinition) {
  const maskPreset = question?.mask_preset || fieldTypeDefinition?.mask_preset;
  const customMask = question?.mask && typeof question.mask === 'object' ? question.mask : {};

  if (maskPreset === 'telefono') {
    return {
      mask: '00000000',
      lazy: false,
      overwrite: true,
      ...customMask,
    };
  }

  if (maskPreset === 'date-iso') {
    return {
      mask: Date,
      pattern: 'Y-`m-`d',
      blocks: {
        d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
        m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
        Y: { mask: IMask.MaskedRange, from: 1900, to: 2999 },
      },
      format: formatDateValue,
      parse: parseDateValue,
      autofix: true,
      overwrite: true,
      lazy: false,
      ...customMask,
    };
  }

  if (maskPreset === 'date-time-iso') {
    return {
      mask: Date,
      pattern: 'Y-`m-`d `H:`M',
      blocks: {
        d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2 },
        m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2 },
        Y: { mask: IMask.MaskedRange, from: 1900, to: 2999 },
        H: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2 },
        M: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
      },
      format: formatDateTimeValue,
      parse: parseDateTimeValue,
      autofix: true,
      overwrite: true,
      lazy: false,
      ...customMask,
    };
  }

  if (maskPreset === 'price') {
    return {
      mask: Number,
      scale: 2,
      signed: false,
      thousandsSeparator: ',',
      radix: '.',
      mapToRadix: ['.'],
      normalizeZeros: true,
      padFractionalZeros: false,
      lazy: false,
      ...customMask,
    };
  }

  return null;
}

function toFiniteNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSliderConfig(question) {
  const slider = question?.slider;
  if (!slider || typeof slider !== 'object') return null;

  const min = toFiniteNumber(slider.min);
  const max = toFiniteNumber(slider.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return null;
  }

  const step = toFiniteNumber(slider.step, 1);
  const marks = Array.isArray(slider.marks)
    ? slider.marks
      .map((mark) => {
        if (!mark || typeof mark !== 'object') return null;
        const value = toFiniteNumber(mark.value);
        if (!Number.isFinite(value) || value < min || value > max) return null;

        return {
          value,
          label: String(mark.label || '').trim() || String(value),
        };
      })
      .filter(Boolean)
    : [];

  return {
    min,
    max,
    step: step > 0 ? step : 1,
    prefix: typeof slider.prefix === 'string' ? slider.prefix : '$',
    unitSuffix: typeof slider.unitSuffix === 'string' ? slider.unitSuffix : '',
    showPlusAtMax: Boolean(slider.showPlusAtMax),
    confirmLabel: typeof slider.confirmLabel === 'string' ? slider.confirmLabel : '',
    marks,
  };
}

function getStepPrecision(step) {
  const [, decimalPart = ''] = String(step).split('.');
  return Math.min(4, decimalPart.length);
}

function formatSliderValue(value, sliderConfig) {
  const numericValue = toFiniteNumber(value, sliderConfig.min);
  const safeValue = Math.min(sliderConfig.max, Math.max(sliderConfig.min, numericValue));
  const decimals = getStepPrecision(sliderConfig.step);
  const formatted = safeValue.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const plusAtMax = sliderConfig.showPlusAtMax && safeValue >= sliderConfig.max ? '+' : '';
  return `${sliderConfig.prefix || ''}${formatted}${plusAtMax}${sliderConfig.unitSuffix || ''}`;
}

function buildDefaultValues(config) {
  const defaults = {};
  const steps = Array.isArray(config?.steps) ? config.steps : [];

  for (const step of steps) {
    if (!Array.isArray(step?.questions)) continue;

    for (const question of step.questions) {
      if (!question?.id) continue;

      const questionType = normalizeFieldType(question?.type);

      if (questionType === 'checkbox') {
        defaults[question.id] = [];
      } else if (questionType === 'price') {
        const sliderConfig = normalizeSliderConfig(question);
        defaults[question.id] = sliderConfig ? String(sliderConfig.min) : '';
      } else {
        defaults[question.id] = '';
      }
    }
  }

  return defaults;
}

function isQuestionVisible(question, values) {
  const rule = question?.visible_when;
  if (!rule || typeof rule !== 'object' || !rule.field) return true;

  const sourceValue = values?.[rule.field];

  if (rule.includes != null) {
    if (Array.isArray(sourceValue)) {
      return sourceValue.includes(rule.includes);
    }
    if (typeof sourceValue === 'string') {
      return sourceValue.includes(String(rule.includes));
    }
    return false;
  }

  if (rule.equals != null) {
    return sourceValue === rule.equals;
  }

  if (rule.notEquals != null) {
    return sourceValue !== rule.notEquals;
  }

  return true;
}

function sanitizeExternalUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function extractIframeSrc(embedCode) {
  if (typeof embedCode !== 'string') return '';
  const match = embedCode.match(/<iframe[^>]*src=["']([^"']+)["']/i);
  return match?.[1] || '';
}

function normalizeCompletionAction(rawAction) {
  if (!rawAction || typeof rawAction !== 'object') return null;

  const actionType = String(rawAction.type || '').trim().toLowerCase();

  if (actionType === 'redirect') {
    const targetUrl = sanitizeExternalUrl(rawAction.url || rawAction.redirect_url);
    if (!targetUrl) return null;

    const redirectParams = Array.isArray(rawAction.redirect_params)
      ? rawAction.redirect_params
      : (Array.isArray(rawAction.query_params) ? rawAction.query_params : []);

    const normalizedRedirectParams = redirectParams
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;

        const key = String(entry.key || entry.param || entry.name || '').trim();
        const sourceField = String(entry.source_field || entry.field || entry.from || '').trim();

        if (!key || !sourceField) return null;
        return { key, sourceField };
      })
      .filter(Boolean);

    return {
      type: 'redirect',
      url: targetUrl,
      buttonLabel: rawAction.button_label || rawAction.buttonLabel || 'Continuar',
      openInNewTab: rawAction.open_in_new_tab !== false,
      description: rawAction.description || '',
      redirectParams: normalizedRedirectParams,
    };
  }

  if (actionType === 'embed') {
    const embedUrl = sanitizeExternalUrl(
      rawAction.embed_url || rawAction.url || extractIframeSrc(rawAction.embed_code),
    );
    if (!embedUrl) return null;

    const preferredHeight = Number(rawAction.embed_height || rawAction.height);
    return {
      type: 'embed',
      url: embedUrl,
      title: rawAction.title || 'Agenda tu reunión',
      description: rawAction.description || '',
      height: Number.isFinite(preferredHeight) && preferredHeight >= 360 ? preferredHeight : 680,
    };
  }

  return null;
}

function pickIntroText(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function resolveIntroScreen(config) {
  const rawIntro = config?.intro_screen && typeof config.intro_screen === 'object'
    ? config.intro_screen
    : {};

  return {
    brandText: pickIntroText(rawIntro.brand_text, DEFAULT_INTRO_SCREEN_CONFIG.brand_text),
    subtitleText: pickIntroText(rawIntro.subtitle_text, DEFAULT_INTRO_SCREEN_CONFIG.subtitle_text),
    leadText: pickIntroText(rawIntro.lead_text, DEFAULT_INTRO_SCREEN_CONFIG.lead_text),
    supportPrefixText: pickIntroText(rawIntro.support_prefix_text, DEFAULT_INTRO_SCREEN_CONFIG.support_prefix_text),
    supportHighlightPrimaryText: pickIntroText(rawIntro.support_highlight_primary_text, DEFAULT_INTRO_SCREEN_CONFIG.support_highlight_primary_text),
    supportMiddleText: pickIntroText(rawIntro.support_middle_text, DEFAULT_INTRO_SCREEN_CONFIG.support_middle_text),
    supportHighlightSecondaryText: pickIntroText(rawIntro.support_highlight_secondary_text, DEFAULT_INTRO_SCREEN_CONFIG.support_highlight_secondary_text),
    supportSuffixText: pickIntroText(rawIntro.support_suffix_text, DEFAULT_INTRO_SCREEN_CONFIG.support_suffix_text),
    estimatedTimeText: pickIntroText(rawIntro.estimated_time_text, DEFAULT_INTRO_SCREEN_CONFIG.estimated_time_text),
    startButtonText: pickIntroText(rawIntro.start_button_text, DEFAULT_INTRO_SCREEN_CONFIG.start_button_text),
    loadingButtonText: pickIntroText(rawIntro.loading_button_text, DEFAULT_INTRO_SCREEN_CONFIG.loading_button_text),
  };
}

function resolveCompletionAction(config) {
  const configuredAction = normalizeCompletionAction(config?.completion_action);
  if (configuredAction) return configuredAction;

  const steps = Array.isArray(config?.steps) ? config.steps : [];
  const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
  return normalizeCompletionAction(lastStep);
}

function toRedirectParamValues(value) {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

function buildRedirectUrlWithDynamicParams(baseUrl, redirectParams, answers) {
  const safeBaseUrl = sanitizeExternalUrl(baseUrl);
  if (!safeBaseUrl) return '';

  if (!Array.isArray(redirectParams) || redirectParams.length === 0) {
    return safeBaseUrl;
  }

  try {
    const url = new URL(safeBaseUrl);

    for (const mapping of redirectParams) {
      const key = String(mapping?.key || '').trim();
      const sourceField = String(mapping?.sourceField || '').trim();
      if (!key || !sourceField) continue;

      url.searchParams.delete(key);

      const values = toRedirectParamValues(answers?.[sourceField]);
      if (values.length === 0) continue;
      values.forEach((value) => url.searchParams.append(key, value));
    }

    return url.toString();
  } catch {
    return safeBaseUrl;
  }
}

export {
  buildDefaultValues,
  buildFormEndpoint,
  buildMaskOptions,
  buildRedirectUrlWithDynamicParams,
  formatSliderValue,
  getFieldTypeDefinition,
  isQuestionVisible,
  normalizeFieldType,
  normalizeSliderConfig,
  resolveIntroScreen,
  resolveCompletionAction,
  resolvePlaceholder,
  toFiniteNumber,
};
