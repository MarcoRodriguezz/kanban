/**
 * Helpers para construcción de respuestas HTTP: paginación, extracción de parámetros y construcción de respuestas de usuario.
 * Funciones reutilizables para normalizar respuestas y validar usuarios autenticados en controladores.
 * También incluye helpers para rutas (middleware chains comunes).
 */
import { Response, Request, RequestHandler } from 'express';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';

/**
 * Constantes para valores por defecto de paginación
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Interfaz para parámetros de paginación
 */
export interface PaginationParams {
  pagina: number;
  limite: number;
}

/**
 * Interfaz para respuesta de paginación
 */
export interface PaginationResponse {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
  tieneSiguiente: boolean;
  tieneAnterior: boolean;
}

/**
 * Extrae y normaliza parámetros de paginación del query string
 */
export const getPaginationParams = (req: Request): PaginationParams => {
  const pagina = Math.max(1, Number(req.query.pagina) || DEFAULT_PAGE);
  const limite = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(req.query.limite) || DEFAULT_LIMIT)
  );
  return { pagina, limite };
};

/**
 * Calcula el skip para la paginación
 */
export const getSkip = (pagina: number, limite: number): number => {
  return (pagina - 1) * limite;
};

/**
 * Construye la respuesta de paginación
 */
export const buildPaginationResponse = (
  total: number,
  pagina: number,
  limite: number
): PaginationResponse => {
  const totalPaginas = Math.ceil(total / limite);
  return {
    pagina,
    limite,
    total,
    totalPaginas,
    tieneSiguiente: pagina < totalPaginas,
    tieneAnterior: pagina > 1,
  };
};

/**
 * Obtiene el userId del request autenticado o lanza error
 */
export const getAuthenticatedUserId = (req: Request): number => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new Error('Usuario no autenticado');
  }
  return userId;
};

/**
 * Valida que el usuario esté autenticado y retorna su ID
 * Si no está autenticado, envía respuesta de error y retorna null
 */
export const requireAuthenticatedUser = (
  req: Request,
  res: Response
): number | null => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Usuario no autenticado' });
    return null;
  }
  return userId;
};

/**
 * Verifica que el usuario esté autenticado (req.user existe)
 * Si no está autenticado, envía respuesta de error y retorna false
 */
export const requireAuthenticated = (req: Request, res: Response): boolean => {
  if (!req.user) {
    res.status(401).json({ error: 'Usuario no autenticado' });
    return false;
  }
  return true;
};

/**
 * Valida que un campo esté presente en el body
 * Si no está presente, envía respuesta de error y retorna false
 */
export const requireField = (
  field: any,
  fieldName: string,
  res: Response
): boolean => {
  if (!field) {
    res.status(400).json({ error: `${fieldName} es requerido` });
    return false;
  }
  return true;
};

/**
 * Helpers optimizados para construir respuestas de usuario
 * Versión ligera sin overhead innecesario
 */

/**
 * Calcula las iniciales de un nombre completo
 * Si tiene dos o más palabras, toma la primera letra del nombre y la primera del apellido
 * Si tiene una sola palabra, toma las dos primeras letras
 */
export const calculateUserInitials = (nombreCompleto: string): string => {
  if (!nombreCompleto || nombreCompleto.trim() === '') {
    return 'U';
  }
  
  const parts = nombreCompleto.trim().split(/\s+/);
  
  if (parts.length >= 2) {
    // Si tiene dos o más palabras, tomar primera letra del nombre y primera del último apellido
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  // Si tiene una sola palabra, tomar las dos primeras letras
  return nombreCompleto.substring(0, 2).toUpperCase();
};

export interface UserResponse {
  id: number;
  email: string;
  nombreCompleto: string;
  fotoPerfil?: string | null;
  rol: string;
  initials: string;
  createdAt?: Date;
}

interface UserInput {
  id: number;
  email: string;
  nombreCompleto: string;
  fotoPerfil?: string | null;
  rol: string | { toString(): string };
  createdAt?: Date;
}

const rolToString = (rol: string | { toString(): string }): string => {
  return typeof rol === 'string' ? rol : rol.toString();
};

/**
 * Construye respuesta de usuario
 */
export const buildUserResponse = (usuario: UserInput): UserResponse => {
  // Asegurar que fotoPerfil siempre esté presente, incluso si viene como undefined
  const fotoPerfil = usuario.fotoPerfil !== undefined && usuario.fotoPerfil !== null 
    ? usuario.fotoPerfil 
    : null;
  
  const response: UserResponse = {
    id: usuario.id,
    email: usuario.email,
    nombreCompleto: usuario.nombreCompleto,
    fotoPerfil: fotoPerfil,
    rol: rolToString(usuario.rol),
    initials: calculateUserInitials(usuario.nombreCompleto),
  };
  
  if (usuario.createdAt) {
    response.createdAt = usuario.createdAt;
  }
  
  return response;
};

/**
 * Construye respuesta de usuario sin createdAt
 */
export const buildUserResponseWithoutDates = (usuario: Omit<UserInput, 'createdAt'>): Omit<UserResponse, 'createdAt'> => {
  return {
    id: usuario.id,
    email: usuario.email,
    nombreCompleto: usuario.nombreCompleto,
    fotoPerfil: usuario.fotoPerfil || null,
    rol: rolToString(usuario.rol),
    initials: calculateUserInitials(usuario.nombreCompleto),
  };
};

/**
 * Construye respuesta de autenticación con tokens y usuario
 */
export const buildAuthResponse = (
  token: string,
  refreshToken: string,
  user: Omit<UserResponse, 'createdAt'>,
  message?: string
) => {
  const response: {
    message?: string;
    token: string;
    refreshToken: string;
    user: Omit<UserResponse, 'createdAt'>;
  } = {
    token,
    refreshToken,
    user,
  };

  if (message) {
    response.message = message;
  }

  return response;
};

/**
 * Middleware chain común para rutas que requieren autenticación básica
 * Combina authenticateToken + requireAnyRole
 */
export const requireAuth: RequestHandler[] = [
  authenticateToken,
  requireAnyRole,
];

