# Guia de Componente Adaptable estilo LeadQualificator

## Objetivo
Definir como construir un componente de formulario reusable por codigo (copy/paste), sin depender de iframe ni embed, manteniendo la esencia visual y de experiencia de LeadQualificationForm y permitiendo adaptar cualquier estilo.

## Esencia visual que se debe conservar
1. Base oscura con efecto vidrio (glass) y alto contraste.
2. Acento rojo de marca para progreso, foco y CTA principal.
3. Titulares fuertes en mayusculas y tono "protocolo/discovery".
4. Flujo por pasos con transiciones suaves entre preguntas.
5. Sensacion premium: sombras, borde suave, blur y microdetalle.

## Lo que si se puede adaptar
1. Ancho del contenedor (`max-width`) segun la pagina host.
2. Espaciados verticales para desktop o mobile.
3. Tipografia secundaria siempre que mantenga personalidad de marca.
4. Colores, radios, sombras y animaciones via tokens de tema.
5. Modo de apertura: inline o modal.

## Requerimientos funcionales minimos
1. Debe soportar flujo multi-step con barra de progreso.
2. Debe permitir evaluacion de calificacion al final del flujo.
3. Si califica: redirigir o abrir agenda (segun configuracion).
4. Si no califica: mostrar paso final con mensaje y CTA alterno.
5. Debe permitir `onClose` cuando se use como modal.
6. Debe exponer eventos para analitica.

## Arquitectura recomendada (adaptable)
Separar logica y UI para que puedas copiar el codigo y estilizarlo como quieras:

1. `useLeadQualificationFlow` (hook): maneja estado, pasos, validaciones y resultado.
2. `LeadQualificationBase` (componente): renderiza UI usando datos del hook.
3. `LeadQualificationTheme` (opcional): mapea tokens visuales para cada marca/sitio.

## API recomendada del hook
```tsx
export interface UseLeadQualificationFlowProps {
  agendarUrl: string;
  onQualified?: (payload: LeadAnswers) => void;
  onNotQualified?: (payload: LeadAnswers) => void;
}

export interface LeadAnswers {
  name: string;
  company: string;
  industry: string;
  teamSize: string;
  agents: string;
  leadsPerDay: number;
  ticketPrice: number;
  tools: string;
}

export interface LeadQualificationFlow {
  step: number;
  totalSteps: number;
  formData: LeadAnswers;
  isStepValid: boolean;
  isCompleted: boolean;
  setField: (field: keyof LeadAnswers, value: string | number) => void;
  goNext: () => void;
  goPrev: () => void;
  submit: () => void;
}
```

## Contrato de resultado recomendado
```ts
export type QualificationResult = {
  qualified: boolean;
  score: number;
  reasons: string[];
  answers: LeadAnswers;
};
```

## Tokens de estilo sugeridos (base)
```css
:root {
  --lq-bg: #050505;
  --lq-surface: rgba(255, 255, 255, 0.05);
  --lq-border: rgba(177, 43, 36, 0.3);
  --lq-accent: #b12b24;
  --lq-text: #ffffff;
  --lq-text-soft: #94a3b8;
  --lq-radius: 2.5rem;
  --lq-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}
```

## Reglas UX del componente
1. Mobile-first: no romper en pantallas de 320px.
2. CTA principal siempre visible en cada paso que requiera confirmacion.
3. Estados de foco visibles para accesibilidad.
4. Animaciones cortas (180ms-280ms) y no invasivas.
5. Mantener consistencia de copy en espanol.

## Ejemplo de uso en React (copiar y adaptar)
```tsx
import { useLeadQualificationFlow } from '@/components/lead-qualification/useLeadQualificationFlow';

export function LeadQualificationCustomCard() {
  const flow = useLeadQualificationFlow({
    agendarUrl: 'https://cal.com/tu-usuario/diagnostico?embed=true',
    onQualified: (payload) => console.log('qualified', payload),
    onNotQualified: (payload) => console.log('not qualified', payload),
  });

  return (
    <article className="rounded-3xl p-6 border border-red-700/40 bg-zinc-950 text-white">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-red-400">Discovery Form</p>
        <h3 className="text-2xl font-black uppercase">Paso {flow.step + 1} de {flow.totalSteps}</h3>
      </header>

      {/* Render de campos por paso. */}

      <footer className="mt-8 flex items-center justify-between">
        <button onClick={flow.goPrev} disabled={flow.step === 0}>Volver</button>
        <button onClick={flow.goNext} disabled={!flow.isStepValid}>Continuar</button>
      </footer>
    </article>
  );
}
```

## Logica base sugerida para calificacion
Mantener la logica en una funcion pura para que sea reutilizable y testeable:

```ts
export function checkQualification(data: LeadAnswers): QualificationResult {
  const leadsNum = Number(data.leadsPerDay || 0);
  const ticketNum = Number(data.ticketPrice || 0);

  const criteria = [
    ['Bienes Raices / Automotriz', 'Distribucion / Mayoreo'].includes(data.industry),
    ['4 - 10', '11 - 30', '+30'].includes(data.teamSize),
    ['3 a 5 agentes', 'Mas de 5 agentes'].includes(data.agents),
    leadsNum >= 60,
    ticketNum >= 500,
    ['WhatsApp normal / Business (en varios telefonos)', 'Cuaderno o Excel'].includes(data.tools),
  ];

  const score = criteria.filter(Boolean).length;
  return {
    qualified: score >= 1,
    score,
    reasons: criteria.map((ok, i) => (ok ? `criteria_${i + 1}` : '')).filter(Boolean),
    answers: data,
  };
}
```

## Integracion en Astro (sin embed)
```astro
---
import LeadQualificationCustomCard from '../components/LeadQualificationCustomCard.jsx';
---

<section class="py-16">
  <LeadQualificationCustomCard client:visible />
</section>
```

## Alineacion con estandar del API
Aunque este enfoque evita iframe/embed para render del formulario, se mantiene compatibilidad con `completion_action` para definir el paso final (redirect o embed) segun necesidad de negocio.

## Estructura de implementacion sugerida
1. `kovia-form/src/components/lead-qualification/useLeadQualificationFlow.js`
2. `kovia-form/src/components/lead-qualification/checkQualification.js`
3. `kovia-form/src/components/lead-qualification/LeadQualificationBase.jsx`
4. `kovia-form/src/styles/lead-qualification-base.css`

## Checklist de done
1. Se mantiene identidad visual del LeadQualificationForm.
2. El componente funciona inline y modal.
3. El codigo se puede copiar y adaptar sin romper la logica.
4. Flujo responsive validado en mobile y desktop.
5. Eventos de analitica conectados (step_view, step_submit, qualification_result).
6. Mensajes y labels en espanol.
