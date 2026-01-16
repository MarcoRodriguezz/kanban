import { BoardTaskItem } from '../types';
import { BOARD_COLUMNS } from '../boardData';
import { normalizeDate } from './taskFormatters';
import { BoardTask } from '../../../services/api';

/**
 * Mapea estados del frontend a estados del backend
 * 
 * NOTA: Esta función es necesaria porque el backend espera estados con guiones bajos
 * ('En_progreso', 'En_revision') mientras que el frontend usa espacios ('En progreso', 'En revisión').
 * El backend devuelve los estados ya mapeados al formato del frontend, pero cuando enviamos
 * datos al backend debemos convertir al formato que espera.
 */
function mapStatusToBackend(status: string): string {
  const estadoMap: Record<string, string> = {
    'Pendiente': 'Pendiente',
    'En progreso': 'En_progreso',
    'En revisión': 'En_revision',
    'Completado': 'Completado',
  };
  return estadoMap[status] || status;
}

/**
 * Resuelve el ID de columna basado en el estado de la tarea
 * 
 * NOTA: Aunque el backend ya agrupa las tareas por columnId, esta función es necesaria
 * para casos donde el frontend necesita determinar la columna localmente (ej: al crear
 * una nueva tarea antes de guardarla, o al determinar dónde mostrar una tarea actualizada).
 */
export function resolveColumnIdByStatus(status: BoardTaskItem['status']): string | null {
  const column = BOARD_COLUMNS.find((item) => item.title === status);
  return column?.id ?? null;
}

/**
 * Prepara los updates para guardar una tarea, solo incluyendo campos que cambiaron
 * 
 * Esta función compara el draft local con la tarea original y solo incluye
 * los campos que realmente cambiaron, optimizando las peticiones al backend.
 */
export function prepareTaskUpdates(
  taskDraft: BoardTaskItem,
  selectedTask: BoardTaskItem,
  projectId: string
): Partial<BoardTask> {
  const updates: Partial<BoardTask> = {};

  if (taskDraft.title !== selectedTask.title) {
    updates.title = taskDraft.title;
  }

  if (taskDraft.description !== selectedTask.description) {
    updates.description = taskDraft.description;
  }

  if (taskDraft.priority !== selectedTask.priority) {
    updates.priority = taskDraft.priority;
  }

  if (taskDraft.status !== selectedTask.status) {
    updates.status = mapStatusToBackend(taskDraft.status);
  }

  const currentProjectId = taskDraft.projectId || projectId;
  if (currentProjectId !== selectedTask.projectId) {
    updates.projectId = currentProjectId;
  }

  const currentDueDate = taskDraft.dueDate || null;
  const previousDueDate = selectedTask.dueDate || null;
  const normalizedCurrent = normalizeDate(currentDueDate);
  const normalizedPrevious = normalizeDate(previousDueDate);
  if (normalizedCurrent !== normalizedPrevious) {
    updates.dueDate = currentDueDate || undefined;
  }

  if (taskDraft.owner !== selectedTask.owner) {
    updates.asignado_a = taskDraft.owner;
  }

  return updates;
}

/**
 * Normaliza etiquetas para comparación
 * 
 * Esta función es necesaria porque las etiquetas pueden venir en diferentes formatos
 * (strings, objetos con propiedad 'nombre', etc.) y necesitamos normalizarlas para
 * comparar si cambiaron antes de enviarlas al backend.
 */
export function normalizeLabels(labels: any[]): string[] {
  if (!Array.isArray(labels)) {
    return [];
  }
  return labels
    .map(l => {
      if (typeof l === 'string') {
        return l.trim().toLowerCase();
      }
      if (l && typeof l === 'object' && l.nombre) {
        return String(l.nombre).trim().toLowerCase();
      }
      return String(l || '').trim().toLowerCase();
    })
    .filter(l => l !== '')
    .sort();
}

/**
 * Extrae el ID numérico real de un ID que puede ser "KB-303" o "303"
 * 
 * Esta función es necesaria porque el frontend puede mostrar IDs con prefijo "KB-"
 * pero el backend espera solo el número. Se usa al hacer peticiones al backend.
 */
export function getNumericTaskId(taskId: string): string {
  if (taskId.startsWith('KB-')) {
    return taskId.replace('KB-', '');
  }
  return taskId;
}