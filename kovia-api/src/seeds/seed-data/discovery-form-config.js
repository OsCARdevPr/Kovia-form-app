'use strict';

const discoveryTemplate = {
  name: 'Kovia Discovery',
  slug: 'kovia-forms',
  description: 'Template base del discovery form de Kovia',
};

const discoveryFormConfig = {
  version: 1,
  validation_engine: 'z-rules-v1',
  steps: [
    {
      order: 1,
      title: 'Datos del negocio',
      questions: [
        {
          id: 'negocio_nombre',
          type: 'text',
          label: 'Nombre del negocio',
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
          type: 'tel',
          label: 'WhatsApp de contacto',
          required: true,
          required_message: 'Ingresa un numero de WhatsApp valido',
          validation: {
            z: [
              { rule: 'min', value: 7, message: 'Ingresa un numero de WhatsApp valido' },
              { rule: 'regex', pattern: '^[+\\d\\s\\-()]{7,20}$', message: 'Formato invalido. Ej: +503 7777 1234' },
            ],
          },
        },
        {
          id: 'descripcion_negocio',
          type: 'textarea',
          label: 'A que se dedica el negocio?',
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
