/**
 * Helpers genéricos reutilizables para operaciones CRUD comunes: obtener por ID, búsqueda paginada, filtrado y detección de cambios.
 * Reduce código duplicado y proporciona funciones estándar para todos los controladores.
 * Incluye helpers para construcción de filtros WHERE de Prisma.
 */
import { Request, Response } from 'express';
import { parseId } from './validation';
import { sendValidationError, sendNotFoundError } from './error-handler';
import { getPaginationParams, getSkip, buildPaginationResponse } from './response-helpers';

/**
 * Helper genérico para obtener un recurso por ID
 */
export const getById = async <T>(
  req: Request,
  res: Response,
  model: any,
  include?: any,
  resourceName: string = 'Recurso'
): Promise<T | null> => {
  const id = parseId(req.params.id);
  
  if (!id) {
    sendValidationError(res, `ID de ${resourceName.toLowerCase()} inválido`);
    return null;
  }

  const resource = await model.findUnique({
    where: { id },
    ...(include && { include }),
  });

  if (!resource) {
    sendNotFoundError(res, resourceName);
    return null;
  }

  return resource;
};

/**
 * Helper genérico para búsqueda paginada
 */
export const searchPaginated = async <T>(
  req: Request,
  _res: Response,
  model: any,
  where: any,
  include?: any,
  orderBy?: any
): Promise<{ data: T[]; pagination: any } | null> => {
  const { pagina, limite } = getPaginationParams(req);
  const skip = getSkip(pagina, limite);

  const [data, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: limite,
      ...(include && { include }),
      ...(orderBy && { orderBy }),
    }),
    model.count({ where }),
  ]);

  return {
    data,
    pagination: buildPaginationResponse(total, pagina, limite),
  };
};

/**
 * Helper para filtrar valores undefined de un objeto
 */
export const filterUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
};

/**
 * Helper para normalizar valores para comparación
 */
const normalizeValue = (value: any): any => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Normalizar fechas: comparar solo la fecha (sin hora)
  if (value instanceof Date) {
    // Verificar que sea una fecha válida
    if (isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().split('T')[0]; // Solo YYYY-MM-DD
  }
  
  // Si es string que parece fecha ISO o fecha en cualquier formato, normalizar
  if (typeof value === 'string') {
    // Intentar parsear como fecha
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch {
      // No es una fecha válida, continuar con el procesamiento normal
    }
  }
  
  return value;
};

/**
 * Helper para detectar cambios entre objetos
 * Excluye campos derivados como 'asignado_a' que se actualizan automáticamente
 * Solo compara campos que están presentes en newValues (no todos los campos de oldValues)
 */
export const detectChanges = <T extends Record<string, any>>(
  oldValues: T,
  newValues: Partial<T>
): Array<{ campo: string; valorAnterior: any; valorNuevo: any }> => {
  // Campos que no deben registrarse como cambios (son derivados o relaciones)
  const camposDerivados = ['asignado_a', 'etiquetas', 'usuario', 'proyecto', 'archivos', 'comentarios'];
  
  // Solo comparar campos que están en newValues (los que se están actualizando)
  return Object.keys(newValues)
    .filter(field => {
      // Excluir campos derivados y relaciones
      if (camposDerivados.includes(field)) {
        return false;
      }
      
      // Solo comparar si el campo existe en oldValues
      if (!(field in oldValues)) {
        // Campo nuevo, siempre es un cambio
        return true;
      }
      
      const oldVal = normalizeValue(oldValues[field]);
      const newVal = normalizeValue(newValues[field]);
      
      // Comparar valores normalizados
      return oldVal !== newVal;
    })
    .map(field => ({
      campo: field,
      valorAnterior: oldValues[field] ?? null,
      valorNuevo: newValues[field] ?? null,
    }));
};

/**
 * Helpers genéricos para construcción de filtros WHERE de Prisma.
 * Reduce duplicación de código en helpers específicos de entidades.
 */

/**
 * Construye un filtro WHERE para búsqueda por ID numérico
 */
export const buildIdFilter = (id?: string | number): number | undefined => {
  if (!id) return undefined;
  const parsed = typeof id === 'string' ? parseId(id) : id;
  return parsed || undefined;
};

/**
 * Construye un filtro WHERE para búsqueda por campo de texto (contains)
 */
export const buildTextFilter = (value?: string): { contains: string } | undefined => {
  if (!value) return undefined;
  return { contains: value };
};

/**
 * Construye un filtro WHERE para búsqueda por campo exacto
 */
export const buildExactFilter = <T>(value?: T): T | undefined => {
  return value || undefined;
};

/**
 * Construye un filtro WHERE para búsqueda por array de IDs
 */
export const buildIdsFilter = (ids?: (string | number)[]): number[] | undefined => {
  if (!ids || ids.length === 0) return undefined;
  const parsed = ids
    .map(id => typeof id === 'string' ? parseId(id) : id)
    .filter((id): id is number => id !== null);
  return parsed.length > 0 ? parsed : undefined;
};

/**
 * Valida y parsea un ID de parámetros de request
 * Envía error de validación si el ID es inválido
 * @returns El ID parseado o null si es inválido
 */
export const validateAndParseId = (
  req: Request,
  res: Response,
  paramName: string = 'id',
  resourceName: string = 'Recurso'
): number | null => {
  const id = parseId(req.params[paramName]);
  
  if (!id) {
    sendValidationError(res, `ID de ${resourceName.toLowerCase()} inválido`);
    return null;
  }
  
  return id;
};

/**
 * Valida y parsea múltiples IDs de parámetros de request
 * Envía error de validación si algún ID es inválido
 * @returns Objeto con los IDs parseados o null si alguno es inválido
 */
export const validateAndParseIds = (
  req: Request,
  res: Response,
  params: Array<{ paramName: string; resourceName: string }>
): Record<string, number> | null => {
  const ids: Record<string, number> = {};
  
  for (const { paramName, resourceName } of params) {
    const id = parseId(req.params[paramName] || req.body[paramName]);
    
    if (!id) {
      sendValidationError(res, `ID de ${resourceName.toLowerCase()} inválido`);
      return null;
    }
    
    ids[paramName] = id;
  }
  
  return ids;
};

/**
 * Obtiene un recurso anterior antes de actualizar
 * Valida el ID, obtiene el recurso y verifica su existencia
 * @returns El recurso anterior o null si no existe o el ID es inválido
 */
export const getResourceBeforeUpdate = async <T>(
  req: Request,
  res: Response,
  model: any,
  paramName: string = 'id',
  resourceName: string = 'Recurso',
  select?: any
): Promise<T | null> => {
  const id = validateAndParseId(req, res, paramName, resourceName);
  if (!id) return null;
  
  const resource = await model.findUnique({
    where: { id },
    ...(select && { select }),
  });
  
  if (!resource) {
    sendNotFoundError(res, resourceName);
    return null;
  }
  
  return resource;
};

/**
 * Helper genérico para obtener y validar un recurso por ID
 * Puede usarse con cualquier modelo de Prisma
 * @param model - Modelo de Prisma (ej: prisma.etiqueta, prisma.comentario)
 * @param resourceId - ID del recurso
 * @param res - Objeto Response de Express
 * @param resourceName - Nombre del recurso para mensajes de error
 * @param select - Campos a seleccionar (opcional)
 * @returns El recurso encontrado o null si no existe
 */
export const getAndValidateResource = async <T>(
  model: any,
  resourceId: number,
  res: Response,
  resourceName: string = 'Recurso',
  select?: any
): Promise<T | null> => {
  const resource = await model.findUnique({
    where: { id: resourceId },
    ...(select && { select }),
  });

  if (!resource) {
    sendNotFoundError(res, resourceName);
    return null;
  }

  return resource;
};

