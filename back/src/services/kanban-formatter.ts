/**
 * Servicio para formatear datos de tareas al formato requerido por el frontend Kanban.
 * Centraliza toda la lógica de transformación para evitar duplicación en el frontend.
 */
import { ESTADOS_TAREA } from '../utils/constants';
import { mapearEstadoAColumnaId } from '../utils/tarea-helpers';

/**
 * Mapea estados del backend a estados formateados del frontend
 */
const mapearEstadoAFrontend = (estado: string): 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado' => {
  const estadoMap: Record<string, 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado'> = {
    [ESTADOS_TAREA.PENDIENTE]: 'Pendiente',
    [ESTADOS_TAREA.EN_PROGRESO]: 'En progreso',
    [ESTADOS_TAREA.EN_REVISION]: 'En revisión',
    [ESTADOS_TAREA.COMPLETADO]: 'Completado',
  };
  return estadoMap[estado] || 'Pendiente';
};

/**
 * Extrae las iniciales de un nombre completo
 */
function getInitials(name: string | null): string {
  if (!name || name === 'Sin asignar') return 'NA';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NA';
}

/**
 * Formatea una fecha para mostrar como fecha de vencimiento (día y mes)
 */
function formatDueDate(date: Date | string | null | undefined): string {
  if (!date) return 'Sin fecha';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  } catch {
    return 'Sin fecha';
  }
}

/**
 * Formatea una fecha completa (día, mes y año)
 */
function formatFullDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/**
 * Interfaz para una tarea formateada del Kanban
 */
export interface KanbanTaskItem {
  id: string;
  title: string;
  description: string;
  owner: string;
  avatar: string;
  due: string;
  status: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado';
  priority: 'Alta' | 'Media' | 'Baja';
  createdAt: string;
  updatedAt: string;
  assigneeId?: string;
  projectId: string;
  dueDate: string | null;
  createdById?: string;
  projectManagerId?: string;
  labels?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    size: number;
    url: string;
  }>;
}

/**
 * Formatea una tarea del backend al formato del frontend
 */
export function formatKanbanTask(tarea: any): KanbanTaskItem {
  const ownerName = tarea.asignado_a || 'Sin asignar';
  const initials = getInitials(ownerName);
  const dueDate = formatDueDate(tarea.fecha_limite);
  const createdAt = formatFullDate(tarea.createdAt);
  const updatedAt = formatFullDate(tarea.updatedAt);
  const estadoFrontend = mapearEstadoAFrontend(tarea.estado);

  return {
    id: tarea.id.toString(),
    title: tarea.titulo,
    description: tarea.descripcion || '',
    owner: ownerName,
    avatar: initials,
    due: dueDate,
    status: estadoFrontend,
    priority: tarea.prioridad as 'Alta' | 'Media' | 'Baja',
    createdAt,
    updatedAt,
    assigneeId: tarea.usuarioId?.toString(),
    projectId: tarea.proyectoId.toString(),
    dueDate: tarea.fecha_limite ? (typeof tarea.fecha_limite === 'string' ? tarea.fecha_limite : tarea.fecha_limite.toISOString()) : null,
    createdById: tarea.creadoPorId?.toString(),
    projectManagerId: tarea.proyecto?.gestorId?.toString(),
    labels: tarea.etiquetas?.map((et: any) => et.etiqueta?.nombre || et.nombre || et) || [],
    attachments: tarea.archivos?.map((archivo: any) => ({
      id: archivo.id.toString(),
      name: archivo.nombre,
      size: archivo.tamaño || 0,
      url: archivo.url,
    })) || [],
  };
}

/**
 * Formatea múltiples tareas y las agrupa por columna
 */
export function formatKanbanTasks(tareas: any[]): Record<string, KanbanTaskItem[]> {
  const resultado: Record<string, KanbanTaskItem[]> = {
    'pending': [],
    'in-progress': [],
    'review': [],
    'done': [],
  };

  for (const tarea of tareas) {
    const tareaFormateada = formatKanbanTask(tarea);
    const columnId = mapearEstadoAColumnaId(tarea.estado);
    
    if (resultado[columnId]) {
      resultado[columnId].push(tareaFormateada);
    }
  }

  return resultado;
}

