/**
 * Controlador de actividades de auditoría: consulta el log de actividades de usuarios en el sistema.
 * Permite buscar actividades por entidad, usuario y fecha, con paginación para historiales extensos.
 */
import { Request, Response } from 'express';
import { handleError, sendValidationError } from '../utils/error-handler';
import { parseId } from '../utils/validation';
import { prisma } from '../utils/prisma';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import {
  MAX_ACTIVIDADES_POR_ENTIDAD,
  actividadIncludeUsuario,
  verificarPermisosActividad,
  construirFiltroActividades,
  construirFiltroFecha,
  consultarActividadesConPaginacion,
  obtenerProyectoIdDeEntidad,
  obtenerProyectosDelGestor,
  procesarActividadesParaBacklog,
} from '../utils/actividad-helpers';
import { ROLES } from '../utils/constants';

export const obtenerActividadPorEntidad = async (req: Request, res: Response): Promise<void> => {
  try {
    const permisos = await verificarPermisosActividad(req, res);
    if (!permisos) return;

    const entidad = req.params.entidad;
    const entidadId = parseId(req.params.id);

    if (!entidadId) {
      sendValidationError(res, 'ID de entidad inválido');
      return;
    }

    if (permisos.esGestor && !permisos.esAdmin) {
      const { proyectoId, error } = await obtenerProyectoIdDeEntidad(entidad, entidadId);
      
      if (error) {
        sendValidationError(res, error);
        return;
      }

      if (proyectoId === null) {
        res.status(404).json({
          error: `${entidad} no encontrada`,
        });
        return;
      }

      const proyectosDelGestor = await obtenerProyectosDelGestor(permisos.userId);
      if (!proyectosDelGestor.includes(proyectoId)) {
        res.status(403).json({
          error: `No tienes permisos para ver las actividades de este ${entidad.toLowerCase()}`,
        });
        return;
      }
    }

    // Filtrar últimos 30 días
    const fechaLimite30Dias = new Date();
    fechaLimite30Dias.setDate(fechaLimite30Dias.getDate() - 30);

    const actividades = await prisma.logActividad.findMany({
      where: {
        entidad,
        entidadId,
        createdAt: {
          gte: fechaLimite30Dias,
        },
      },
      include: actividadIncludeUsuario,
      orderBy: {
        createdAt: 'desc',
      },
      take: MAX_ACTIVIDADES_POR_ENTIDAD,
    });

    res.json({
      entidad,
      entidadId,
      actividades,
      total: actividades.length,
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las actividades');
  }
};

export const obtenerActividades = async (req: Request, res: Response): Promise<void> => {
  try {
    const permisos = await verificarPermisosActividad(req, res);
    if (!permisos) return;

    const { entidad, usuarioId, fechaInicio, fechaFin } = req.query;
    const { pagina, limite } = getPaginationParams(req);
    const skip = getSkip(pagina, limite);

    const filtrosAdicionales: any = {
      ...(entidad && { entidad }),
      ...(usuarioId && {
        usuarioId: parseId(String(usuarioId)) || undefined,
      }),
      ...construirFiltroFecha(fechaInicio as string, fechaFin as string),
    };

    const where = await construirFiltroActividades(
      permisos.userId,
      permisos.esAdmin,
      permisos.esGestor,
      filtrosAdicionales
    );

    const [actividades, total] = await consultarActividadesConPaginacion(where, skip, limite);

    res.json({
      actividades,
      paginacion: buildPaginationResponse(total, pagina, limite),
      filtros: {
        entidad: entidad || null,
        usuarioId: usuarioId || null,
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las actividades');
  }
};

export const obtenerMisActividades = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const { fechaInicio, fechaFin } = req.query;
    const { pagina, limite } = getPaginationParams(req);
    const skip = getSkip(pagina, limite);

    const filtrosAdicionales: any = {
      usuarioId: userId,
      ...construirFiltroFecha(fechaInicio as string, fechaFin as string),
    };

    const where: any = {
      usuarioId: userId,
      ...filtrosAdicionales,
    };

    const [actividades, total] = await consultarActividadesConPaginacion(where, skip, limite);

    res.json({
      actividades,
      paginacion: buildPaginationResponse(total, pagina, limite),
      filtros: {
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener mis actividades');
  }
};


export const obtenerActividadesProyecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const proyectoId = parseId(req.params.proyectoId);
    if (!proyectoId) {
      sendValidationError(res, 'ID de proyecto inválido');
      return;
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, nombre: true, gestorId: true },
    });

    if (!proyecto) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });

    const esAdmin = usuario?.rol === ROLES.ADMINISTRADOR;
    const esGestorDelProyecto = proyecto.gestorId === userId;

    // Solo administradores y gestores del proyecto pueden acceder a los backlogs
    if (!esAdmin && !esGestorDelProyecto) {
      res.status(403).json({
        error: 'Solo los administradores y gestores del proyecto pueden acceder a los backlogs',
      });
      return;
    }

    const { fechaInicio, fechaFin } = req.query;
    const { pagina, limite } = getPaginationParams(req);
    const skip = getSkip(pagina, limite);

    const tareas = await prisma.tarea.findMany({
      where: { proyectoId },
      select: { id: true },
    });
    const tareaIds = tareas.map(t => t.id);
    
    const filtroFecha = construirFiltroFecha(fechaInicio as string, fechaFin as string);
    
    const actividadesCreacionTareasExistentes = tareaIds.length > 0 ? await prisma.logActividad.findMany({
      where: {
        entidad: 'Tarea',
        accion: 'crear',
        entidadId: { in: tareaIds },
      },
      select: { entidadId: true },
      distinct: ['entidadId'],
    }) : [];
    
    const tareaIdsCreadasEnProyecto = actividadesCreacionTareasExistentes.map(a => a.entidadId);
    
    const actividadesEliminacionTareasDelProyecto = tareaIdsCreadasEnProyecto.length > 0
      ? await prisma.logActividad.findMany({
          where: {
            entidad: 'Tarea',
            accion: 'eliminar',
            entidadId: { in: tareaIdsCreadasEnProyecto },
            ...filtroFecha,
          },
          select: { entidadId: true },
          distinct: ['entidadId'],
        })
      : [];
    
    const tareaIdsEliminadasDelProyecto = actividadesEliminacionTareasDelProyecto.map(a => a.entidadId);
    
    const todasLasTareaIds = [...new Set([...tareaIds, ...tareaIdsEliminadasDelProyecto])];
    
    // Obtener IDs de comentarios y archivos relacionados con las tareas del proyecto
    const [comentarios, archivos] = await Promise.all([
      tareaIds.length > 0 ? prisma.comentario.findMany({
        where: { tareaId: { in: tareaIds } },
        select: { id: true },
      }) : [],
      tareaIds.length > 0 ? prisma.archivo.findMany({
        where: { tareaId: { in: tareaIds } },
        select: { id: true },
      }) : [],
    ]);
    const comentarioIds = comentarios.map(c => c.id);
    const archivoIds = archivos.map(a => a.id);

    // Obtener IDs de etiquetas relacionadas con las tareas del proyecto
    const tareasConEtiquetas = tareaIds.length > 0 ? await prisma.tareaEtiqueta.findMany({
      where: { tareaId: { in: tareaIds } },
      select: { etiquetaId: true },
    }) : [];
    const etiquetaIds = Array.from(new Set(tareasConEtiquetas.map(te => te.etiquetaId)));
    
    const condicionesOR: any[] = [
      {
        entidad: 'Proyecto',
        entidadId: proyectoId,
      },
    ];
    
    // Actividades de tareas del proyecto
    // Incluimos actividades de todas las tareas que alguna vez pertenecieron al proyecto
    if (todasLasTareaIds.length > 0) {
      condicionesOR.push({
        entidad: 'Tarea',
        entidadId: { in: todasLasTareaIds },
      });
    }
    
    // Actividades de comentarios de tareas del proyecto
    if (comentarioIds.length > 0) {
      condicionesOR.push({
        entidad: 'Comentario',
        entidadId: { in: comentarioIds },
      });
    }
    
    // Actividades de archivos de tareas del proyecto
    if (archivoIds.length > 0) {
      condicionesOR.push({
        entidad: 'Archivo',
        entidadId: { in: archivoIds },
      });
    }
    
    // Actividades de etiquetas relacionadas con tareas del proyecto
    if (etiquetaIds.length > 0) {
      condicionesOR.push({
        entidad: 'Etiqueta',
        entidadId: { in: etiquetaIds },
      });
    }
    
    const where: any = condicionesOR.length === 1 
      ? { ...condicionesOR[0], ...filtroFecha }
      : { OR: condicionesOR, ...filtroFecha };
    
    const [actividades, total] = await consultarActividadesConPaginacion(where, skip, limite);

    const actividadesProcesadas = await procesarActividadesParaBacklog(actividades);
    
    // Excluir actividades de eliminación de la búsqueda en BD, ya que las tareas ya no existen
    const tareaIdsSinTitulo = actividadesProcesadas
      .filter(act => act.entidad === 'Tarea' && !act.taskTitle && act.backlogAction !== 'delete-task')
      .map(act => act.entidadId);
    
    if (tareaIdsSinTitulo.length > 0) {
      const tareas = await prisma.tarea.findMany({
        where: { id: { in: tareaIdsSinTitulo } },
        select: { id: true, titulo: true },
      });
      
      const tareasMap = new Map(tareas.map(t => [t.id, t.titulo]));
      
      actividadesProcesadas.forEach(act => {
        if (act.entidad === 'Tarea' && !act.taskTitle && act.backlogAction !== 'delete-task') {
          act.taskTitle = tareasMap.get(act.entidadId) || `Tarea ${act.entidadId}`;
        }
        // Para actividades de eliminación sin título, usar un título por defecto basado en el ID
        if (act.entidad === 'Tarea' && !act.taskTitle && act.backlogAction === 'delete-task') {
          act.taskTitle = `Tarea ${act.entidadId}`;
        }
      });
    } else {
      // Asegurar que las actividades de eliminación tengan un título por defecto si no se extrajo de la descripción
      actividadesProcesadas.forEach(act => {
        if (act.entidad === 'Tarea' && !act.taskTitle && act.backlogAction === 'delete-task') {
          act.taskTitle = `Tarea ${act.entidadId}`;
        }
      });
    }

    res.json({
      actividades: actividadesProcesadas,
      paginacion: buildPaginationResponse(total, pagina, limite),
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
      },
      filtros: {
        fechaInicio: fechaInicio || null,
        fechaFin: fechaFin || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener las actividades del proyecto');
  }
};

