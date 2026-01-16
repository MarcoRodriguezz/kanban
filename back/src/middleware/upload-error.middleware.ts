/**
 * Middleware para manejar errores de Multer en carga de archivos.
 * Proporciona respuestas HTTP apropiadas para errores de tamaño, tipo y otros errores de Multer.
 */
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { SERVER_CONSTANTS } from '../utils/constants';

/**
 * Manejar errores de Multer
 */
export const handleMulterError = (
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'Archivo demasiado grande',
        message: `El tamaño máximo permitido por archivo es ${SERVER_CONSTANTS.MAX_FILE_SIZE_MB}MB`,
        límiteMB: SERVER_CONSTANTS.MAX_FILE_SIZE_MB,
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Demasiados archivos',
        message: 'Solo se permite un archivo por solicitud',
      });
      return;
    }
    res.status(400).json({
      error: 'Error al procesar el archivo',
      message: err.message,
    });
    return;
  }

  if (err instanceof Error) {
    // Errores del fileFilter
    res.status(400).json({
      error: 'Error de validación de archivo',
      message: err.message,
    });
    return;
  }

  next(err);
};

