/**
 * Controlador para gestión de comentarios en tareas: crear, actualizar, eliminar y buscar comentarios.
 * Permite a cualquier usuario autenticado comentar, pero solo el autor puede editar sus comentarios.
 * El autor o un administrador pueden eliminar comentarios.
 */
import { Request, Response } from 'express';
import {
  CrearComentarioInput,
  ActualizarComentarioInput,
  BuscarComentariosQuery,
} from '../validations/comentario.validation';
import { sendValidationError, sendNotFoundError } from '../utils/error-handler';
import { parseId } from '../utils/validation';
import { validateAndParseId } from '../utils/crud-helpers';
import { verificarTareaExiste } from '../utils/prisma-helpers';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, registrarActividadActualizacion } from '../utils/actividad-helpers';
import { ENTIDADES } from '../utils/constants';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import { asyncHandler, requireResource, sendSuccess, sendCreated, sendUpdated, sendDeleted } from '../utils/controller-helpers';
import { comentarioInclude, comentarioIncludeConTarea } from '../utils/prisma-helpers';
import {
  construirFiltrosComentario,
  puedeEliminarComentario,
  esAutorComentario,
  obtenerComentarioYValidar,
  consultarComentariosConPaginacion,
} from '../utils/comentario-helpers';


export const obtenerComentariosPorTarea = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const tareaId = parseId(req.params.tareaId);
  if (!tareaId) {
    sendValidationError(res, 'ID de tarea inválido');
    return;
  }

  if (!(await verificarTareaExiste(tareaId))) {
    sendNotFoundError(res, 'Tarea');
    return;
  }

  const { pagina, limite } = getPaginationParams(req);
  const skip = getSkip(pagina, limite);
  const [comentarios, total] = await consultarComentariosConPaginacion(
    { tareaId },
    skip,
    limite,
    comentarioInclude
  );

  sendSuccess(res, {
    comentarios,
    paginacion: buildPaginationResponse(total, pagina, limite),
  });
});




export const buscarComentarios = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as BuscarComentariosQuery;
  const { pagina, limite } = getPaginationParams(req);
  const skip = getSkip(pagina, limite);
  const where = construirFiltrosComentario(query);

  const [comentarios, total] = await consultarComentariosConPaginacion(
    where,
    skip,
    limite,
    comentarioIncludeConTarea
  );

  sendSuccess(res, {
    comentarios,
    paginacion: buildPaginationResponse(total, pagina, limite),
    filtros: { tareaId: query.tareaId || null },
  });
});



export const obtenerComentarioPorId = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const comentarioId = validateAndParseId(req, res, 'id', 'Comentario');
  if (!comentarioId) return;

  const comentario = await requireResource(
    () => prisma.comentario.findUnique({
      where: { id: comentarioId },
      include: comentarioIncludeConTarea,
    }),
    res,
    'Comentario'
  );
  if (!comentario) return;

  sendSuccess(res, { comentario });
});




export const crearComentario = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const datos: CrearComentarioInput = req.body;
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return;

  if (!(await verificarTareaExiste(datos.tareaId))) {
    sendNotFoundError(res, 'Tarea');
    return;
  }

  const comentario = await prisma.comentario.create({
    data: {
      contenido: datos.contenido,
      tareaId: datos.tareaId,
      usuarioId: userId,
    },
    include: comentarioInclude,
  });

  registrarActividadSimple('crear', ENTIDADES.COMENTARIO, comentario.id, userId, 
    `Comentario creado en tarea ID ${datos.tareaId}`);

  sendCreated(res, { comentario }, 'Comentario creado exitosamente');
});




export const actualizarComentario = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const comentarioId = parseId(req.params.id);
  const datos: ActualizarComentarioInput = req.body;
  const userId = requireAuthenticatedUser(req, res);
  if (!userId || !comentarioId) {
    if (!comentarioId) sendValidationError(res, 'ID de comentario inválido');
    return;
  }

  const comentarioAnterior = await obtenerComentarioYValidar(
    comentarioId,
    res,
    { id: true, usuarioId: true, tareaId: true, contenido: true }
  );
  if (!comentarioAnterior) return;

  if (!esAutorComentario(comentarioAnterior.usuarioId, userId)) {
    res.status(403).json({
      error: 'Solo el autor del comentario puede actualizarlo',
    });
    return;
  }

  const comentario = await prisma.comentario.update({
    where: { id: comentarioId },
    data: { contenido: datos.contenido },
    include: comentarioInclude,
  });

  registrarActividadActualizacion(
    ENTIDADES.COMENTARIO,
    comentarioId,
    userId,
    `Comentario actualizado en tarea ID ${comentarioAnterior.tareaId}`,
    'contenido',
    comentarioAnterior.contenido || '',
    datos.contenido
  );

  sendUpdated(res, { comentario }, 'Comentario actualizado exitosamente');
});



export const eliminarComentario = asyncHandler(async (
  req: Request,
  res: Response
): Promise<void> => {
  const comentarioId = parseId(req.params.id);
  const userId = requireAuthenticatedUser(req, res);
  if (!userId || !comentarioId) {
    if (!comentarioId) sendValidationError(res, 'ID de comentario inválido');
    return;
  }

  const comentario = await obtenerComentarioYValidar(
    comentarioId,
    res,
    { id: true, usuarioId: true, tareaId: true }
  );
  if (!comentario) return;

  if (!puedeEliminarComentario(comentario.usuarioId, userId, req.user?.rol)) {
    res.status(403).json({
      error: 'Solo el autor del comentario o un administrador pueden eliminarlo',
    });
    return;
  }

  await prisma.comentario.delete({ where: { id: comentarioId } });
  registrarActividadSimple('eliminar', ENTIDADES.COMENTARIO, comentarioId, userId, 
    `Comentario eliminado de tarea ID ${comentario.tareaId}`);

  sendDeleted(res, 'Comentario eliminado exitosamente');
});

