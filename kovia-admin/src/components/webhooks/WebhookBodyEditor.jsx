import { useRef, useState } from 'react';
import { Input } from '@heroui/react';

export const SYSTEM_VARIABLES = [
  { token: 'submission.id',         label: 'ID de la respuesta',    group: 'sistema' },
  { token: 'form.id',               label: 'ID del formulario',     group: 'sistema' },
  { token: 'form.title',            label: 'Título del formulario', group: 'sistema' },
  { token: 'form.slug',             label: 'Slug del formulario',   group: 'sistema' },
  { token: 'template.name',         label: 'Nombre del template',   group: 'sistema' },
  { token: 'metadata.submitted_at', label: 'Fecha de envío',        group: 'sistema' },
  { token: 'metadata.ip',           label: 'IP del usuario',        group: 'sistema' },
  { token: 'metadata.user_agent',   label: 'User-Agent',            group: 'sistema' },
];

export function extractFormVariables(formConfig) {
  const formQuestions = [];

  if (!formConfig?.steps) return formQuestions;

  for (const step of formConfig.steps) {
    if (!step?.questions) continue;

    for (const q of step.questions) {
      if (!q?.id) continue;
      formQuestions.push({
        token: `answers.${q.id}`,
        label: q.label || q.id,
        group: 'campo',
      });
    }
  }

  return formQuestions;
}

/**
 * Editor de body template para webhooks.
 * Props:
 *   value      {string}   — contenido actual del textarea
 *   onChange   {function} — callback con nuevo valor
 *   formConfig {object}   — config del formulario para extraer las preguntas disponibles
 */
export default function WebhookBodyEditor({ value = '', onChange, formConfig }) {
  const textareaRef     = useRef(null);
  const [varSearch, setVarSearch] = useState('');

  const formQuestions = extractFormVariables(formConfig);

  // Filtrar por búsqueda
  const q = varSearch.toLowerCase().trim();
  const filteredSystem = q
    ? SYSTEM_VARIABLES.filter((v) => v.label.toLowerCase().includes(q) || v.token.toLowerCase().includes(q))
    : SYSTEM_VARIABLES;
  const filteredForm = q
    ? formQuestions.filter((v) => v.label.toLowerCase().includes(q) || v.token.toLowerCase().includes(q))
    : formQuestions;

  function insertAtCursor(token) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start  = textarea.selectionStart;
    const end    = textarea.selectionEnd;
    const insert = `{{${token}}}`;
    const newValue = (value || '').slice(0, start) + insert + (value || '').slice(end);

    onChange(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + insert.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  return (
    <div className="flex gap-4" style={{ minHeight: '420px' }}>

      {/* ── Textarea ── */}
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-40">Body template</p>
        <textarea
          ref={textareaRef}
          className="kovia-textarea kovia-textarea-lg flex-1 font-mono text-sm"
          placeholder={'{\n  "id": "{{submission.id}}",\n  "formulario": "{{form.title}}",\n  "respuesta": "{{answers.nombre}}"\n}'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          spellCheck={false}
          style={{ resize: 'vertical' }}
        />
        <p className="text-xs opacity-30">
          Click en una variable para insertarla al cursor. Sintaxis: <code className="font-mono opacity-70">{'{{token}}'}</code>
        </p>
      </div>

      {/* ── Panel de variables ── */}
      <div className="flex w-60 shrink-0 flex-col gap-2">
        {/* Barra de búsqueda */}
        <Input
          placeholder="Buscar variable..."
          size="sm"
          value={varSearch}
          variant="secondary"
          onChange={(e) => setVarSearch(e.target.value)}
        />

        {/* Lista scrolleable */}
        <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '480px', paddingRight: '2px' }}>

          {/* Sistema */}
          {filteredSystem.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest opacity-40">Sistema</p>
              <div className="flex flex-col gap-1">
                {filteredSystem.map(({ token, label }) => (
                  <VarChip key={token} token={token} label={label} onInsert={insertAtCursor} />
                ))}
              </div>
            </div>
          )}

          {/* Campos del formulario */}
          {formQuestions.length > 0 && filteredForm.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest opacity-40">Campos del form</p>
              <div className="flex flex-col gap-1">
                {filteredForm.map(({ token, label }) => (
                  <VarChip key={token} token={token} label={label} onInsert={insertAtCursor} accent />
                ))}
              </div>
            </div>
          )}

          {/* Sin resultados */}
          {q && filteredSystem.length === 0 && filteredForm.length === 0 && (
            <p className="text-center text-xs opacity-40 py-4">Sin coincidencias</p>
          )}

          {/* Sin formulario seleccionado */}
          {!formConfig && !q && (
            <p className="text-xs opacity-30 pt-1">
              Selecciona un formulario para ver sus campos aquí.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function VarChip({ token, label, onInsert, accent = false }) {
  return (
    <button
      type="button"
      title={`Insertar {{${token}}}`}
      onClick={() => onInsert(token)}
      className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-all hover:scale-[1.01] active:scale-95 ${
        accent
          ? 'border-primary/20 hover:bg-primary/8 hover:border-primary/40'
          : 'border-border/40 hover:bg-muted/40'
      }`}
    >
      <span className={`font-mono text-xs leading-tight ${accent ? 'text-primary' : 'opacity-70'}`}>
        {`{{${token}}}`}
      </span>
      <span className="text-xs leading-tight opacity-50">{label}</span>
    </button>
  );
}
