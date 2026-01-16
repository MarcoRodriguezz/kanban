/**
 * Controlador para gestión de archivos adjuntos en tareas: crear, obtener, eliminar archivos.
 * Valida permisos, límites de tamaño y maneja archivos físicos.
 */
import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { requireAuthHandler, sendSuccess, sendCreated, sendDeleted } from '../utils/controller-helpers';
import { sendNotFoundError, sendValidationError } from '../utils/error-handler';
import { validateAndParseId } from '../utils/crud-helpers';
import { validarCreacionArchivo, eliminarArchivoFísico, obtenerArchivoConPermisos } from '../utils/archivo-helpers';
import { registrarActividadSimple } from '../utils/actividad-helpers';
import { ENTIDADES } from '../utils/constants';

/**
 * Obtener archivos de una tarea
 * GET /api/archivos/tarea/:tareaId
 */
export const obtenerArchivosPorTarea = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const tareaId = validateAndParseId(req, res, 'tareaId', 'Tarea');
  if (!tareaId) return;

  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: { id: true },
  });

  if (!tarea) {
    sendNotFoundError(res, 'Tarea');
    return;
  }

  const archivos = await prisma.archivo.findMany({
    where: { tareaId },
    select: {
      id: true,
      nombre: true,
      url: true,
      tamaño: true,
      tipo: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  sendSuccess(res, { archivos });
});

/**
 * Subir archivo a una tarea
 * POST /api/archivos
 */
export const crearArchivo = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  
  if (!req.file) {
    sendValidationError(res, 'No se proporcionó ningún archivo');
    return;
  }

  const tareaId = req.body.tareaId ? parseInt(req.body.tareaId) : null;
  if (!tareaId || isNaN(tareaId)) {
    eliminarArchivoFísico(req.file.filename);
    sendValidationError(res, 'ID de tarea inválido');
    return;
  }

  const validación = await validarCreacionArchivo(
    userId,
    tareaId,
    req.file.size,
    req.file.filename
  );

  if (!validación.válido) {
    const error = validación.error!;
    res.status(error.status).json({
      error: error.mensaje,
      ...(error.tamañoActualMB !== undefined && {
        tamañoActualMB: error.tamañoActualMB,
        límiteMB: error.límiteMB,
      }),
    });
    return;
  }

  const archivo = await prisma.archivo.create({
    data: {
      nombre: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      tamaño: req.file.size,
      tipo: req.file.mimetype,
      tareaId,
    },
    select: {
      id: true,
      nombre: true,
      url: true,
      tamaño: true,
      tipo: true,
      createdAt: true,
    },
  });

  registrarActividadSimple('crear', ENTIDADES.ARCHIVO, archivo.id, userId, 
    `Archivo "${archivo.nombre}" agregado a tarea ID ${tareaId}`);

  sendCreated(res, { archivo }, 'Archivo subido exitosamente');
});

/**
 * Eliminar archivo
 * DELETE /api/archivos/:id
 */
export const eliminarArchivo = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const archivoId = validateAndParseId(req, res, 'id', 'Archivo');
  if (!archivoId) return;

  const resultado = await obtenerArchivoConPermisos(archivoId, userId, {
    id: true,
    nombre: true,
    url: true,
    tareaId: true,
  });
  if (!resultado) {
    sendNotFoundError(res, 'Archivo');
    return;
  }

  const { archivo } = resultado;
  
  // Eliminar archivo físico
  eliminarArchivoFísico(archivo.url.replace('/uploads/', ''));

  // Eliminar registro de la base de datos
  await prisma.archivo.delete({ where: { id: archivoId } });

  registrarActividadSimple('eliminar', ENTIDADES.ARCHIVO, archivoId, userId, 
    `Archivo "${archivo.nombre}" eliminado de tarea ID ${archivo.tareaId}`);

  sendDeleted(res, 'Archivo eliminado exitosamente');
});

