'use strict';

const leadQualificationTemplate = {
  name: 'Lead Qualification',
  slug: 'lead-qualification',
  description: 'Template del formulario de calificación de leads tipo discovery.',
};

const leadQualificationForm = {
  title: 'Discovery Form v2.0',
  slug: 'lead-qualificator',
};

const leadQualificationFormConfig = {
  version: 1,
  validation_engine: 'z-rules-v1',
  field_type_index: {
    text: {
      ui: 'input',
      html_input_type: 'text',
    },
    radio: {
      ui: 'radio-group',
    },
    price: {
      ui: 'range',
      html_input_type: 'range',
      validation_preset: 'price',
      default_placeholder: '0.00',
    },
  },
  completion_action: {
    type: 'redirect',
    url: 'http://calcom.oscardev.software/team/kovia-studios/agendar-cita?embed=true',
    button_label: 'Agendar Reunion',
    open_in_new_tab: false,
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
      title: '¿Quien esta al mando del sistema?',
      short_label: 'Identidad',
      questions: [
        {
          id: 'name',
          type: 'text',
          label: 'Tu Nombre',
          placeholder: 'Tu Nombre',
          required: true,
          required_message: 'Tu nombre es obligatorio',
          validation: {
            z: [
              { rule: 'min', value: 2, message: 'Ingresa al menos 2 caracteres' },
              { rule: 'max', value: 120, message: 'Maximo 120 caracteres' },
            ],
          },
        },
        {
          id: 'company',
          type: 'text',
          label: 'Nombre de la Empresa',
          placeholder: 'Nombre de la Empresa',
          required: true,
          required_message: 'El nombre de la empresa es obligatorio',
          validation: {
            z: [
              { rule: 'min', value: 2, message: 'Ingresa al menos 2 caracteres' },
              { rule: 'max', value: 150, message: 'Maximo 150 caracteres' },
            ],
          },
        },
      ],
    },
    {
      order: 2,
      title: '¿A que sector pertenece tu empresa?',
      short_label: 'Industria',
      questions: [
        {
          id: 'industry',
          type: 'radio',
          label: 'Selecciona tu sector',
          required: true,
          required_message: 'Selecciona un sector',
          options: [
            'Venta de Productos (Repuestos, Ropa, Insumos)',
            'Servicios Profesionales (Clinicas, Consultoria, Agencias)',
            'Bienes Raices / Automotriz',
            'Distribucion / Mayoreo',
          ],
          validation: {
            z: [
              {
                rule: 'enum',
                options: [
                  'Venta de Productos (Repuestos, Ropa, Insumos)',
                  'Servicios Profesionales (Clinicas, Consultoria, Agencias)',
                  'Bienes Raices / Automotriz',
                  'Distribucion / Mayoreo',
                ],
                message: 'Selecciona una opcion valida',
              },
            ],
          },
        },
      ],
    },
    {
      order: 3,
      title: '¿Cuantas personas integran tu equipo actualmente?',
      short_label: 'Equipo',
      questions: [
        {
          id: 'teamSize',
          type: 'radio',
          label: 'Tamano de equipo',
          required: true,
          required_message: 'Selecciona una opcion',
          options: ['1 - 3', '4 - 10', '11 - 30', '+30'],
          validation: {
            z: [
              { rule: 'enum', options: ['1 - 3', '4 - 10', '11 - 30', '+30'], message: 'Selecciona una opcion valida' },
            ],
          },
        },
      ],
    },
    {
      order: 4,
      title: '¿Cuantas personas contestan mensajes y cierran ventas?',
      short_label: 'Agentes',
      questions: [
        {
          id: 'agents',
          type: 'radio',
          label: 'Cantidad de agentes',
          required: true,
          required_message: 'Selecciona una opcion',
          options: ['Solo yo (el dueño)', '1 a 2 agentes', '3 a 5 agentes', 'Mas de 5 agentes'],
          validation: {
            z: [
              {
                rule: 'enum',
                options: ['Solo yo (el dueño)', '1 a 2 agentes', '3 a 5 agentes', 'Mas de 5 agentes'],
                message: 'Selecciona una opcion valida',
              },
            ],
          },
        },
      ],
    },
    {
      order: 5,
      title: '¿Cuantos leads nuevos recibe tu equipo al dia?',
      short_label: 'Leads',
      questions: [
        {
          id: 'leadsPerDay',
          type: 'price',
          label: 'Volumen de Prospectos',
          required: true,
          required_message: 'Indica el volumen de leads diarios',
          slider: {
            min: 10,
            max: 500,
            step: 10,
            unitSuffix: 'DIARIOS',
            marks: [
              { value: 10, label: '10' },
              { value: 250, label: '250' },
              { value: 500, label: '500' },
            ],
            confirmLabel: 'Confirmar Volumen',
          },
          validation: {
            z: [
              { rule: 'minValue', value: 10, message: 'El valor minimo es 10' },
              { rule: 'maxValue', value: 500, message: 'El valor maximo es 500' },
            ],
          },
        },
      ],
    },
    {
      order: 6,
      title: '¿Cual es el ticket medio de venta?',
      short_label: 'Ticket',
      questions: [
        {
          id: 'ticketPrice',
          type: 'price',
          label: 'Ticket de Venta Promedio',
          required: true,
          required_message: 'Indica el ticket promedio',
          slider: {
            min: 10,
            max: 2000,
            step: 10,
            prefix: '$',
            unitSuffix: 'USD',
            showPlusAtMax: true,
            marks: [
              { value: 10, label: '$10' },
              { value: 1000, label: '$1,000' },
              { value: 2000, label: '$2,000+' },
            ],
            confirmLabel: 'Confirmar Ticket',
          },
          validation: {
            z: [
              { rule: 'minValue', value: 10, message: 'El valor minimo es 10' },
              { rule: 'maxValue', value: 2000, message: 'El valor maximo es 2000' },
            ],
          },
        },
      ],
    },
    {
      order: 7,
      title: '¿Que herramientas utilizan hoy para gestionar a sus clientes?',
      short_label: 'Herramientas',
      questions: [
        {
          id: 'tools',
          type: 'radio',
          label: 'Herramienta principal actual',
          required: true,
          required_message: 'Selecciona una opcion',
          options: [
            'WhatsApp normal / Business (en varios telefonos)',
            'Cuaderno o Excel',
            'Ya usamos un CRM pero nos quedo corto / no sabemos usarlo',
          ],
          validation: {
            z: [
              {
                rule: 'enum',
                options: [
                  'WhatsApp normal / Business (en varios telefonos)',
                  'Cuaderno o Excel',
                  'Ya usamos un CRM pero nos quedo corto / no sabemos usarlo',
                ],
                message: 'Selecciona una opcion valida',
              },
            ],
          },
        },
      ],
    },
  ],
};

module.exports = {
  leadQualificationTemplate,
  leadQualificationForm,
  leadQualificationFormConfig,
};
