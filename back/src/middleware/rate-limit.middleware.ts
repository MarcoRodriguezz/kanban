/**
 * Middleware de rate limiting: limita requests por IP
 * Implementa límites específicos para autenticación, recuperación de contraseña y requests estándar.
 */
import { Request, Response, NextFunction } from 'express';
import { RATE_LIMIT_CONSTANTS, TIME_CONSTANTS } from '../utils/constants';


interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const CLEANUP_INTERVAL_MS = 5 * TIME_CONSTANTS.ONE_HOUR_MS / 12; // 5 minutos
// Limpiar entradas expiradas periódicamente
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, CLEANUP_INTERVAL_MS);
// Permitir que el proceso termine incluso si el intervalo está activo
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}
//Obtiene la clave única para rate limiting basada en IP
const getKey = (req: Request): string => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `rate_limit_${ip}`;
};


export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000, // 15 minutos por defecto
  maxRequests: number = 100 // 100 requests por ventana por defecto
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = getKey(req);
    const now = Date.now();
    const record = store[key];

    if (!record || record.resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }
    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.status(429).json({
        error: 'Demasiadas solicitudes',
        message: `Has excedido el límite de ${maxRequests} solicitudes. Intenta de nuevo en ${retryAfter} segundos.`,
        retryAfter,
      });
      return;
    }
    record.count++;
    next();
  };
};


//Rate limiter estricto para endpoints de autenticación
export const authRateLimiter = createRateLimiter(
  RATE_LIMIT_CONSTANTS.AUTH_WINDOW_MS,
  RATE_LIMIT_CONSTANTS.AUTH_MAX_REQUESTS
);


//Rate limiter para recuperación de contraseña
export const passwordResetRateLimiter = createRateLimiter(
  RATE_LIMIT_CONSTANTS.PASSWORD_RESET_WINDOW_MS,
  RATE_LIMIT_CONSTANTS.PASSWORD_RESET_MAX_REQUESTS
);


//Rate limiter estándar para endpoints generales
export const standardRateLimiter = createRateLimiter(
  RATE_LIMIT_CONSTANTS.STANDARD_WINDOW_MS,
  RATE_LIMIT_CONSTANTS.STANDARD_MAX_REQUESTS
);

