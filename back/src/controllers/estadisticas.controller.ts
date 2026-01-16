/**
 * Controlador de estadísticas: genera reportes de tareas por proyecto, usuario y métricas de productividad.
 * Calcula estadísticas agregadas de tareas completadas, tiempos de ciclo y distribución por estados.
 */
import { Request, Response } from 'express';
import { handleError, sendValidationError, sendNotFoundError } from '../utils/error-handler';
import { prisma } from '../utils/prisma';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { parseId } from '../utils/validation';
import {
  construirFiltroTareas,
  obtenerEstadisticasTareas,
  construirRespuestaTareas,
  obtenerTotalComentarios,
  formatearEstadisticasPorEstado,
} from '../utils/estadisticas-helpers';


export const obtenerEstadisticas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { proyectoId, usuarioId } = req.query;
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const where = construirFiltroTareas(
      proyectoId ? String(proyectoId) : undefined,
      usuarioId ? String(usuarioId) : undefined
    );
    const [
      [totalTareas, tareasPorEstado, tareasPorPrioridad, tareasVencidas, tareasPorVencer],
      totalProyectos,
      proyectosActivos,
      totalComentarios,
      totalEtiquetas,
      usuariosActivos,
    ] = await Promise.all([
      obtenerEstadisticasTareas(where),

      proyectoId
        ? Promise.resolve(null)
        : prisma.proyecto.count(),

      proyectoId
        ? Promise.resolve(null)
        : prisma.proyecto.count({
            where: {
              OR: [
                { fecha_fin: null },
                { fecha_fin: { gte: new Date() } },
              ],
            },
          }),

      obtenerTotalComentarios(
        proyectoId ? String(proyectoId) : undefined,
        usuarioId ? String(usuarioId) : undefined
      ),

      prisma.etiqueta.count(),

      usuarioId
        ? Promise.resolve(null)
        : prisma.usuario.count({
            where: {
              tareas: {
                some: {},
              },
            },
          }),
    ]);

    res.json({
      estadisticas: {
        tareas: construirRespuestaTareas(
          totalTareas,
          tareasPorEstado,
          tareasPorPrioridad,
          tareasVencidas,
          tareasPorVencer
        ),
        proyectos: {
          total: totalProyectos,
          activos: proyectosActivos,
        },
        comentarios: {
          total: totalComentarios,
        },
        etiquetas: {
          total: totalEtiquetas,
        },
        usuarios: {
          activos: usuariosActivos,
        },
      },
      filtros: {
        proyectoId: proyectoId ? parseId(String(proyectoId)) : null,
        usuarioId: usuarioId ? parseId(String(usuarioId)) : null,
      },
      fechaConsulta: new Date().toISOString(),
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las estadísticas');
  }
};




export const obtenerEstadisticasProyecto = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const proyectoId = parseId(req.params.id);
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    if (!proyectoId) {
      sendValidationError(res, 'ID de proyecto inválido');
      return;
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, nombre: true },
    });
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }
    const where = { proyectoId };

    const [
      [totalTareas, tareasPorEstado, tareasPorPrioridad, tareasVencidas, tareasPorVencer],
      totalComentarios,
      usuariosInvolucrados,
    ] = await Promise.all([
      obtenerEstadisticasTareas(where),
      obtenerTotalComentarios(proyectoId),

      prisma.usuario.count({
        where: {
          tareas: {
            some: {
              proyectoId,
            },
          },
        },
      }),
    ]);

    res.json({
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
      },
      estadisticas: {
        tareas: construirRespuestaTareas(
          totalTareas,
          tareasPorEstado,
          tareasPorPrioridad,
          tareasVencidas,
          tareasPorVencer
        ),
        comentarios: {
          total: totalComentarios,
        },
        usuarios: {
          involucrados: usuariosInvolucrados,
        },
      },
      fechaConsulta: new Date().toISOString(),
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las estadísticas del proyecto');
  }
};


export const obtenerEstadisticasUsuario = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const where = { usuarioId: userId };

    const [
      totalTareas,
      tareasPorEstadoArray,
      _tareasPorPrioridad,
      _tareasVencidas,
      _tareasPorVencer,
    ] = await obtenerEstadisticasTareas(where);

    const tareasPorEstado = formatearEstadisticasPorEstado(tareasPorEstadoArray);

    const tareasConProyecto = await prisma.tarea.findMany({
      where: { usuarioId: userId },
      select: {
        proyectoId: true,
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    const estadisticasPorProyecto: Record<string, number> = {};
    tareasConProyecto.forEach((tarea) => {
      const proyectoNombre = tarea.proyecto?.nombre || 'Sin proyecto';
      estadisticasPorProyecto[proyectoNombre] = (estadisticasPorProyecto[proyectoNombre] || 0) + 1;
    });

    const tareasCompletadas = tareasPorEstado.Completado || 0;
    const progresoPorcentaje = totalTareas > 0 
      ? Math.round((tareasCompletadas / totalTareas) * 100) 
      : 0;

    const estadisticasMapeadas = {
      total: totalTareas,
      completed: tareasPorEstado.Completado || 0,
      inProgress: tareasPorEstado.En_progreso || 0,
      pending: tareasPorEstado.Pendiente || 0,
      inReview: tareasPorEstado.En_revision || 0,
      progressPercent: progresoPorcentaje,
      byProject: estadisticasPorProyecto,
    };

    res.json({
      estadisticas: estadisticasMapeadas,
      fechaConsulta: new Date().toISOString(),
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las estadísticas del usuario');
  }
};

