/**
 * Utilidades para formatear datos de tareas
 * 
 * NOTA: Las funciones de formateo de fechas (formatDueDate, formatFullDate) y 
 * extracción de iniciales (getInitials) ya están implementadas en el backend
 * (back/src/services/kanban-formatter.ts). El backend devuelve los datos ya formateados.
 * 
 * Estas funciones solo se mantienen para casos específicos de edición local en el frontend.
 */

/**
 * Extrae las iniciales de un nombre completo
 * 
 * NOTA: El backend ya calcula las iniciales y las devuelve en el campo 'avatar'.
 * Esta función solo se usa para calcular iniciales localmente cuando se edita una tarea
 * antes de guardarla (ej: al seleccionar un miembro del proyecto).
 */
export function getInitials(name: string): string {
  if (!name || name === 'Sin asignar') return 'NA';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NA';
}

/**
 * Normaliza una fecha a formato YYYY-MM-DD para comparación
 * 
 * Esta función es necesaria para comparar fechas antes de enviarlas al backend,
 * ya que el backend espera fechas en formato ISO (YYYY-MM-DD).
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // Solo la fecha (YYYY-MM-DD)
  } catch {
    return null;
  }
}

/**
 * Formatea bytes a formato legible
 * 
 * Esta función solo se usa para mostrar tamaños de archivos en la UI.
 * No está implementada en el backend porque es puramente de presentación.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}