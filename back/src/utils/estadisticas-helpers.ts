/**
 * Helpers para consultas y formateo de estadísticas.
 * Centraliza la lógica de consultas estadísticas para evitar repetición de código.
 */
import { prisma } from './prisma';
import { TIME_CONSTANTS } from './constants';
import { parseId } from './validation';

/**
 * Construye el filtro WHERE para consultas de tareas según proyectoId y usuarioId
 */
export const construirFiltroTareas = (
  proyectoId?: string | number,
  usuarioId?: string | number
): any => {
  const where: any = {};

  if (proyectoId) {
    const proyectoIdParsed = parseId(String(proyectoId));
    if (proyectoIdParsed) {
      where.proyectoId = proyectoIdParsed;
    }
  }

  if (usuarioId) {
    const usuarioIdParsed = parseId(String(usuarioId));
    if (usuarioIdParsed) {
      where.usuarioId = usuarioIdParsed;
    }
  }

  return where;
};

/**
 * Obtiene estadísticas de tareas por estado
 */
export const obtenerTareasPorEstado = async (where: any) => {
  return prisma.tarea.groupBy({
    by: ['estado'],
    where,
    _count: { estado: true },
  });
};

/**
 * Obtiene estadísticas de tareas por prioridad
 */
export const obtenerTareasPorPrioridad = async (where: any) => {
  return prisma.tarea.groupBy({
    by: ['prioridad'],
    where,
    _count: { prioridad: true },
  });
};

/**
 * Formatea estadísticas por estado en un objeto con valores por defecto
 */
export const formatearEstadisticasPorEstado = (
  tareasPorEstado: Array<{ estado: string; _count: { estado: number } }>
) => {
  const estadoMap = new Map(
    tareasPorEstado.map((item) => [item.estado, item._count.estado])
  );

  return {
    Pendiente: estadoMap.get('Pendiente') || 0,
    En_progreso: estadoMap.get('En_progreso') || 0,
    En_revision: estadoMap.get('En_revision') || 0,
    Completado: estadoMap.get('Completado') || 0,
  };
};

/**
 * Formatea estadísticas por prioridad en un objeto
 */
export const formatearEstadisticasPorPrioridad = (
  tareasPorPrioridad: Array<{ prioridad: string | null; _count: { prioridad: number } }>
) => {
  const prioridadMap = new Map(
    tareasPorPrioridad.map((item) => [item.prioridad, item._count.prioridad])
  );
  return Object.fromEntries(prioridadMap);
};

/**
 * Obtiene el conteo de tareas vencidas (fecha_limite pasada y no completadas)
 */
export const obtenerTareasVencidas = async (where: any) => {
  return prisma.tarea.count({
    where: {
      ...where,
      fecha_limite: {
        lt: new Date(),
      },
      estado: {
        not: 'Completado',
      },
    },
  });
};

/**
 * Obtiene el conteo de tareas por vencer (en los próximos 7 días y no completadas)
 */
export const obtenerTareasPorVencer = async (where: any) => {
  return prisma.tarea.count({
    where: {
      ...where,
      fecha_limite: {
        gte: new Date(),
        lte: new Date(Date.now() + TIME_CONSTANTS.SEVEN_DAYS_MS),
      },
      estado: {
        not: 'Completado',
      },
    },
  });
};

/**
 * Obtiene el conteo de comentarios filtrados por proyecto o usuario
 */
export const obtenerTotalComentarios = async (
  proyectoId?: string | number,
  usuarioId?: string | number
) => {
  if (proyectoId || usuarioId) {
    const where: any = {};
    
    if (proyectoId) {
      const proyectoIdParsed = parseId(String(proyectoId));
      if (proyectoIdParsed) {
        where.tarea = { proyectoId: proyectoIdParsed };
      }
    } else if (usuarioId) {
      const usuarioIdParsed = parseId(String(usuarioId));
      if (usuarioIdParsed) {
        where.tarea = { usuarioId: usuarioIdParsed };
      }
    }

    return prisma.comentario.count({ where });
  }

  return prisma.comentario.count();
};

/**
 * Obtiene estadísticas básicas de tareas
 */
export const obtenerEstadisticasTareas = async (where: any) => {
  return Promise.all([
    prisma.tarea.count({ where }),
    obtenerTareasPorEstado(where),
    obtenerTareasPorPrioridad(where),
    obtenerTareasVencidas(where),
    obtenerTareasPorVencer(where),
  ]);
};

/**
 * Construye la respuesta de estadísticas de tareas formateada
 */
export const construirRespuestaTareas = (
  totalTareas: number,
  tareasPorEstado: Array<{ estado: string; _count: { estado: number } }>,
  tareasPorPrioridad: Array<{ prioridad: string | null; _count: { prioridad: number } }>,
  tareasVencidas: number,
  tareasPorVencer: number
) => {
  return {
    total: totalTareas,
    porEstado: formatearEstadisticasPorEstado(tareasPorEstado),
    porPrioridad: formatearEstadisticasPorPrioridad(tareasPorPrioridad),
    vencidas: tareasVencidas,
    porVencer: tareasPorVencer,
  };
};

