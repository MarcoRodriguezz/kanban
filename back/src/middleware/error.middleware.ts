/**
 * Middleware de manejo de errores: captura errores 404 (rutas no encontradas) y errores no manejados.
 * Último middleware en la cadena, convierte excepciones en respuestas HTTP apropiadas.
 */
import { Request, Response, NextFunction } from 'express';
import { handleError } from '../utils/error-handler';

/**
 * Maneja error 404
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.method} ${req.path} no existe`,
    path: req.path,
    method: req.method,
  });
};

/**
 * Maneja errores no capturados
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (res.headersSent) {
    return;
  }

  handleError(res, err, 'Error interno del servidor', 500);
};

