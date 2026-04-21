# Kovia Form Config JSON Standard (v1)

This document defines the standard JSON contract for dynamic forms consumed by the API and frontend renderer.

## Goals

- Keep form configuration declarative and versioned.
- Centralize field capabilities in `field_type_index`.
- Enable future form builder/editor implementations with a predictable schema.
- Support input placeholders, mask presets, and validation presets.
- Standardize slider metadata for `price` questions.
- Configure final actions after submit (redirect button or embed).
- Control if a form can be submitted once per identifier and reactivated by admin.

## Root Shape

```json
{
  "version": 1,
  "validation_engine": "z-rules-v1",
  "field_type_index": {
    "text": { "ui": "input", "html_input_type": "text" },
    "textarea": { "ui": "textarea" },
    "radio": { "ui": "radio-group" },
    "checkbox": { "ui": "checkbox-group" },
    "select": { "ui": "select" },
    "telefono": {
      "ui": "masked-input",
      "html_input_type": "tel",
      "mask_preset": "telefono",
      "validation_preset": "telefono",
      "default_placeholder": "77771234"
    },
    "email": {
      "ui": "input",
      "html_input_type": "email",
      "validation_preset": "email",
      "default_placeholder": "nombre@empresa.com"
    },
    "date": {
      "ui": "masked-input",
      "html_input_type": "text",
      "mask_preset": "date-iso",
      "validation_preset": "date-iso",
      "default_placeholder": "YYYY-MM-DD"
    },
    "date-time": {
      "ui": "masked-input",
      "html_input_type": "text",
      "mask_preset": "date-time-iso",
      "validation_preset": "date-time-iso",
      "default_placeholder": "YYYY-MM-DD HH:mm"
    },
    "price": {
      "ui": "masked-input",
      "html_input_type": "text",
      "mask_preset": "price",
      "validation_preset": "price",
      "default_placeholder": "0.00"
    }
  },
  "completion_action": {
    "type": "redirect",
    "url": "https://kovia.com/gracias",
    "button_label": "Ir a mi agenda",
    "open_in_new_tab": true
  },
  "submission_policy": {
    "enabled": true,
    "once_per_identifier": true,
    "identifier_strategy": "ip_then_header",
    "identifier_header": "x-form-identifier",
    "allow_reactivation": true
  },
  "steps": []
}
```

## Submission Policy

`submission_policy` controls duplicate submit behavior per form.

```json
{
  "submission_policy": {
    "enabled": true,
    "once_per_identifier": true,
    "identifier_strategy": "ip_then_header",
    "identifier_header": "x-form-identifier",
    "allow_reactivation": true
  }
}
```

Supported keys:

- `enabled`: enables unique-submit lock for this form only.
- `once_per_identifier`: explicit flag for one submit per identifier.
- `identifier_strategy`: `ip` | `header` | `ip_then_header` | `header_then_ip`.
- `identifier_header`: header name used when strategy reads header identifiers.
- `allow_reactivation`: allows admin to unlock and permit a new submit.

Admin reactivation endpoint:

- `POST /api/admin/submissions/:id/reactivate`

Behavior:

- Lock is per form, not global.
- If the user already submitted that form, submit returns `409`.
- Reactivation unlocks the identifier only for that form.

## Completion Action

`completion_action` controls what appears at the final success screen after submit.

### Redirect Button

```json
{
  "completion_action": {
    "type": "redirect",
    "url": "https://kovia.com/next-step",
    "button_label": "Continuar",
    "open_in_new_tab": true,
    "description": "Haz clic para continuar al siguiente paso."
  }
}
```

### Embed (Cal.com, etc.)

```json
{
  "completion_action": {
    "type": "embed",
    "title": "Agenda tu reunión",
    "embed_url": "https://cal.com/tu-usuario/diagnostico?embed=true",
    "embed_height": 720,
    "description": "Selecciona fecha y hora para continuar."
  }
}
```

Supported keys:

- `type`: `redirect` | `embed`.
- `url` / `redirect_url`: destination URL for redirect mode.
- `button_label`: text for redirect button.
- `open_in_new_tab`: boolean, defaults to `true`.
- `embed_url` / `url`: iframe URL for embed mode.
- `embed_height` / `height`: iframe height in px (minimum 360).
- `title`: optional embed heading.
- `description`: optional helper text displayed on success step.

Compatibility note:

- Legacy final step objects with `type: "redirect"` or `type: "embed"` are still supported as fallback.

## Step Object

```json
{
  "order": 1,
  "title": "Datos del negocio",
  "short_label": "Negocio",
  "questions": []
}
```

- `order`: number, unique, used for navigation.
- `title`: visible title for end users.
- `short_label`: optional short title for progress bar.
- `questions`: ordered field definitions.

## Question Object

```json
{
  "id": "correo_contacto",
  "type": "email",
  "label": "Correo de contacto",
  "placeholder": "nombre@empresa.com",
  "hint": "Opcional",
  "required": false,
  "required_message": "Este campo es obligatorio",
  "options": [],
  "mask": {},
  "slider": {
    "min": 1,
    "max": 100,
    "step": 1,
    "prefix": "$",
    "unitSuffix": " USD",
    "showPlusAtMax": true,
    "confirmLabel": "Confirmar valor",
    "marks": [
      { "value": 1, "label": "1" },
      { "value": 50, "label": "50" },
      { "value": 100, "label": "100+" }
    ]
  },
  "validation": {
    "z": []
  },
  "visible_when": {
    "field": "canales_clientes",
    "includes": "Otro"
  }
}
```

### Required Properties

- `id`: unique field key in answers payload.
- `type`: field type key. Must exist in `field_type_index` or in built-in aliases.
- `label`: user-visible label.

### Optional Properties

- `placeholder`: text shown in `input`, `textarea`, `select`, and masked fields.
- `hint`: secondary label help text.
- `required`: boolean.
- `required_message`: custom message for required validation.
- `options`: required for `radio`, `checkbox`, `select`.
- `mask`: IMask options override for masked presets.
- `slider`: slider config for `price` only.
- `validation.z`: array of rule objects.
- `visible_when`: conditional visibility object.

## Supported Field Types

- `text`
- `textarea`
- `radio`
- `checkbox`
- `select`
- `telefono`
- `email`
- `date`
- `date-time`
- `price`

### Backward-Compatible Aliases

- `tel` -> `telefono`
- `phone` -> `telefono`
- `datetime` -> `date-time`
- `date_time` -> `date-time`

## Mask Presets

The frontend maps these to IMask configurations:

- `telefono`: local 8-digit phone pattern.
- `date-iso`: date format `YYYY-MM-DD`.
- `date-time-iso`: datetime format `YYYY-MM-DD HH:mm`.
- `price`: numeric/currency-style mask with decimals and thousands separator.

You can refine behavior using `question.mask`.

Example:

```json
{
  "id": "precio_lista",
  "type": "price",
  "label": "Precio de lista",
  "placeholder": "0.00",
  "mask": {
    "scale": 2,
    "radix": ".",
    "thousandsSeparator": ",",
    "min": 0,
    "max": 1000000
  },
  "validation": {
    "z": [
      { "rule": "minValue", "value": 0, "message": "No puede ser negativo" },
      { "rule": "maxValue", "value": 1000000, "message": "Supera el limite permitido" }
    ]
  }
}
```

## Price Slider (`question.slider`)

Use `question.slider` only when `type` is `price`.

```json
{
  "id": "ticketPrice",
  "type": "price",
  "label": "Ticket promedio",
  "required": true,
  "slider": {
    "min": 5,
    "max": 500,
    "step": 5,
    "prefix": "$",
    "unitSuffix": " USD",
    "showPlusAtMax": true,
    "confirmLabel": "Confirmar ticket promedio",
    "marks": [
      { "value": 5, "label": "$5" },
      { "value": 100, "label": "$100" },
      { "value": 500, "label": "$500+" }
    ]
  },
  "validation": {
    "z": [
      { "rule": "minValue", "value": 5, "message": "Debe ser al menos 5" },
      { "rule": "maxValue", "value": 500, "message": "Debe ser 500 o menos" }
    ]
  }
}
```

Supported `slider` keys:

- `min` (required): numeric lower bound.
- `max` (required): numeric upper bound. Must be greater than `min`.
- `step` (optional): positive numeric step.
- `prefix` (optional): visual prefix, for example `$`.
- `unitSuffix` (optional): visual suffix, for example ` USD`.
- `showPlusAtMax` (optional): if `true`, renderer can show `+` when current value reaches max.
- `confirmLabel` (optional): UX helper text for slider confirmation.
- `marks` (optional): labeled reference points array with `{ value, label }`.

Validation notes:

- `slider` is rejected for non-`price` question types.
- `slider.marks[].value` must be inside `[min, max]`.
- Backend applies slider min/max checks for `price` even when custom rules are not provided.

## Validation Rules (`validation.z`)

Supported rules:

- `min`
- `max`
- `minItems`
- `maxItems`
- `regex` (legacy/general rule)
- `email`
- `enum`
- `minValue`
- `maxValue`

Notes:

- Type presets (`telefono`, `email`, `date`, `date-time`, `price`) include built-in validation even without extra rules.
- `minValue`/`maxValue` are recommended for `price` fields.
- When `question.slider` is present in `price`, backend also enforces `slider.min` and `slider.max`.
- For `radio`, `checkbox`, and `select`, use `options` and optionally `enum` rules.

## Visibility Rules

```json
{
  "visible_when": {
    "field": "herramientas",
    "includes": "Otra"
  }
}
```

Supported operators:

- `includes`
- `equals`
- `notEquals`

## Builder/Editor Guidance

- Always render type pickers from `field_type_index`.
- Generate field options UI only for `radio`, `checkbox`, `select`.
- Show placeholder editor for text-like and masked inputs.
- Show mask override editor only when `mask_preset` exists.
- For `price`, include slider editor (`min`, `max`, `step`, `prefix`, `unitSuffix`, `confirmLabel`, `marks`).
- Provide a final action editor for `completion_action` with two modes: redirect and embed.
- Keep `id` immutable once responses exist in production.
- Store config versions and migration notes when introducing new presets.
