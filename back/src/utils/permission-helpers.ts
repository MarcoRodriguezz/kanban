/**
 * Sistema de verificación de permisos para tareas y proyectos: verifica roles, creadores y gestores.
 * Proporciona funciones para verificar permisos de edición y cambio de estado, con middleware para Express.
 */
import { Request, Response } from 'express';
import { prisma } from './prisma';
import { ROLES } from './constants';

/**
 * Interfaz permisos de tarea
 */
export interface TareaPermissionInfo {
  esAdmin: boolean;
  esCreador: boolean;
  esAsignado: boolean;
  esGestor: boolean;
}

/**
 * Interfaz permisos de proyecto
 */
export interface ProyectoPermissionInfo {
  esAdmin: boolean;
  esCreador: boolean;
  esGestor: boolean;
}


export const verificarPermisosTarea = async (
  userId: number,
  tareaId: number
): Promise<{ permisos: TareaPermissionInfo; tarea: any } | null> => {
  const [usuario, tarea] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    }),
    prisma.tarea.findUnique({
      where: { id: tareaId },
      select: {
        id: true,
        titulo: true,
        estado: true,
        usuarioId: true,
        creadoPorId: true,
        proyecto: {
          select: {
            gestorId: true,
          },
        },
      },
    }),
  ]);

  if (!tarea || !usuario || !tarea.proyecto) {
    return null;
  }

  const permisos: TareaPermissionInfo = {
    esAdmin: usuario.rol === ROLES.ADMINISTRADOR,
    esCreador: tarea.creadoPorId === userId,
    esAsignado: tarea.usuarioId !== null && tarea.usuarioId === userId,
    esGestor: tarea.proyecto.gestorId === userId,
  };

  return { permisos, tarea };
};

export const verificarPermisosProyecto = async (
  userId: number,
  proyectoId: number
): Promise<{ permisos: ProyectoPermissionInfo; proyecto: any } | null> => {
  const [usuario, proyecto] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    }),
    prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
        nombre: true,
        creadoPorId: true,
        gestorId: true,
      },
    }),
  ]);

  if (!proyecto || !usuario) {
    return null;
  }

  const permisos: ProyectoPermissionInfo = {
    esAdmin: usuario.rol === ROLES.ADMINISTRADOR,
    esCreador: proyecto.creadoPorId === userId,
    esGestor: proyecto.gestorId === userId, // Es gestor si es el gestor del proyecto, sin importar el rol global
  };

  return { permisos, proyecto };
};


export const puedeEditarTarea = async (
  userId: number,
  tareaId: number
): Promise<boolean> => {
  const resultado = await verificarPermisosTarea(userId, tareaId);
  if (!resultado) return false;

  const { permisos } = resultado;
  return permisos.esAdmin || permisos.esCreador || permisos.esGestor;
};


export const puedeCambiarEstadoTarea = async (
  userId: number,
  tareaId: number
): Promise<boolean> => {
  const resultado = await verificarPermisosTarea(userId, tareaId);
  if (!resultado) return false;

  const { permisos } = resultado;
  return (
    permisos.esAdmin ||
    permisos.esCreador ||
    permisos.esAsignado ||
    permisos.esGestor
  );
};

/**
 * Verifica si un usuario puede autoasignarse una tarea
 * Según el modelo de permisos tipo Jira:
 * - Cualquier usuario autenticado puede asignarse tareas a sí mismo
 * - Esto permite el flujo Kanban de "pull system" donde los usuarios toman tareas
 * @param userId - ID del usuario que quiere autoasignarse
 * @param nuevoUsuarioId - ID del usuario al que se quiere asignar (debe ser el mismo)
 * @returns true si puede autoasignarse, false en caso contrario
 */
export const puedeAutoasignarse = (
  userId: number,
  nuevoUsuarioId: number
): boolean => {
  // Solo puede asignarse a sí mismo
  return userId === nuevoUsuarioId;
};

export const puedeEditarProyecto = async (
  userId: number,
  proyectoId: number
): Promise<boolean> => {
  const resultado = await verificarPermisosProyecto(userId, proyectoId);
  if (!resultado) return false;

  const { permisos } = resultado;
  return permisos.esAdmin || permisos.esCreador || permisos.esGestor;
};

export const verificarPermisosTareaMiddleware = async (
  req: Request,
  res: Response,
  requireEdit: boolean = true
): Promise<{ permisos: TareaPermissionInfo; tarea: any } | null> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Usuario no autenticado' });
    return null;
  }

  const tareaId = Number(req.params.id || req.params.tareaId);
  if (!tareaId) {
    res.status(400).json({ error: 'ID de tarea inválido' });
    return null;
  }

  const resultado = await verificarPermisosTarea(userId, tareaId);
  if (!resultado) {
    res.status(404).json({ error: 'Tarea no encontrada' });
    return null;
  }

  const { permisos } = resultado;
  const tienePermisos = requireEdit
    ? permisos.esAdmin || permisos.esCreador || permisos.esGestor
    : permisos.esAdmin ||
      permisos.esCreador ||
      permisos.esAsignado ||
      permisos.esGestor;

  if (!tienePermisos) {
    res.status(403).json({
      error: 'No tienes permisos para realizar esta acción',
    });
    return null;
  }

  return resultado;
};

