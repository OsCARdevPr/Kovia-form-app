'use strict';

const discoveryTemplate = {
  name: 'Kovia Discovery',
  slug: 'kovia-forms',
  description: 'Template base del discovery form de Kovia',
};

const discoveryFormConfig = {
  version: 1,
  validation_engine: 'z-rules-v1',
  field_type_index: {
    text: {
      ui: 'input',
      html_input_type: 'text',
    },
    textarea: {
      ui: 'textarea',
    },
    radio: {
      ui: 'radio-group',
    },
    checkbox: {
      ui: 'checkbox-group',
    },
    select: {
      ui: 'select',
    },
    telefono: {
      ui: 'masked-input',
      html_input_type: 'tel',
      mask_preset: 'telefono',
      default_placeholder: '77771234',
      validation_preset: 'telefono',
    },
    email: {
      ui: 'input',
      html_input_type: 'email',
      validation_preset: 'email',
      default_placeholder: 'nombre@empresa.com',
    },
    date: {
      ui: 'masked-input',
      html_input_type: 'text',
      mask_preset: 'date-iso',
      validation_preset: 'date-iso',
      default_placeholder: 'YYYY-MM-DD',
    },
    'date-time': {
      ui: 'masked-input',
      html_input_type: 'text',
      mask_preset: 'date-time-iso',
      validation_preset: 'date-time-iso',
      default_placeholder: 'YYYY-MM-DD HH:mm',
    },
    price: {
      ui: 'masked-input',
      html_input_type: 'text',
      mask_preset: 'price',
      validation_preset: 'price',
      default_placeholder: '0.00',
    },
  },
  completion_action: {
    type: 'embed',
    title: 'Agenda tu reunion',
    embed_url: 'http://calcom.oscardev.software/team/kovia-studios/agendar-cita?embed=true',
    embed_height: 720,
    description: 'Selecciona fecha y hora para continuar.',
    embed_code: `<!-- Cal inline embed code begins -->
<div style="width:100%;height:100%;overflow:scroll" id="my-cal-inline"></div>
<script type="text/javascript">
(function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; typeof namespace === "string" ? (cal.ns[namespace] = api) && p(api, ar) : p(cal, ar); return; } p(cal, ar); }; })(window, "http://calcom.oscardev.software/embed/embed.js", "init");
Cal("init", {origin:"http://calcom.oscardev.software"});

Cal("inline", {
  elementOrSelector:"#my-cal-inline",
  calLink: "team/kovia-studios/agendar-cita"
});

Cal("ui", {"styles":{"branding":{"brandColor":"#000000"}},"hideEventTypeDetails":false});
</script>
<!-- Cal inline embed code ends -->`,
  },
  submission_policy: {
    enabled: true,
    once_per_identifier: true,
    identifier_strategy: 'ip_then_header',
    identifier_header: 'x-form-identifier',
    allow_reactivation: true,
  },
  steps: [
    {
      order: 1,
      title: 'Datos del negocio',
      questions: [
        {
          id: 'negocio_nombre',
          type: 'text',
          label: 'Nombre del negocio',
          placeholder: 'Ej: Tienda El Sol',
          required: true,
          required_message: 'El nombre del negocio es obligatorio (min. 2 caracteres)',
          validation: {
            z: [
              { rule: 'min', value: 2, message: 'El nombre del negocio es obligatorio (min. 2 caracteres)' },
              { rule: 'max', value: 255, message: 'Maximo 255 caracteres' },
            ],
          },
        },
        {
          id: 'responsable_nombre',
          type: 'text',
          label: 'Nombre del responsable',
          placeholder: 'Ej: Ana Martinez',
          required: true,
          required_message: 'El nombre del responsable es obligatorio',
          validation: {
            z: [
              { rule: 'min', value: 2, message: 'El nombre del responsable es obligatorio' },
              { rule: 'max', value: 255, message: 'Maximo 255 caracteres' },
            ],
          },
        },
        {
          id: 'whatsapp',
          type: 'telefono',
          label: 'WhatsApp de contacto',
          placeholder: '7777-1234',
          required: true,
          required_message: 'Ingresa un numero de WhatsApp valido (8 digitos)',
          validation: {
            z: [
              { rule: 'min', value: 8, message: 'Ingresa un numero de WhatsApp valido (8 digitos)' },
            ],
          },
        },
        {
          id: 'correo_contacto',
          type: 'email',
          label: 'Correo de contacto',
          placeholder: 'nombre@empresa.com',
          required: false,
          validation: {
            z: [
              { rule: 'email', message: 'Ingresa un correo electronico valido' },
            ],
          },
        },
        {
          id: 'descripcion_negocio',
          type: 'textarea',
          label: 'A que se dedica el negocio?',
          placeholder: 'Describe brevemente que vendes y a que tipo de cliente',
          required: true,
          required_message: 'Describe brevemente tu negocio (min. 10 caracteres)',
          validation: {
            z: [
              { rule: 'min', value: 10, message: 'Describe brevemente tu negocio (min. 10 caracteres)' },
            ],
          },
        },
        {
          id: 'tiempo_operando',
          type: 'radio',
          label: 'Cuanto tiempo lleva operando?',
          required: true,
          options: ['Menos de 6 meses', '6 meses–1 año', '1–3 años', 'Más de 3 años'],
          validation: {
            z: [
              {
                rule: 'enum',
                options: ['Menos de 6 meses', '6 meses–1 año', '1–3 años', 'Más de 3 años'],
                message: 'Selecciona una opcion',
              },
            ],
          },
        },
      ],
    },
    {
      order: 2,
      title: 'Canales de adquisicion',
      questions: [
        {
          id: 'canales_clientes',
          type: 'checkbox',
          label: 'Que canales usas para conseguir clientes?',
          required: true,
          options: [
            'TikTok orgánico',
            'TikTok Live',
            'Meta Ads',
            'Instagram orgánico',
            'WhatsApp directo',
            'Referidos',
            'Marketplace',
            'Tienda física',
            'Otro',
          ],
          validation: {
            z: [
              { rule: 'minItems', value: 1, message: 'Selecciona al menos un canal' },
            ],
          },
        },
        {
          id: 'canales_clientes_otro',
          type: 'text',
          label: 'Cual otro canal?',
          placeholder: 'Ej: Ferias locales',
          required: false,
          visible_when: {
            field: 'canales_clientes',
            includes: 'Otro',
          },
          validation: {
            z: [
              { rule: 'max', value: 120, message: 'Maximo 120 caracteres' },
            ],
          },
        },
        {
          id: 'canal_principal',
          type: 'text',
          label: 'Cual es tu canal principal?',
          placeholder: 'Ej: Instagram organico',
          required: true,
          validation: {
            z: [
              { rule: 'min', value: 1, message: 'Indica tu canal principal' },
            ],
          },
        },
        {
          id: 'accion_cliente',
          type: 'textarea',
          label: 'Que hace el cliente cuando ve tu contenido?',
          placeholder: 'Ej: Escribe por WhatsApp para consultar precio y disponibilidad',
          required: true,
          validation: {
            z: [
              { rule: 'min', value: 5, message: 'Describe la primera accion del cliente' },
            ],
          },
        },
        {
          id: 'leads_semana',
          type: 'radio',
          label: 'Cuantos leads recibes por semana?',
          required: true,
          options: ['1–10', '10–30', '30–80', '80–200', '+200'],
          validation: {
            z: [
              { rule: 'enum', options: ['1–10', '10–30', '30–80', '80–200', '+200'], message: 'Selecciona un rango' },
            ],
          },
        },
        {
          id: 'momento_leads',
          type: 'textarea',
          label: 'En que momento llegan mas leads?',
          placeholder: 'Ej: Entre 7:00 pm y 10:00 pm despues de publicar en TikTok',
          required: false,
          validation: {
            z: [
              { rule: 'max', value: 1000, message: 'Maximo 1000 caracteres' },
            ],
          },
        },
      ],
    },
    {
      order: 3,
      title: 'Atencion y cierre',
      questions: [
        {
          id: 'quien_atiende',
          type: 'radio',
          label: 'Quien atiende los mensajes?',
          required: true,
          options: ['Solo el dueño', 'Un empleado', 'Equipo de ventas', 'Bot'],
          validation: {
            z: [
              { rule: 'enum', options: ['Solo el dueño', 'Un empleado', 'Equipo de ventas', 'Bot'], message: 'Selecciona una opcion' },
            ],
          },
        },
        {
          id: 'como_cierran',
          type: 'checkbox',
          label: 'Como se comunican para cerrar la venta?',
          required: true,
          options: ['Texto', 'Audios', 'Llamada', 'Videollamada', 'Email'],
          validation: {
            z: [
              { rule: 'minItems', value: 1, message: 'Selecciona al menos una opcion' },
            ],
          },
        },
        {
          id: 'mensajes_compra',
          type: 'radio',
          label: 'Cuantos mensajes antes de que el cliente compre?',
          required: true,
          options: ['1–3', '4–7', '8–15', '+15'],
          validation: {
            z: [
              { rule: 'enum', options: ['1–3', '4–7', '8–15', '+15'], message: 'Selecciona un rango' },
            ],
          },
        },
        {
          id: 'tiempo_cierre',
          type: 'radio',
          label: 'Cuanto tarda el proceso de cierre?',
          required: true,
          options: ['Minutos', '1–2 hrs', 'Mismo día', '1–3 días', '+3 días'],
          validation: {
            z: [
              {
                rule: 'enum',
                options: ['Minutos', '1–2 hrs', 'Mismo día', '1–3 días', '+3 días'],
                message: 'Selecciona una opcion',
              },
            ],
          },
        },
        {
          id: 'catalogo',
          type: 'checkbox',
          label: 'Existe catalogo o material que se envia al lead?',
          required: true,
          options: ['PDF', 'Link', 'Imagen', 'No, se explica en chat'],
          validation: {
            z: [
              { rule: 'minItems', value: 1, message: 'Selecciona al menos una opcion' },
            ],
          },
        },
        {
          id: 'envio_material',
          type: 'radio',
          label: 'Como se envia ese material?',
          required: false,
          options: ['Manual cada vez', 'Respuesta guardada en WA', 'Bot automático'],
          validation: {
            z: [
              {
                rule: 'enum',
                options: ['Manual cada vez', 'Respuesta guardada en WA', 'Bot automático'],
                message: 'Selecciona una opcion valida',
              },
            ],
          },
        },
        {
          id: 'seguimiento_lead',
          type: 'textarea',
          label: 'Que pasa cuando un lead no responde?',
          placeholder: 'Ej: Enviamos 2 recordatorios y luego cerramos la oportunidad',
          required: false,
          validation: {
            z: [
              { rule: 'max', value: 1000, message: 'Maximo 1000 caracteres' },
            ],
          },
        },
      ],
    },
    {
      order: 4,
      title: 'Logistica y datos de envio',
      questions: [
        {
          id: 'recoleccion_datos',
          type: 'radio',
          label: 'Como recolectas los datos de envio del cliente?',
          required: true,
          options: [
            'Por chat uno a uno',
            'Formulario externo',
            'Formulario de la plataforma',
            'El cliente escribe libremente',
            'Por mensaje, el cliente envía todos los datos juntos',
          ],
          validation: {
            z: [
              {
                rule: 'enum',
                options: [
                  'Por chat uno a uno',
                  'Formulario externo',
                  'Formulario de la plataforma',
                  'El cliente escribe libremente',
                  'Por mensaje, el cliente envía todos los datos juntos',
                ],
                message: 'Selecciona una opcion',
              },
            ],
          },
        },
        {
          id: 'tiempo_recoleccion',
          type: 'radio',
          label: 'Cuanto tiempo te toma recolectar esos datos?',
          required: false,
          options: ['-2 min', '2–5 min', '5–10 min', '+10 min'],
          validation: {
            z: [
              { rule: 'enum', options: ['-2 min', '2–5 min', '5–10 min', '+10 min'], message: 'Selecciona una opcion valida' },
            ],
          },
        },
        {
          id: 'empresa_logistica',
          type: 'text',
          label: 'Con que empresa de logistica trabajas?',
          placeholder: 'Ej: Cargo Expreso',
          required: true,
          validation: {
            z: [
              { rule: 'min', value: 1, message: 'Indica tu empresa de logistica' },
            ],
          },
        },
        {
          id: 'creacion_guia',
          type: 'radio',
          label: 'Como creas la guia de envio?',
          required: false,
          options: ['Portal manual', 'La empresa la genera', 'Integrado automático', 'Otro'],
          validation: {
            z: [
              {
                rule: 'enum',
                options: ['Portal manual', 'La empresa la genera', 'Integrado automático', 'Otro'],
                message: 'Selecciona una opcion valida',
              },
            ],
          },
        },
        {
          id: 'tiempo_guia',
          type: 'radio',
          label: 'Cuanto tardas en crear una guia?',
          required: false,
          options: ['-2 min', '2–5 min', '5–10 min', '+10 min'],
          validation: {
            z: [
              { rule: 'enum', options: ['-2 min', '2–5 min', '5–10 min', '+10 min'], message: 'Selecciona una opcion valida' },
            ],
          },
        },
      ],
    },
    {
      order: 5,
      title: 'Sistemas y herramientas',
      questions: [
        {
          id: 'herramientas',
          type: 'checkbox',
          label: 'Que herramientas usan actualmente?',
          required: true,
          options: [
            'WhatsApp Business',
            'Excel / Sheets',
            'Treinta',
            'WooCommerce',
            'Shopify',
            'CRM',
            'Notion',
            'Drive',
            'Nada formal',
            'Otra',
          ],
          validation: {
            z: [
              { rule: 'minItems', value: 1, message: 'Selecciona al menos una herramienta' },
            ],
          },
        },
        {
          id: 'herramientas_otro',
          type: 'text',
          label: 'Cual otra herramienta?',
          placeholder: 'Ej: HubSpot',
          required: false,
          visible_when: {
            field: 'herramientas',
            includes: 'Otra',
          },
          validation: {
            z: [
              { rule: 'max', value: 120, message: 'Maximo 120 caracteres' },
            ],
          },
        },
        {
          id: 'sistemas_pedido',
          type: 'radio',
          label: 'Cuantos sistemas tocas para procesar un pedido?',
          required: true,
          options: ['1', '2', '3', '4+'],
          validation: {
            z: [
              { rule: 'enum', options: ['1', '2', '3', '4+'], message: 'Selecciona una opcion' },
            ],
          },
        },
        {
          id: 'seguimiento_pedidos',
          type: 'textarea',
          label: 'Como registras y haces seguimiento de los pedidos?',
          placeholder: 'Ej: Registramos en Google Sheets y actualizamos estado manualmente',
          required: false,
          validation: {
            z: [
              { rule: 'max', value: 1000, message: 'Maximo 1000 caracteres' },
            ],
          },
        },
      ],
    },
    {
      order: 6,
      title: 'Cobro y post-venta',
      questions: [
        {
          id: 'como_cobras',
          type: 'checkbox',
          label: 'Como cobras actualmente?',
          required: true,
          options: ['Contra entrega', 'Transferencia', 'Pago anticipado', 'Link de pago', 'Tarjeta'],
          validation: {
            z: [
              { rule: 'minItems', value: 1, message: 'Selecciona al menos una forma de cobro' },
            ],
          },
        },
        {
          id: 'confirmacion_pago',
          type: 'textarea',
          label: 'Como confirmas que un pedido fue pagado o liquidado?',
          placeholder: 'Ej: Validamos comprobante y marcamos estado pagado en la hoja de control',
          required: true,
          validation: {
            z: [
              { rule: 'min', value: 5, message: 'Describe como confirmas los pagos' },
            ],
          },
        },
        {
          id: 'devolucion',
          type: 'textarea',
          label: 'Que pasa cuando un pedido es devuelto?',
          placeholder: 'Ej: Se contacta al cliente, se coordina reenvio y se registra incidencia',
          required: false,
          validation: {
            z: [
              { rule: 'max', value: 1000, message: 'Maximo 1000 caracteres' },
            ],
          },
        },
        {
          id: 'tasa_conversion',
          type: 'radio',
          label: 'Mides tu tasa de conversion?',
          required: true,
          options: ['Sí formalmente', 'A veces', 'No'],
          validation: {
            z: [
              { rule: 'enum', options: ['Sí formalmente', 'A veces', 'No'], message: 'Selecciona una opcion' },
            ],
          },
        },
      ],
    },
    {
      order: 7,
      title: 'Contexto de mejora',
      questions: [
        {
          id: 'paso_mas_tiempo',
          type: 'textarea',
          label: 'Cual es el paso que mas tiempo te quita hoy?',
          placeholder: 'Ej: Confirmar datos de envio en chat uno por uno',
          required: true,
          validation: {
            z: [
              { rule: 'min', value: 5, message: 'Comparte que paso te quita mas tiempo' },
            ],
          },
        },
        {
          id: 'pierdes_ventas',
          type: 'textarea',
          label: 'En que momento sientes que pierdes mas ventas?',
          placeholder: 'Ej: Cuando el cliente deja de responder despues de preguntar precio',
          required: true,
          validation: {
            z: [
              { rule: 'min', value: 5, message: 'Cuentanos donde sientes que pierdes ventas' },
            ],
          },
        },
        {
          id: 'intento_mejorar',
          type: 'textarea',
          label: 'Hay algo que ya intentaste mejorar y no funciono?',
          placeholder: 'Ej: Probamos respuestas rapidas, pero no mejoro la conversion',
          required: false,
          validation: {
            z: [
              { rule: 'max', value: 1000, message: 'Maximo 1000 caracteres' },
            ],
          },
        },
        {
          id: 'algo_agregar',
          type: 'textarea',
          label: 'Algo que agregar que no te hayamos preguntado?',
          placeholder: 'Comparte cualquier contexto adicional que ayude a entender tu proceso',
          required: false,
          validation: {
            z: [
              { rule: 'max', value: 1000, message: 'Maximo 1000 caracteres' },
            ],
          },
        },
      ],
    },
  ],
};

module.exports = {
  discoveryTemplate,
  discoveryFormConfig,
};
