/**
 * Helpers genéricos para controladores: wrappers y funciones comunes.
 * Reduce código repetitivo y sigue principios de clean code.
 */
import { Request, Response } from 'express';
import { handleError } from './error-handler';
import { requireAuthenticatedUser } from './response-helpers';

/**
 * Tipo para funciones de controlador async
 */
type AsyncController = (req: Request, res: Response) => Promise<void>;

/**
 * Wrapper genérico para controladores async que maneja errores automáticamente
 * Elimina la necesidad de try-catch en cada controlador
 */
export const asyncHandler = (controller: AsyncController): AsyncController => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await controller(req, res);
    } catch (error) {
      handleError(res, error, 'Error en la solicitud');
    }
  };
};

/**
 * Wrapper que requiere autenticación antes de ejecutar el controlador
 */
export const requireAuthHandler = (controller: AsyncController): AsyncController => {
  return async (req: Request, res: Response): Promise<void> => {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;
    
    try {
      await controller(req, res);
    } catch (error) {
      handleError(res, error, 'Error en la solicitud');
    }
  };
};

/**
 * Helper para validar que un recurso existe antes de continuar
 */
export const requireResource = async <T>(
  findFn: () => Promise<T | null>,
  res: Response,
  resourceName: string
): Promise<T | null> => {
  const resource = await findFn();
  if (!resource) {
    res.status(404).json({ error: `${resourceName} no encontrado` });
    return null;
  }
  return resource;
};

/**
 * Helper para validar múltiples recursos en paralelo
 */
export const requireResources = async <T extends Record<string, any>>(
  resources: { [K in keyof T]: () => Promise<T[K] | null> },
  res: Response,
  resourceNames: { [K in keyof T]: string }
): Promise<T | null> => {
  const entries = Object.entries(resources) as [keyof T, () => Promise<any>][];
  const results = await Promise.all(entries.map(([, fn]) => fn()));
  
  for (let i = 0; i < entries.length; i++) {
    if (!results[i]) {
      const key = entries[i][0];
      res.status(404).json({ error: `${resourceNames[key]} no encontrado` });
      return null;
    }
  }
  
  return Object.fromEntries(
    entries.map(([key], i) => [key, results[i]])
  ) as T;
};

/**
 * Helper para ejecutar una operación solo si se cumplen condiciones
 */
export const executeIf = async <T>(
  condition: boolean,
  operation: () => Promise<T>,
  onFalse?: () => void
): Promise<T | null> => {
  if (condition) {
    return await operation();
  }
  onFalse?.();
  return null;
};

/**
 * Helper para construir respuestas exitosas de forma consistente
 */
export const sendSuccess = (
  res: Response,
  data: any,
  message?: string,
  statusCode: number = 200
): void => {
  const response: any = { ...data };
  if (message) {
    response.message = message;
  }
  res.status(statusCode).json(response);
};

/**
 * Helper para construir respuestas de creación exitosa
 */
export const sendCreated = (
  res: Response,
  data: any,
  message: string = 'Recurso creado exitosamente'
): void => {
  sendSuccess(res, data, message, 201);
};

/**
 * Helper para construir respuestas de actualización exitosa
 */
export const sendUpdated = (
  res: Response,
  data: any,
  message: string = 'Recurso actualizado exitosamente'
): void => {
  sendSuccess(res, data, message);
};

/**
 * Helper para construir respuestas de eliminación exitosa
 */
export const sendDeleted = (
  res: Response,
  message: string = 'Recurso eliminado exitosamente'
): void => {
  res.json({ message });
};

