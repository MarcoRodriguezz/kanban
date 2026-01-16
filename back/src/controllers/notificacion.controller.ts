/**
 * Controlador para gestión de notificaciones: obtener, marcar como leídas y eliminar.
 */
import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { validateAndParseId } from '../utils/crud-helpers';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { requireAuthHandler, requireResource, sendSuccess, sendUpdated, sendDeleted } from '../utils/controller-helpers';
import { ROLES } from '../utils/constants';

/**
 * Obtiene todas las notificaciones del usuario actual (no leídas primero)
 * Los gestores no pueden ver notificaciones de issues, solo los administradores
 */
export const obtenerNotificaciones = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;

  // Obtener el rol del usuario para filtrar notificaciones de issues
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: true },
  });

  const esAdmin = usuario?.rol === ROLES.ADMINISTRADOR;

  // Construir el filtro WHERE: si no es admin, excluir notificaciones de issues
  const whereClause: any = { usuarioId: userId };
  if (!esAdmin) {
    whereClause.tipo = { not: 'issue-reported' };
  }

  const notificaciones = await prisma.notificacion.findMany({
    where: whereClause,
    orderBy: [
      { leida: 'asc' }, 
      { createdAt: 'desc' },
    ],
    include: {
      tarea: {
        select: {
          id: true,
          titulo: true,
          estado: true,
          proyectoId: true,
        },
      },
      proyecto: {
        select: {
          id: true,
          nombre: true,
        },
      },
      issue: {
        select: {
          id: true,
          titulo: true,
          estado: true,
          categoria: true,
          proyectoId: true,
        },
      },
    },
  });

  sendSuccess(res, { notificaciones });
});

/**
 * Obtiene el conteo de notificaciones no leídas del usuario actual
 * Los gestores no pueden ver notificaciones de issues, solo los administradores
 */
export const obtenerConteoNotificaciones = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;

  // Obtener el rol del usuario para filtrar notificaciones de issues
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: true },
  });

  const esAdmin = usuario?.rol === ROLES.ADMINISTRADOR;

  // Construir el filtro WHERE: si no es admin, excluir notificaciones de issues
  const whereClause: any = {
    usuarioId: userId,
    leida: false,
  };
  if (!esAdmin) {
    whereClause.tipo = { not: 'issue-reported' };
  }

  const conteo = await prisma.notificacion.count({
    where: whereClause,
  });

  sendSuccess(res, { conteo });
});

/**
 * Marca una notificación como leída
 */
export const marcarNotificacionLeida = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const notificacionId = validateAndParseId(req, res, 'id', 'Notificacion');
  if (!notificacionId) return;

  const notificacion = await requireResource(
    () => prisma.notificacion.findUnique({
      where: { id: notificacionId },
      select: { usuarioId: true },
    }),
    res,
    'Notificación'
  );
  if (!notificacion) return;

  if (notificacion.usuarioId !== userId) {
    res.status(403).json({ error: 'No tienes permisos para marcar esta notificación' });
    return;
  }

  await prisma.notificacion.update({
    where: { id: notificacionId },
    data: { leida: true },
  });

  sendUpdated(res, {}, 'Notificación marcada como leída');
});

/**
 * Marca todas las notificaciones del usuario como leídas
 */
export const marcarTodasNotificacionesLeidas = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;

  const resultado = await prisma.notificacion.updateMany({
    where: {
      usuarioId: userId,
      leida: false,
    },
    data: {
      leida: true,
    },
  });

  sendUpdated(res, {
    actualizadas: resultado.count,
  }, 'Todas las notificaciones han sido marcadas como leídas');
});

/**
 * Elimina una notificación
 */
export const eliminarNotificacion = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const notificacionId = validateAndParseId(req, res, 'id', 'Notificacion');
  if (!notificacionId) return;

  const notificacion = await requireResource(
    () => prisma.notificacion.findUnique({
      where: { id: notificacionId },
      select: { usuarioId: true },
    }),
    res,
    'Notificación'
  );
  if (!notificacion) return;

  if (notificacion.usuarioId !== userId) {
    res.status(403).json({ error: 'No tienes permisos para eliminar esta notificación' });
    return;
  }

  await prisma.notificacion.delete({
    where: { id: notificacionId },
  });

  sendDeleted(res, 'Notificación eliminada exitosamente');
});

