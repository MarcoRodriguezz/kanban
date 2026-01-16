/**
 * Controlador para gestión de asignaciones y estados de tareas.
 * Maneja autoasignación, desasignación y cambio de estados con permisos específicos.
 */
import { Request, Response } from 'express';
import { CambiarEstadoTareaInput } from '../validations/tarea.validation';
import { tareaInclude } from '../utils/prisma-helpers';
import { sendValidationError, sendNotFoundError } from '../utils/error-handler';
import { parseId } from '../utils/validation';
import { prisma } from '../utils/prisma';
import { registrarActividades, registrarActividadActualizacion } from '../utils/actividad-helpers';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { ENTIDADES, ACCIONES_AUDITORIA } from '../utils/constants';
import { verificarPermisosTarea } from '../utils/permission-helpers';
import {
  crearActividadAsignacion,
  obtenerNombreUsuario,
} from '../utils/tarea-helpers';
import { asyncHandler, requireResource, sendSuccess } from '../utils/controller-helpers';

export const autoasignarTarea = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const tareaId = parseId(req.params.id);
  const userId = requireAuthenticatedUser(req, res);
  if (!userId || !tareaId) {
    if (!tareaId) sendValidationError(res, 'ID de tarea inválido');
    return;
  }

  const tareaAnterior = await requireResource(
    () => prisma.tarea.findUnique({
      where: { id: tareaId },
      select: { id: true, titulo: true, usuarioId: true, asignado_a: true },
    }),
    res,
    'Tarea'
  );
  if (!tareaAnterior) return;

  if (tareaAnterior.usuarioId === userId) {
    const tareaCompleta = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: tareaInclude,
    });
    sendSuccess(res, { tarea: tareaCompleta }, 'La tarea ya está asignada a ti');
    return;
  }

  const nombreUsuario = await obtenerNombreUsuario(userId);
  if (!nombreUsuario) {
    sendNotFoundError(res, 'Usuario');
    return;
  }

  const tarea = await prisma.tarea.update({
    where: { id: tareaId },
    data: { usuarioId: userId, asignado_a: nombreUsuario },
    include: tareaInclude,
  });

  registrarActividades([
    crearActividadAsignacion(tareaId, tarea.titulo, userId, tareaAnterior.usuarioId, userId, true),
  ]);

  sendSuccess(res, { tarea }, 'Tarea autoasignada exitosamente');
});

/**
 * Cambiar el estado de una tarea 
 * - Administrador: puede cambiar estado de cualquier tarea
 * - Gestor del proyecto: puede cambiar estado de tareas de sus proyectos gestionados
 * - Usuario asignado: cualquier trabajador (Empleado) que tenga la tarea asignada puede cambiar su estado
 * - Creador de la tarea: puede cambiar el estado de sus propias tareas creadas
 */
export const cambiarEstadoTarea = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const tareaId = parseId(req.params.id);
  const datos: CambiarEstadoTareaInput = req.body;
  const userId = requireAuthenticatedUser(req, res);
  if (!userId || !tareaId) {
    if (!tareaId) sendValidationError(res, 'ID de tarea inválido');
    return;
  }

  const resultadoPermisos = await verificarPermisosTarea(userId, tareaId);
  if (!resultadoPermisos) {
    sendNotFoundError(res, 'Tarea');
    return;
  }

  const { permisos, tarea: tareaAnterior } = resultadoPermisos;
  if (!permisos.esAdmin && !permisos.esCreador && !permisos.esAsignado && !permisos.esGestor) {
    res.status(403).json({
      error: 'No tienes permisos para cambiar el estado de esta tarea',
    });
    return;
  }

  if (tareaAnterior.estado === datos.estado) {
    const tareaCompleta = await requireResource(
      () => prisma.tarea.findUnique({ where: { id: tareaId }, include: tareaInclude }),
      res,
      'Tarea'
    );
    if (tareaCompleta) {
      sendSuccess(res, { tarea: tareaCompleta }, 'El estado ya es el mismo');
    }
    return;
  }

  const tarea = await prisma.tarea.update({
    where: { id: tareaId },
    data: { estado: datos.estado },
    include: tareaInclude,
  });

  registrarActividadActualizacion(
    ENTIDADES.TAREA,
    tareaId,
    userId,
    `Estado de tarea "${tarea.titulo}" cambiado de "${tareaAnterior.estado}" a "${datos.estado}"`,
    'estado',
    tareaAnterior.estado,
    datos.estado,
    ACCIONES_AUDITORIA.CAMBIAR_ESTADO
  );

  sendSuccess(res, {
    tarea,
    cambio: { anterior: tareaAnterior.estado, nuevo: datos.estado },
  }, 'Estado de tarea actualizado exitosamente');
});

