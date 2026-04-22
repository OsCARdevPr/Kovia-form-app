# Contexto IA - {{FORM_TITLE}}

## Objetivo del contexto
Este documento NO debe describir pregunta por pregunta.
Este documento SI debe explicar, con detalle tecnico, como construir y traducir un formulario dinamico a partir del JSON de configuracion.

Fuente de verdad unica:
- El bloque `FORM_CONFIG_JSON`.
- Todas las decisiones de render, validacion, visibilidad y submit salen de ese JSON.

## Metadatos
- form_id: {{FORM_ID}}
- template_id: {{TEMPLATE_ID}}
- template_name: {{TEMPLATE_NAME}}
- slug: {{FORM_SLUG}}
- estado: {{FORM_STATUS}}
- version_config: {{CONFIG_VERSION}}
- total_pasos: {{TOTAL_STEPS}}
- total_preguntas: {{TOTAL_QUESTIONS}}

## URLs y endpoints
- URL publica del formulario: {{PUBLIC_FORM_URL}}
- GET config: {{CONFIG_ENDPOINT}}
- POST submit: {{SUBMIT_ENDPOINT}}

## Contrato de respuesta API
- Exito: envelope con `status=success` y `data`.
- Error: envelope con `status=error`, `message`, `code` y `errors`.
- Error de validacion esperado:
```json
{
  "status": "error",
  "message": "No se pudo procesar la solicitud",
  "code": "VALIDATION_ERROR",
  "errors": {
    "missingFields": ["campo_requerido"],
    "fieldErrors": {
      "ticketPrice": ["Debe ser 500 o menos"]
    }
  }
}
```

## Algoritmo de construccion JSON -> Formulario
1. Obtener configuracion con `GET /api/forms/:slug`.
2. Tomar `config` como objeto principal; si falta, usar objeto vacio.
3. Resolver `intro_screen` para textos del header e intro (usar defaults si faltan claves).
4. Leer `steps` como arreglo; si no es arreglo, tratar como sin pasos.
5. Ordenar navegacion por `step.order` ascendente.
6. En cada paso, iterar `questions` en el orden declarado.
7. Para cada `question`, resolver tipo, placeholder, mascara, validacion y visibilidad.
8. Construir schema dinamico por paso usando `question.id` como llave.
9. Validar por paso antes de avanzar.
10. Al enviar, construir payload como `{"answers": {...}}` usando ids exactos.
11. Procesar pantalla final con `completion_action` (`redirect` o `embed`).
12. Si hay `redirect_params`, construir query params desde respuestas enviadas.
13. Mantener compatibilidad con aliases y claves legacy cuando existan.

## Estructura raiz esperada del JSON
Campos principales esperados en `config`:
- `version`
- `validation_engine`
- `field_type_index`
- `submission_policy`
- `completion_action`
- `intro_screen`
- `steps`

Regla de robustez:
- Si una clave no existe, aplicar defaults seguros sin romper render.
- Nunca renombrar ni regenerar IDs existentes.

## Traduccion de `intro_screen`
`intro_screen` define textos de la pantalla inicial (antes del paso 1).

Claves esperadas:
- `brand_text`
- `subtitle_text`
- `lead_text`
- `support_prefix_text`
- `support_highlight_primary_text`
- `support_middle_text`
- `support_highlight_secondary_text`
- `support_suffix_text`
- `estimated_time_text`
- `start_button_text`
- `loading_button_text`

Reglas:
- Si una clave viene vacia o no existe, usar fallback por defecto.
- `support_*` se renderiza como un solo parrafo con 2 segmentos destacados.
- `loading_button_text` se usa solo cuando el frontend esta cargando config.

## Traduccion de `field_type_index`
`field_type_index` define como interpretar cada `question.type`.

Claves comunes por tipo:
- `ui`: tipo de control visual (`input`, `textarea`, `radio-group`, `checkbox-group`, `select`, `masked-input`).
- `html_input_type`: tipo HTML para input (`text`, `email`, `tel`, etc.).
- `mask_preset`: preset de mascara (`telefono`, `date-iso`, `date-time-iso`, `price`).
- `validation_preset`: preset de validacion adicional.
- `default_placeholder`: placeholder por defecto si `question.placeholder` no existe.

## Traduccion de cada `question`
Campos base que siempre deben considerarse:
- `id`: llave unica y estable de respuesta.
- `type`: define control, parseo y validacion base.
- `label`: etiqueta visible.
- `placeholder`: texto de ayuda en controles de texto.
- `hint`: apoyo corto debajo o junto a etiqueta.
- `required`: obliga respuesta.
- `required_message`: mensaje cuando falta valor obligatorio.
- `options`: opciones para tipos seleccionables.
- `validation.z`: reglas dinamicas adicionales.
- `visible_when`: regla condicional de visibilidad.
- `mask` y `mask_preset`: reglas de mascara.
- `slider` (solo `price`): configuracion de rango y marcas.

## Matriz de traduccion por tipo
| type | Control recomendado | Valor esperado en respuestas | Reglas clave |
| --- | --- | --- | --- |
| text | input text | string | validar `required` y reglas `validation.z` |
| textarea | textarea | string | igual que text |
| email | input email | string | validacion de correo + reglas dinamicas |
| telefono | masked input tel | string | telefono de 8 digitos |
| radio | radio group | string | valor debe existir en `options` |
| checkbox | checkbox group | string[] | 0..n valores desde `options` |
| select | select | string | valor en `options` |
| date | masked input | string | formato `YYYY-MM-DD` |
| date-time | masked input | string | formato `YYYY-MM-DD HH:mm` |
| price | input/slider | string numerica parseable | reglas `minValue/maxValue` + limites de slider |

Aliases de tipo que deben aceptarse:
- `tel` y `phone` -> `telefono`
- `datetime` y `date_time` -> `date-time`

## Traduccion de `mask_preset`
Presets esperados:
- `telefono`: mascara de 8 digitos.
- `date-iso`: fecha `YYYY-MM-DD` valida.
- `date-time-iso`: fecha-hora `YYYY-MM-DD HH:mm` valida.
- `price`: numero decimal (soporta separadores para parseo).

Si existe `question.mask`, mezclar como override del preset.

## Traduccion de `slider` para `price`
Cuando `question.type=price` y existe `question.slider`, aplicar:
- `min`, `max`: rango valido (max debe ser mayor a min).
- `step`: incremento (si no valido, usar 1).
- `marks[]`: etiquetas visuales del rango.
- `prefix`: prefijo visual (ej. `$`).
- `unitSuffix`: sufijo visual (ej. ` USD`).
- `showPlusAtMax`: agregar `+` al valor maximo mostrado.
- `confirmLabel`: texto opcional de confirmacion.

Validacion adicional obligatoria en `price`:
- Rechazar montos no parseables.
- Respetar `minValue` y `maxValue` de `validation.z`.
- Si hay slider valido, reforzar limites por `slider.min` y `slider.max`.

## Traduccion de `visible_when`
`visible_when` controla si se muestra una pregunta.

Forma general:
- `field`: id de pregunta fuente.
- Operador soportado:
  - `equals`
  - `notEquals`
  - `includes`

Comportamiento:
- Si no hay `visible_when`, la pregunta es visible.
- Si la condicion no se cumple, la pregunta se oculta.

## Traduccion de `validation.z`
Reglas dinamicas soportadas en orden de aplicacion:
- `min`
- `max`
- `minItems`
- `maxItems`
- `regex` (con `pattern` y `flags` opcionales)
- `email`
- `minValue`
- `maxValue`
- `enum` (con `options`)

Notas:
- `required` se aplica ademas de `validation.z`.
- En `checkbox` requerido, exigir al menos 1 seleccion.
- En campos opcionales, permitir vacio (`''`, `null`, `undefined`) y normalizar.

## Traduccion de `submission_policy`
Claves esperadas:
- `enabled`
- `once_per_identifier`
- `identifier_strategy`
- `identifier_header`
- `allow_reactivation`

Objetivo:
- Controlar bloqueo por identificador para evitar envios duplicados.

## Traduccion de `completion_action`
Modo `redirect`:
- `url` o `redirect_url`: destino.
- `button_label`: texto del boton final.
- `open_in_new_tab`: abrir en nueva pestana.
- `description`: texto de apoyo.
- `redirect_params[]`: mapeo dinamico de query params.

Estructura de `redirect_params[]`:
- `key`: nombre del query param de salida.
- `source_field`: `question.id` de donde sale el valor.

Regla de resolucion de URL final:
- Tomar URL base valida.
- Por cada mapping, leer respuesta de `source_field`.
- Si hay valor, escribir query param `key` (soporta multiples valores en arreglos).
- Si no hay valor, no enviar ese query param.

Modo `embed`:
- `embed_url` o `url`: URL del iframe.
- `embed_height` o `height`: alto minimo recomendado 360.
- `title`: titulo del bloque.
- `description`: texto de apoyo.

Compatibilidad:
- Si no existe `completion_action` valido, se permite fallback legacy desde el ultimo step cuando aplique.

## Contrato de submit
Payload esperado:
```json
{
  "answers": {
    "question_id_1": "valor",
    "question_id_2": ["opcion_a", "opcion_b"]
  }
}
```

Reglas:
- Las llaves de `answers` deben ser exactamente los `question.id`.
- No traducir IDs ni labels al enviar.
- Mantener tipo de dato consistente por control.

## Criterios de calidad para IA
Al analizar o generar cambios sobre el formulario:
1. Priorizar fidelidad al contrato JSON.
2. Mantener compatibilidad backward con aliases y claves legacy.
3. No inventar campos fuera de contrato sin justificar.
4. No cambiar IDs existentes.
5. Si agrega reglas, explicar impacto en validacion y UX.

## Modo detallado con `mcp_sequential-th_sequentialthinking`
Cuando se requiera analisis profundo, usar modo secuencial cubriendo TODO el flujo `kovia-admin` + `kovia-api`.

Configuracion sugerida:
- `totalThoughts`: 14 a 20.
- `thoughtNumber`: incremental sin saltos.
- `nextThoughtNeeded`: `true` hasta cerrar hipotesis y validacion final.
- Usar revisiones (`isRevision`) cuando cambie una conclusion por nueva evidencia.

Cobertura minima por fases:
1. Inventario backend (`kovia-api`):
  - Rutas de auth: login, logout, me.
  - Rutas admin forms: list, create, update, validate-config, import/export, ai-context-markdown, archive-submissions, archive-webhooks, delete permanent.
  - Rutas admin submissions: list global, detail, reactivate.
  - Rutas admin webhooks: CRUD, logs, retry por log, relacion webhook-form.
2. Contrato de servicios backend:
  - Validacion de config (`validateFormConfig`).
  - Render de contexto IA (`getFormAiContextMarkdown`).
  - Politicas (`submission_policy`) y accion final (`completion_action`).
3. Inventario frontend admin (`kovia-admin`):
  - Clientes HTTP en `lib/admin/forms.js` y `lib/admin/webhooks.js`.
  - Parsing/validacion de respuestas (`schemas`).
  - Pantallas clave: builder, submissions, detail, webhooks, logs.
4. Traduccion JSON -> UI publica:
  - Tipos de campo, masks, slider, visible_when, validation.z.
  - Payload `answers` con ids exactos.
5. Consistencia end-to-end:
  - Cada accion de UI debe mapear a endpoint existente.
  - Verificar envelope de errores y mensajes de validacion consumibles.
6. Compatibilidad y migracion:
  - Mantener aliases legacy y claves antiguas soportadas.
  - Evitar breaking changes en IDs y contrato de respuesta.
7. Riesgos y pruebas:
  - Casos borde de validacion.
  - Reintentos de webhook log.
  - Flujo de archivado vs borrado permanente.
  - Redireccion dinamica con `redirect_params`.

Plantilla de salida esperada (obligatoria):
1. Hallazgos criticos (si existen).
2. Hallazgos medios/bajos.
3. Supuestos abiertos.
4. Plan de cambios por archivo.
5. Checklist de validacion (errores, build, pruebas funcionales).

Ejemplo de arranque de pensamiento:
```text
thoughtNumber=1
totalThoughts=16
thought="Mapear contratos forms/webhooks/submissions entre kovia-admin y kovia-api, listando endpoints consumidos y brechas de paridad."
nextThoughtNeeded=true
```

## Configuracion JSON actual
```json
{{FORM_CONFIG_JSON}}
```

## Prompt sugerido para IA
"Analiza el JSON del formulario {{FORM_TITLE}} (slug {{FORM_SLUG}}) y explica como construir el motor de render y validacion: intro_screen, traduccion de tipos, masks, slider, visible_when, validation.z, submit y completion_action. No describas pregunta por pregunta; describe reglas de implementacion reutilizables y compatibles con el contrato actual."

Generado: {{GENERATED_AT}}
