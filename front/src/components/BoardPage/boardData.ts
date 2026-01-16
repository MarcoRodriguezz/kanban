import { BoardTaskItem } from './types';

export const BOARD_COLUMNS = [
  {
    id: 'pending',
    title: 'Pendiente',
    accent: 'border-amber-100 bg-white',
    headerAccent: 'bg-amber-500 text-white',
    headerTag: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'in-progress',
    title: 'En progreso',
    accent: 'border-blue-100 bg-white',
    headerAccent: 'bg-blue-500 text-white',
    headerTag: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'review',
    title: 'En revisión',
    accent: 'border-purple-100 bg-white',
    headerAccent: 'bg-purple-500 text-white',
    headerTag: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'done',
    title: 'Completado',
    accent: 'border-emerald-100 bg-white',
    headerAccent: 'bg-emerald-500 text-white',
    headerTag: 'bg-emerald-50 text-emerald-700',
  },
] as const;

export const BOARD_TASKS: Record<string, BoardTaskItem[]> = {
  pending: [
    {
      id: 'KB-301',
      title: 'Mapa de stakeholders',
      description: 'Identificar decisores y revisores clave para el go-live.',
      owner: 'María S.',
      avatar: 'MS',
      due: 'Sin fecha',
      status: 'Pendiente',
      priority: 'Media',
      createdAt: '02 Abr 2025',
      updatedAt: '05 Abr 2025',
    },
    {
      id: 'KB-305',
      title: 'Auditoría accesibilidad',
      description: 'Revisión AA para flujos críticos de tableros.',
      owner: 'Ana R.',
      avatar: 'AR',
      due: '18 Abr',
      status: 'Pendiente',
      priority: 'Alta',
      createdAt: '04 Abr 2025',
      updatedAt: '04 Abr 2025',
    },
  ],
  'in-progress': [
    {
      id: 'KB-298',
      title: 'Sincronización con calendario',
      description: 'Agregar exportación de tareas a Google Calendar.',
      owner: 'Carlos O.',
      avatar: 'CO',
      due: '12 Abr',
      status: 'En progreso',
      priority: 'Alta',
      createdAt: '30 Mar 2025',
      updatedAt: '08 Abr 2025',
    },
    {
      id: 'KB-303',
      title: 'Componentes de tablero',
      description: 'Refactorizar drag & drop y estados visuales.',
      owner: 'Daniel P.',
      avatar: 'DP',
      due: 'Hoy',
      status: 'En progreso',
      priority: 'Media',
      createdAt: '03 Abr 2025',
      updatedAt: '09 Abr 2025',
    },
  ],
  review: [
    {
      id: 'KB-287',
      title: 'Validación permisos avanzados',
      description: 'QA de roles jerárquicos y acceso a proyectos.',
      owner: 'María S.',
      avatar: 'MS',
      due: '11 Abr',
      status: 'En revisión',
      priority: 'Alta',
      createdAt: '28 Mar 2025',
      updatedAt: '08 Abr 2025',
    },
  ],
  done: [
    {
      id: 'KB-280',
      title: 'Template de retrospectivas',
      description: 'Diseñar modelo reutilizable para sesiones retro.',
      owner: 'Laura M.',
      avatar: 'LM',
      due: '08 Abr',
      status: 'Completado',
      priority: 'Media',
      createdAt: '20 Mar 2025',
      updatedAt: '08 Abr 2025',
    },
    {
      id: 'KB-282',
      title: 'Automatización de reportes',
      description: 'Enviar métricas semanales a stakeholders automáticamente.',
      owner: 'Carlos O.',
      avatar: 'CO',
      due: '09 Abr',
      status: 'Completado',
      priority: 'Alta',
      createdAt: '22 Mar 2025',
      updatedAt: '09 Abr 2025',
    },
  ],
};

export const BOARD_MEMBERS = [
  { id: 'ms', name: 'María Sánchez', display: 'María S.', initials: 'MS' },
  { id: 'ar', name: 'Ana Rodríguez', display: 'Ana R.', initials: 'AR' },
  { id: 'co', name: 'Carlos Ortega', display: 'Carlos O.', initials: 'CO' },
  { id: 'dp', name: 'Daniel Pérez', display: 'Daniel P.', initials: 'DP' },
  { id: 'lm', name: 'Laura Martínez', display: 'Laura M.', initials: 'LM' },
  { id: 'na', name: 'Sin asignar', display: 'Sin asignar', initials: 'NA' },
] as const;

export const PRIORITY_OPTIONS: BoardTaskItem['priority'][] = ['Alta', 'Media', 'Baja'];

export const PRIORITY_BADGE_STYLES: Record<BoardTaskItem['priority'], string> = {
  Alta: 'bg-rose-100 text-rose-700 border border-rose-200',
  Media: 'bg-amber-100 text-amber-700 border border-amber-200',
  Baja: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

export const STATUS_BADGE_STYLES: Record<BoardTaskItem['status'], string> = {
  Pendiente: 'bg-amber-100 text-amber-700',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-purple-100 text-purple-700',
  Completado: 'bg-emerald-100 text-emerald-700',
};

export const LABEL_PRESETS = [
  {
    id: 'disciplinas',
    title: 'Disciplinas',
    labels: ['Backend', 'Frontend', 'Diseño', 'Contenido', 'Producto', 'Automatización'],
  },
  {
    id: 'estatus',
    title: 'Estado operativo',
    labels: [
      'Pendiente de aprobación',
      'Esperando feedback',
      'En implementación',
      'Listo para producción',
      'Bloqueado por dependencia',
    ],
  },
  {
    id: 'areas',
    title: 'Áreas de trabajo',
    labels: ['Desarrollo', 'Diseño', 'Integración', 'Testing', 'Documentación', 'Propuesta', 'Marketing'],
  },
] as const;

