/**
 * Middleware de logging HTTP: registra método, ruta, código de estado y tiempo de respuesta de cada request.
 * Optimizado para producción: solo loggea errores y requests lentos, incluyendo IP y user-agent.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware para logging de requests HTTP
 * Registra método, ruta, código de estado y tiempo de respuesta
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, path, ip } = req;

  // Log cuando la respuesta termine
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    // Solo loggear errores y requests importantes en producción
    const shouldLog = process.env.NODE_ENV === 'development' 
      || statusCode >= 400 
      || duration > 1000;

    if (shouldLog) {
      logger.http(method, path, statusCode, duration, {
        ip,
        userAgent: req.get('user-agent'),
        ...(req.user && { userId: req.user.userId }),
      });
    }
  });

  next();
};

