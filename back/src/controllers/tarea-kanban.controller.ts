/**
 * Controlador para vistas especiales de tareas: Kanban y "Mi trabajo".
 * Proporciona endpoints optimizados para visualización tipo tablero Kanban.
 */
import { Request, Response } from 'express';
import { tareaInclude } from '../utils/prisma-helpers';
import { parseId } from '../utils/validation';
import { prisma } from '../utils/prisma';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import { requireAuthHandler, sendSuccess } from '../utils/controller-helpers';
import {
  agruparTareasPorEstado,
  calcularConteosPorEstado,
  construirFiltrosTarea,
} from '../utils/tarea-helpers';
import { formatKanbanTasks } from '../services/kanban-formatter';

/**
 * Obtener tareas asignadas al usuario actual (Mi trabajo)
 */
export const miTrabajo = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const { estado, prioridad, proyecto } = req.query;
  const { pagina, limite } = getPaginationParams(req);
  const skip = getSkip(pagina, limite);

  const filtros = construirFiltrosTarea({
    usuarioId: userId,
    estado: estado as string,
    prioridad: prioridad as string,
    proyecto: proyecto as string,
  });

  const [tareas, total] = await Promise.all([
    prisma.tarea.findMany({
      where: filtros,
      skip,
      take: limite,
      include: tareaInclude,
      orderBy: [
        { fecha_limite: 'asc' },
        { createdAt: 'desc' },
      ],
    }),
    prisma.tarea.count({ where: filtros }),
  ]);

  const tareasPorEstado = agruparTareasPorEstado(tareas);
  const conteos = calcularConteosPorEstado(tareasPorEstado);

  sendSuccess(res, {
    tareas,
    tareasPorEstado,
    paginacion: buildPaginationResponse(total, pagina, limite),
    filtros: {
      estado: estado || null,
      prioridad: prioridad || null,
      proyecto: proyecto || null,
    },
    resumen: {
      totalTareas: total,
      ...conteos,
    },
  });
});

/**
 * Tareas agrupadas por estado

 * Filtros opcionales:
 * - proyectoId: Filtrar por proyecto específico
 * - usuarioId: Filtrar por usuario específico
 */
export const kanban = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const { proyectoId, usuarioId } = req.query;

  const usuarioIdParsed = usuarioId 
    ? (typeof usuarioId === 'string' ? parseId(usuarioId) : typeof usuarioId === 'number' ? usuarioId : undefined)
    : undefined;
  
  const filtros = construirFiltrosTarea({
    proyecto: proyectoId ? String(proyectoId) : undefined,
    usuarioId: usuarioIdParsed || undefined,
  });

  const tareas = await prisma.tarea.findMany({
    where: filtros,
    include: tareaInclude,
    orderBy: [
      { fecha_limite: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const tareasPorEstado = agruparTareasPorEstado(tareas);
  const totalPorEstado = calcularConteosPorEstado(tareasPorEstado);
  
  // Formatear tareas al formato del frontend (con todas las transformaciones aplicadas)
  const kanbanFormateado = formatKanbanTasks(tareas);
  
  sendSuccess(res, {
    kanban: kanbanFormateado, // Datos completamente formateados para el frontend
    resumen: {
      totalTareas: tareas.length,
      porEstado: totalPorEstado,
    },
    filtros: {
      proyectoId: proyectoId ? (typeof proyectoId === 'string' ? parseId(proyectoId) : proyectoId) : null,
      usuarioId: usuarioId ? (typeof usuarioId === 'string' ? parseId(usuarioId) : usuarioId) : null,
    },
  });
});

