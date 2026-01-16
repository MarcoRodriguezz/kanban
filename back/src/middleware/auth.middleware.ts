/**
 * Middleware de autenticación y autorización: verifica tokens JWT, valida roles y permisos de proyectos/tareas.
 * Proporciona funciones para requerir roles específicos y verificar permisos de edición a nivel de middleware.
 */
import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { parseId } from '../utils/validation';
import { ROLES } from '../utils/constants';
import { logger } from '../utils/logger';
import { puedeEditarProyecto, puedeEditarTarea } from '../utils/permission-helpers';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        rol: string;
      };
    }
  }
}

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ 
        error: 'Token de autenticación requerido',
        message: 'Debes incluir el header Authorization con el formato: Bearer <token>'
      });
      return;
    }
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      res.status(401).json({ 
        error: 'Formato de token inválido',
        message: 'El header Authorization debe tener el formato: Bearer <token>. Verifica que no estés usando {{token}} literalmente, sino el token real obtenido del login.'
      });
      return;
    }
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token inválido o expirado';
    res.status(403).json({ 
      error: errorMessage,
      message: 'Asegúrate de haber iniciado sesión y de estar usando el token correcto. Si el token expiró, inicia sesión nuevamente.'
    });
  }
};


export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }
    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ 
        error: 'No tienes permisos para realizar esta acción' 
      });
      return;
    }
    next();
  };
};

export const requireAdmin = requireRole(ROLES.ADMINISTRADOR);
export const requireAnyRole = requireRole(ROLES.ADMINISTRADOR, ROLES.EMPLEADO);

export const canEditTasks = requireAnyRole;
export const canCreateTasks = requireAnyRole;


/**
 * Factory function para crear middleware de verificación de permisos
 * Elimina duplicación entre canEditProyecto y canEditTarea
 */
const createPermissionMiddleware = (
  permissionCheck: (userId: number, resourceId: number) => Promise<boolean>,
  resourceName: string
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }
      const resourceId = parseId(req.params.id);
      if (!resourceId) {
        res.status(400).json({ error: `ID de ${resourceName} inválido` });
        return;
      }
      const tienePermisos = await permissionCheck(req.user.userId, resourceId);
      if (!tienePermisos) {
        res.status(403).json({
          error: 'No tienes permisos para realizar esta acción',
        });
        return;
      }
      next();
    } catch (error) {
      logger.error(`Error en verificación de permisos de ${resourceName}`, error, {
        userId: req.user?.userId,
        resourceId: req.params.id,
      });
      res.status(500).json({ error: 'Error al verificar permisos' });
    }
  };
};

export const canEditProyecto = createPermissionMiddleware(
  puedeEditarProyecto,
  'proyecto'
);

export const canEditTarea = createPermissionMiddleware(
  puedeEditarTarea,
  'tarea'
);