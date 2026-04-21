# Estandarizacion Kovia Admin y API

## Objetivo
Definir reglas unificadas de mensajes, feedback visual, estructura de formularios y contrato de errores entre frontend y backend para mejorar mantenibilidad y consistencia UX.

## Reglas de idioma
1. Todo texto visible al usuario debe estar en espanol.
2. No mezclar ingles y espanol en un mismo label, boton o descripcion.
3. Usar acentos correctos en mensajes de validacion y estado.

## Reglas de feedback
1. Los mensajes de exito y error deben mostrarse con Toast de HeroUI.
2. Alert se permite solo para feedback contextual dentro de un bloque o modal (ejemplo: resultado de validar JSON antes de importar).
3. Los errores de red o de backend deben mapearse a un mensaje amigable con fallback en espanol.

## Reglas de formularios
1. Los formularios de alta principal (crear registro) deben abrirse en modal.
2. Los formularios de edicion compleja pueden permanecer inline si forman parte de un flujo de constructor.
3. El boton Agregar debe ir en la esquina superior derecha del encabezado de seccion.

## Reglas de navegacion
1. Usar Breadcrumbs de HeroUI en rutas jerarquicas.
2. Patrón minimo:
   - Plantillas > Plantilla
   - Plantillas > Plantilla > Constructor

## Contrato de errores API
1. Envelope base:
   - status
   - message
   - data o errors
2. Error estandar:
   - status: "error"
   - message: string
   - code: string opcional
   - errors: object opcional
3. Para Zod/validacion:
   - HTTP 422
   - code: "VALIDATION_ERROR"
   - errors.fieldErrors: Record<string, string[]>
   - errors.formErrors: string[]

## Reglas de frontend para errores
1. Leer primero errors.fieldErrors y mostrar el primer mensaje util.
2. Si no hay fieldErrors, usar errors.formErrors[0].
3. Si tampoco existe, usar message y finalmente fallback local.

## Componentes reutilizables recomendados
1. SectionCardHeader para encabezados de seccion.
2. Utilidades de notificacion centralizadas en lib/ui.
3. Reusar estructuras de modal para altas en paginas de administracion.

## Contexto IA centralizado
1. Todos los markdown para IA de formularios deben vivir en una sola carpeta: `kovia-api/context/contexto-ia`.
2. Archivos base oficiales:
   - `kovia-api/context/contexto-ia/form-config-standard.md` (guia para importar/generar JSON).
   - `kovia-api/context/contexto-ia/form-ai-context-template.md` (plantilla para markdown dinamico por formulario).
3. El admin no debe hardcodear texto de estos documentos; debe pedirlos al backend.
4. Endpoints oficiales de referencia:
   - `GET /api/admin/forms/import-guidelines` para la guia de importacion.
   - `GET /api/admin/forms/:id/ai-context-markdown` para el markdown IA dinamico de un formulario.
5. Si se requiere cambiar el contexto IA, modificar solo los archivos en `contexto-ia`.

## Checklist rapido antes de merge
1. Build de kovia-admin y kovia-api sin errores.
2. Prueba manual de login, crear plantilla y crear formulario.
3. Verificacion de toasts para error y exito.
4. Verificacion de breadcrumbs en rutas jerarquicas.
5. Barrido de textos visibles en espanol.
