import type { BacklogActivityGroup, BacklogActionType, ActionFilter } from './types';

export const ACTION_LABELS: Record<BacklogActionType, string> = {
  'create-task': 'Creó tarea',
  'assign-task': 'Asignó tarea',
  'update-status': 'Cambió estado',
  comment: 'Comentó',
  'add-label': 'Añadió etiqueta',
  'edit-task': 'Editó tarea',
  'delete-task': 'Eliminó tarea',
};

export const ACTION_COLORS: Record<BacklogActionType, string> = {
  'create-task': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'assign-task': 'border-blue-200 bg-blue-50 text-blue-600',
  'update-status': 'border-purple-200 bg-purple-50 text-purple-600',
  comment: 'border-slate-200 bg-white text-slate-600',
  'add-label': 'border-amber-200 bg-amber-50 text-amber-600',
  'edit-task': 'border-sky-200 bg-sky-50 text-sky-600',
  'delete-task': 'border-red-200 bg-red-50 text-red-600',
};

export const BACKLOG_ACTIVITY: BacklogActivityGroup[] = [
  {
    date: '12 Abr 2025',
    entries: [
      {
        id: 'log-1801',
        timestamp: '12 Abr · 10:24',
        author: 'María Sánchez',
        actorInitials: 'MS',
        action: 'update-status',
        taskId: 'KB-305',
        taskTitle: 'Auditoría accesibilidad',
        from: 'Pendiente',
        to: 'En progreso',
        notes: 'Se inicia revisión de criterios AA.',
      },
      {
        id: 'log-1802',
        timestamp: '12 Abr · 09:10',
        author: 'Laura Méndez',
        actorInitials: 'LM',
        action: 'assign-task',
        taskId: 'KB-355',
        taskTitle: 'Preparar plan de lanzamiento',
        to: 'Carlos Ortega',
        notes: 'Se reasigna para reforzar coordinación con ventas.',
      },
      {
        id: 'log-1803',
        timestamp: '12 Abr · 08:55',
        author: 'Carlos Ortega',
        actorInitials: 'CO',
        action: 'comment',
        taskId: 'KB-298',
        taskTitle: 'Sincronización con calendario',
        notes: 'Se añadió comentario sobre validaciones pendientes con el equipo de seguridad.',
      },
    ],
  },
  {
    date: '11 Abr 2025',
    entries: [
      {
        id: 'log-1790',
        timestamp: '11 Abr · 16:40',
        author: 'Ana Rodríguez',
        actorInitials: 'AR',
        action: 'edit-task',
        taskId: 'KB-287',
        taskTitle: 'Validación permisos avanzados',
        notes: 'Actualiza checklist de QA y documentación de casos edge.',
      },
      {
        id: 'log-1789',
        timestamp: '11 Abr · 15:15',
        author: 'Daniel Pérez',
        actorInitials: 'DP',
        action: 'add-label',
        taskId: 'KB-303',
        taskTitle: 'Componentes de tablero',
        to: 'Alta prioridad',
        notes: 'Se agrega etiqueta para priorizar refactor de drag & drop.',
      },
      {
        id: 'log-1787',
        timestamp: '11 Abr · 09:30',
        author: 'María Sánchez',
        actorInitials: 'MS',
        action: 'create-task',
        taskId: 'KB-368',
        taskTitle: 'Migrar métricas a panel unificado',
        notes: 'Nueva necesidad detectada en retro. Incluye objetivos de adoptabilidad.',
      },
    ],
  },
  {
    date: '10 Abr 2025',
    entries: [
      {
        id: 'log-1779',
        timestamp: '10 Abr · 18:12',
        author: 'Carlos Ortega',
        actorInitials: 'CO',
        action: 'update-status',
        taskId: 'KB-282',
        taskTitle: 'Automatización de reportes',
        from: 'En progreso',
        to: 'Completado',
      },
      {
        id: 'log-1775',
        timestamp: '10 Abr · 14:50',
        author: 'María Sánchez',
        actorInitials: 'MS',
        action: 'assign-task',
        taskId: 'KB-301',
        taskTitle: 'Mapa de stakeholders',
        to: 'María Sánchez',
        notes: 'Toma responsabilidad directa de los workshops con stakeholders clave.',
      },
    ],
  },
];

export const ACTION_FILTERS: ActionFilter[] = [
  { id: 'all', label: 'Todos' },
  { id: 'create-task', label: 'Crear' },
  { id: 'assign-task', label: 'Asignar' },
  { id: 'update-status', label: 'Estados' },
  { id: 'add-label', label: 'Etiquetas' },
  { id: 'edit-task', label: 'Editar' },
  { id: 'delete-task', label: 'Eliminar' },
  { id: 'comment', label: 'Comentarios' },
];

