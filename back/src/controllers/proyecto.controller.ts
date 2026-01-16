/**
 * Controlador para gestión de proyectos: crear, actualizar, eliminar y buscar proyectos con sus tareas.
 * Maneja permisos de gestores y creadores, y registra todas las actividades para auditoría.
 */
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import {
  BuscarProyectosQuery,
  CrearProyectoInput,
  ActualizarProyectoInput,
} from '../validations/proyecto.validation';
import { sendNotFoundError } from '../utils/error-handler';
import { validateAndParseId } from '../utils/crud-helpers';
import { verificarUsuarioExiste } from '../utils/prisma-helpers';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, registrarActividades } from '../utils/actividad-helpers';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import { requireAuthHandler, requireResource, sendSuccess, sendCreated, sendUpdated, sendDeleted } from '../utils/controller-helpers';
import { ENTIDADES, ROLES } from '../utils/constants';
import { filterUndefined } from '../utils/crud-helpers';
import {
  proyectoIncludeBasico,
  proyectoIncludeCompleto,
  construirFiltrosProyecto,
  construirActividadesCambiosProyecto,
} from '../utils/proyecto-helpers';
import { agregarMiembroExplicito } from '../utils/proyecto-miembros-helpers';


export const buscarProyectos = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as BuscarProyectosQuery;
  const { pagina, limite } = getPaginationParams(req);
  const skip = getSkip(pagina, limite);
  const userId = requireAuthenticatedUser(req, res)!;

  const usuario = await requireResource(
    () => prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    }),
    res,
    'Usuario'
  );
  if (!usuario) return;

  let where = construirFiltrosProyecto(query);

  if (usuario.rol !== ROLES.ADMINISTRADOR) {
      // Obtener proyectos donde el usuario tiene tareas
      const tareasDelUsuario = await prisma.tarea.findMany({
        where: {
          usuarioId: userId,
        },
        select: {
          proyectoId: true,
        },
        distinct: ['proyectoId'],
      });

      const proyectoIdsConTareas = tareasDelUsuario.map((t) => t.proyectoId);

      // Obtener proyectos donde el usuario es miembro explícito
      const miembrosExplicitos = await prisma.proyectoMiembro.findMany({
        where: {
          usuarioId: userId,
        },
        select: {
          proyectoId: true,
        },
      });

      const proyectoIdsMiembrosExplicitos = miembrosExplicitos.map((m) => m.proyectoId);

      // Construir filtro de membresía: proyectos donde el usuario es creador, gestor, tiene tareas o es miembro explícito
      const filtroMembresia: Prisma.ProyectoWhereInput = {
        OR: [
          { creadoPorId: userId },
          { gestorId: userId },
          ...(proyectoIdsConTareas.length > 0 ? [{ id: { in: proyectoIdsConTareas } }] : []),
          ...(proyectoIdsMiembrosExplicitos.length > 0 ? [{ id: { in: proyectoIdsMiembrosExplicitos } }] : []),
        ],
      };

      // Combinar el filtro de membresía con los filtros de búsqueda 
      // Esto asegura que los empleados y gestores solo vean proyectos de los que forman parte
      where = {
        AND: [
          filtroMembresia,
          where, 
        ],
      };
    }

    const [proyectos, total] = await Promise.all([
      prisma.proyecto.findMany({
        where,
        skip,
        take: limite,
        include: proyectoIncludeBasico,
        orderBy: [{ orden: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.proyecto.count({ where }),
    ]);
    sendSuccess(res, {
      proyectos,
      paginacion: buildPaginationResponse(total, pagina, limite),
      filtros: {
        gestor: query.gestor || null,
        responsable: query.responsable || null,
      },
    });
});


export const obtenerProyectoPorId = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
  if (!proyectoId) return;

  const userId = requireAuthenticatedUser(req, res)!;
  const usuario = await requireResource(
    () => prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    }),
    res,
    'Usuario'
  );
  if (!usuario) return;

  const proyecto = await requireResource(
    () => prisma.proyecto.findUnique({
      where: { id: proyectoId },
      include: proyectoIncludeCompleto,
    }),
    res,
    'Proyecto'
  );
  if (!proyecto) return;

  if (usuario.rol !== ROLES.ADMINISTRADOR) {
    const esCreadorOGestor = proyecto.creadoPorId === userId || proyecto.gestorId === userId;
    
    const tieneTareas = await prisma.tarea.findFirst({
      where: {
        proyectoId,
        usuarioId: userId,
      },
      select: { id: true },
    });

    // Verificar si es miembro explícito del proyecto
    const esMiembroExplicito = await prisma.proyectoMiembro.findUnique({
      where: {
        proyectoId_usuarioId: {
          proyectoId,
          usuarioId: userId,
        },
      },
    });

    if (!esCreadorOGestor && !tieneTareas && !esMiembroExplicito) {
      res.status(403).json({ error: 'No tienes permisos para acceder a este proyecto' });
      return;
    }
  }

  sendSuccess(res, { proyecto });
});


export const crearProyecto = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const datos: CrearProyectoInput = req.body;
  const userId = requireAuthenticatedUser(req, res)!;

  if (!(await verificarUsuarioExiste(datos.gestorId))) {
    sendNotFoundError(res, 'Gestor');
    return;
  }

  const maxOrden = await prisma.proyecto.aggregate({
    _max: { orden: true },
  });
  const nuevoOrden = (maxOrden._max.orden ?? -1) + 1;

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        responsable: datos.responsable,
        equipo: datos.equipo,
        fecha_inicio: datos.fecha_inicio,
        fecha_fin: datos.fecha_fin ?? null,
        creadoPorId: userId,
        gestorId: datos.gestorId,
        orden: nuevoOrden,
      },
      include: proyectoIncludeBasico,
    });

    // Agregar automáticamente al creador y al gestor como miembros explícitos del proyecto
    await Promise.all([
      agregarMiembroExplicito(proyecto.id, userId), // Creador
      agregarMiembroExplicito(proyecto.id, datos.gestorId), // Gestor
    ]);

    registrarActividadSimple('crear', ENTIDADES.PROYECTO, proyecto.id, userId, 
      `Proyecto "${proyecto.nombre}" creado`);
    sendCreated(res, { proyecto }, 'Proyecto creado exitosamente');
});


export const actualizarProyecto = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
  if (!proyectoId) return;
  const datos: ActualizarProyectoInput = req.body;
  const proyectoAnterior = await requireResource(
    () => prisma.proyecto.findUnique({
      where: { id: proyectoId },
    }),
    res,
    'Proyecto'
  );
  if (!proyectoAnterior) return;
    if (datos.gestorId && !(await verificarUsuarioExiste(datos.gestorId))) {
      sendNotFoundError(res, 'Gestor');
      return;
    }

    const datosActualizacion = filterUndefined(datos);
    
    // Si se cambia el gestorId, actualizar también el responsable con el nombre del nuevo gestor
    if (datosActualizacion.gestorId && datosActualizacion.gestorId !== proyectoAnterior.gestorId) {
      const nuevoGestor = await prisma.usuario.findUnique({
        where: { id: datosActualizacion.gestorId },
        select: { nombreCompleto: true },
      });
      if (nuevoGestor) {
        datosActualizacion.responsable = nuevoGestor.nombreCompleto;
      }
      
      // Agregar automáticamente al nuevo gestor como miembro explícito del proyecto
      await agregarMiembroExplicito(proyectoId, datosActualizacion.gestorId);
    }
    
    const proyectoActualizado = await prisma.proyecto.update({
      where: { id: proyectoId },
      data: datosActualizacion,
      include: proyectoIncludeBasico,
    });
    const actividades = construirActividadesCambiosProyecto(
      proyectoAnterior,
      datosActualizacion,
      proyectoId,
      userId,
      proyectoActualizado.nombre
    );

    if (actividades.length > 0) {
      registrarActividades(actividades);
    }
    sendUpdated(res, { proyecto: proyectoActualizado }, 'Proyecto actualizado exitosamente');
});


export const eliminarProyecto = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
  if (!proyectoId) return;

  const userId = requireAuthenticatedUser(req, res)!;
  
  const proyecto = await requireResource(
    () => prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
        nombre: true,
        creadoPorId: true,
        gestorId: true,
      },
    }),
    res,
    'Proyecto'
  );
  if (!proyecto) return;

  const usuario = await requireResource(
    () => prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    }),
    res,
    'Usuario'
  );
  if (!usuario) return;

  // Solo administradores, creadores o gestores pueden eliminar proyectos
  const esAdmin = usuario.rol === ROLES.ADMINISTRADOR;
  const esCreador = proyecto.creadoPorId === userId;
  const esGestor = proyecto.gestorId === userId;

  if (!esAdmin && !esCreador && !esGestor) {
    res.status(403).json({ 
      error: 'No tienes permisos para eliminar este proyecto. Solo el creador, gestor o un administrador pueden eliminarlo.' 
    });
    return;
  }

  // Eliminar el proyecto (las tareas se eliminarán en cascada debido a onDelete: Cascade)
  await prisma.proyecto.delete({
    where: { id: proyectoId },
  });

  registrarActividadSimple('eliminar', ENTIDADES.PROYECTO, proyectoId, userId, 
    `Proyecto "${proyecto.nombre}" eliminado`);
  
  sendDeleted(res, 'Proyecto eliminado exitosamente');
});

