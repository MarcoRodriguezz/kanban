/**
 * Manejo centralizado de errores: convierte errores de Prisma, Multer y otros en respuestas HTTP apropiadas.
 * Proporciona mensajes de error consistentes y wrapper asyncHandler para capturar errores no manejados.
 */
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { logger } from './logger';
import { SERVER_CONSTANTS } from './constants';

export const handleError = (
  res: Response,
  error: unknown,
  defaultMessage: string,
  statusCode: number = 500
): void => {
  logger.error(defaultMessage, error);

  // Manejo específico de errores de Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(res, error, defaultMessage);
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'Error de validación en la base de datos',
      message: 'Los datos proporcionados no son válidos',
    });
    return;
  }

  // Manejo de errores de inicialización de Prisma (problemas de conexión)
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Error de inicialización de Prisma (problema de conexión)', error, {
      errorCode: error.errorCode,
    });
    res.status(500).json({
      error: 'Error de conexión a la base de datos',
      message: 'No se pudo conectar a la base de datos. Verifica la configuración.',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        errorCode: error.errorCode,
      }),
    });
    return;
  }

  // Manejo de errores críticos de Prisma
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    logger.error('Error crítico de Prisma', error);
    res.status(500).json({
      error: 'Error crítico en la base de datos',
      message: 'Ocurrió un error crítico al procesar la solicitud',
    });
    return;
  }

  // Manejo específico de errores de Multer
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'Archivo demasiado grande',
        message: `El tamaño máximo permitido por archivo es ${SERVER_CONSTANTS.MAX_FILE_SIZE_MB}MB`,
        límiteMB: SERVER_CONSTANTS.MAX_FILE_SIZE_MB,
      });
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Demasiados archivos',
        message: 'Solo se permite un archivo por solicitud',
      });
      return;
    }
    res.status(400).json({
      error: 'Error al procesar el archivo',
      message: error.message,
    });
    return;
  }

  // Manejo de errores de validación de archivos (fileFilter)
  if (error instanceof Error && error.message.includes('Tipo de archivo no permitido')) {
    res.status(400).json({
      error: 'Error de validación de archivo',
      message: error.message,
    });
    return;
  }

  if (error instanceof Error && error.message.includes('Tipo MIME no permitido')) {
    res.status(400).json({
      error: 'Error de validación de archivo',
      message: error.message,
    });
    return;
  }

  // Error genérico
  res.status(statusCode).json({
    error: defaultMessage,
    message: error instanceof Error ? error.message : 'Error desconocido',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error instanceof Error ? error.stack : undefined,
    }),
  });
};

/**
 * Maneja errores específicos de Prisma
 */
const handlePrismaError = (
  res: Response,
  error: Prisma.PrismaClientKnownRequestError,
  defaultMessage: string
): void => {
  switch (error.code) {
    case 'P2002':
      // Violación de constraint único
      const target = (error.meta?.target as string[]) || [];
      res.status(409).json({
        error: 'Conflicto de datos',
        message: `Ya existe un registro con ${target.join(', ')}`,
      });
      break;

    case 'P2025':
      // Registro no encontrado
      res.status(404).json({
        error: 'Recurso no encontrado',
        message: 'El registro solicitado no existe',
      });
      break;

    case 'P2003':
      // Violación de foreign key
      res.status(400).json({
        error: 'Error de referencia',
        message: 'No se puede realizar la operación debido a referencias existentes',
      });
      break;

    case 'P2014':
      // Violación de constraint requerido
      res.status(400).json({
        error: 'Error de datos requeridos',
        message: 'Faltan campos obligatorios para realizar la operación',
      });
      break;

    default:
      res.status(500).json({
        error: defaultMessage,
        message: 'Error en la base de datos',
        code: error.code,
      });
  }
};

export const sendValidationError = (res: Response, message: string): void => {
  res.status(400).json({ error: message });
};

export const sendNotFoundError = (res: Response, resource: string): void => {
  res.status(404).json({ error: `${resource} no encontrado` });
};

/**
 * Wrapper para manejar errores en handlers async de Express
 * Captura automáticamente errores no manejados y los pasa al error handler
 * 
 * @param fn - Función async handler de Express
 * @returns Función wrapper que maneja errores
 * 
 * @example
 * router.get('/ruta', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json(data);
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

