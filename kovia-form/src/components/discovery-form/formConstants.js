const API_URL = String(import.meta.env.PUBLIC_API_URL || '').trim();

const FORM_SUBMISSION_ID_SOURCE_FIELD = '__form_submission_id__';

const FIELD_TYPE_ALIASES = Object.freeze({
  tel: 'telefono',
  phone: 'telefono',
  datetime: 'date-time',
  date_time: 'date-time',
});

const BUILTIN_FIELD_TYPE_INDEX = Object.freeze({
  text: { html_input_type: 'text' },
  textarea: { html_input_type: 'text' },
  radio: { html_input_type: 'radio' },
  checkbox: { html_input_type: 'checkbox' },
  select: { html_input_type: 'select' },
  telefono: {
    html_input_type: 'tel',
    mask_preset: 'telefono',
    default_placeholder: '77771234',
  },
  email: {
    html_input_type: 'email',
  },
  date: {
    html_input_type: 'text',
    mask_preset: 'date-iso',
    default_placeholder: 'YYYY-MM-DD',
  },
  'date-time': {
    html_input_type: 'text',
    mask_preset: 'date-time-iso',
    default_placeholder: 'YYYY-MM-DD HH:mm',
  },
  price: {
    html_input_type: 'text',
    mask_preset: 'price',
    default_placeholder: '0.00',
  },
});

export {
  API_URL,
  FORM_SUBMISSION_ID_SOURCE_FIELD,
  FIELD_TYPE_ALIASES,
  BUILTIN_FIELD_TYPE_INDEX,
};
