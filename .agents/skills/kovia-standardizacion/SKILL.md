---
name: kovia-standardizacion
description: Estandar para cambios en kovia-admin y kovia-api: idioma espanol, toasts HeroUI, modales de alta, breadcrumbs y contrato de errores compatible con Zod.
---

# Kovia Standardizacion

## Cuando usar esta skill
Usa esta skill cuando se modifiquen pantallas de administracion, controladores de API, validaciones o mensajes de error.

## Reglas obligatorias
1. Mensajes y labels en espanol.
2. Feedback principal con Toast de HeroUI para exito y error.
3. Formularios de alta principal en modal.
4. Breadcrumbs de HeroUI en rutas jerarquicas.
5. Boton Agregar en la esquina superior derecha del header de seccion.
6. Reusar SectionCardHeader para encabezados repetidos.

## Contrato backend recomendado
1. Mantener envelope actual.
2. Agregar code opcional para clasificar errores sin romper clientes.
3. En validaciones, usar code = VALIDATION_ERROR y estructura:
   - errors.fieldErrors
   - errors.formErrors

## Contrato frontend recomendado
1. Normalizar errores API en cliente HTTP con status, message, code y errors.
2. Extraer mensaje preferente desde fieldErrors/formErrors.
3. Mostrar notificacion centralizada con helpers de toast.

## Flujo sugerido de implementacion
1. Detectar strings en ingles y traducir.
2. Reemplazar Alert de exito/error por helpers de toast.
3. Mover altas inline a modales.
4. Agregar breadcrumbs donde exista jerarquia.
5. Ejecutar build y pruebas basicas de flujo.

## Criterios de aceptacion
1. Sin textos visibles en ingles en la funcionalidad modificada.
2. Errores de validacion backend legibles por frontend sin parsing manual ad hoc.
3. UI consistente con HeroUI y encabezados reutilizables.
