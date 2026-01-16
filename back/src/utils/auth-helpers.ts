/**
 * Utilidades específicas para operaciones de autenticación.
 * Funciones auxiliares para tokens, contraseñas y validaciones de autenticación.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  generateToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
} from './jwt';
import { SECURITY_CONSTANTS, TIME_CONSTANTS } from './constants';
import { logger } from './logger';

/**
 * Genera un token de reset hasheado
 */
export const generateResetToken = (): { token: string; hashedToken: string } => {
  const token = crypto.randomBytes(SECURITY_CONSTANTS.RESET_TOKEN_BYTES).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hashedToken };
};

/**
 * Calcula la fecha de expiración del token de reset
 */
export const calculateResetTokenExpiry = (): Date => {
  return new Date(Date.now() + TIME_CONSTANTS.ONE_HOUR_MS);
};

/**
 * Hashea una contraseña usando bcrypt
 */
export const hashPassword = async (contraseña: string): Promise<string> => {
  return bcrypt.hash(contraseña, SECURITY_CONSTANTS.BCRYPT_ROUNDS);
};

/**
 * Verifica si una contraseña coincide con el hash
 */
export const verifyPassword = async (
  contraseña: string,
  hash: string
): Promise<boolean> => {
  // Asegurarse de que la contraseña no tenga espacios en blanco al inicio o final
  const contraseñaLimpia = contraseña.trim();
  
  // Verificar que el hash no esté vacío
  if (!hash || hash.trim().length === 0) {
    return false;
  }
  
  return bcrypt.compare(contraseñaLimpia, hash);
};

/**
 * Genera tokens de acceso y refresh, y los guarda en la base de datos
 */
export const generateAndSaveTokens = async (
  userId: number,
  email: string,
  rol: string
): Promise<{ token: string; refreshToken: string }> => {
  try {
    const token = generateToken({ userId, email, rol });
    const refreshToken = generateRefreshToken();
    const hashedRefreshToken = hashRefreshToken(refreshToken);
    const refreshTokenExpiry = getRefreshTokenExpiry();

    logger.info('Generando tokens para usuario', { email, userId });

    await prisma.usuario.update({
      where: { id: userId },
      data: {
        refreshToken: hashedRefreshToken,
        refreshTokenExpiry,
      },
    });

    logger.info('Tokens generados y guardados exitosamente', { email });

    return { token, refreshToken };
  } catch (error) {
    // Mejorar el logging de errores de Prisma
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error('Error de Prisma al generar tokens', error, { 
        email,
        userId,
        code: error.code,
        meta: error.meta,
      });
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      logger.error('Error de inicialización de Prisma al generar tokens', error, { 
        email,
        userId,
        errorCode: error.errorCode,
      });
    } else {
      logger.error('Error al generar tokens', error, { email, userId });
    }
    throw error;
  }
};

/**
 * Valida credenciales de usuario
 */
export const validateCredentials = async (
  email: string,
  contraseña: string
): Promise<{
  id: number;
  email: string;
  nombreCompleto: string;
  rol: string;
} | null> => {
  try {
    // Buscar usuario (el email ya debería estar en minúsculas y sin espacios)
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        contraseña: true,
        nombreCompleto: true,
        rol: true,
      },
    });

    if (!usuario) {
      return null;
    }

    // Verificar que la contraseña almacenada no esté vacía o mal formada
    if (!usuario.contraseña || usuario.contraseña.trim().length === 0) {
      return null;
    }

    // Verificar que el hash tenga el formato correcto de bcrypt (debe empezar con $2a$, $2b$ o $2y$)
    if (!usuario.contraseña.startsWith('$2')) {
      return null;
    }

    const isValidPassword = await verifyPassword(contraseña, usuario.contraseña);
    if (!isValidPassword) {
      return null;
    }
    return {
      id: usuario.id,
      email: usuario.email,
      nombreCompleto: usuario.nombreCompleto,
      rol: usuario.rol.toString(),
    };
  } catch (error) {
    // Mejorar el logging de errores para capturar información completa
    // Especialmente errores de Prisma relacionados con conexión a la base de datos
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error('Error de Prisma al validar credenciales', error, { 
        email,
        code: error.code,
        meta: error.meta,
      });
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      logger.error('Error de inicialización de Prisma (posible problema de conexión)', error, { 
        email,
        errorCode: error.errorCode,
      });
    } else if (error instanceof Prisma.PrismaClientRustPanicError) {
      logger.error('Error crítico de Prisma', error, { email });
    } else if (error instanceof Error) {
      logger.error('Error al validar credenciales', error, { 
        email,
        errorMessage: error.message,
        errorName: error.name,
      });
    } else {
      logger.error('Error desconocido al validar credenciales', error, { 
        email,
        errorType: typeof error,
        errorString: String(error),
      });
    }
    return null;
  }
};

/**
 * Verifica si un email ya está registrado
 */
export const isEmailRegistered = async (email: string): Promise<boolean> => {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });
  return !!usuario;
};

/**
 * Hashea un token de reset para comparación
 */
export const hashResetToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Busca un usuario por token de reset válido
 */
export const findUserByResetToken = async (
  token: string
): Promise<{ id: number; email: string } | null> => {
  const hashedToken = hashResetToken(token);

  const usuario = await prisma.usuario.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
    },
  });

  return usuario;
};

/**
 * Busca un usuario por refresh token válido
 */
export const findUserByRefreshToken = async (
  refreshToken: string
): Promise<{ id: number; email: string; rol: string } | null> => {
  const hashedToken = hashRefreshToken(refreshToken);

  const usuario = await prisma.usuario.findFirst({
    where: {
      refreshToken: hashedToken,
      refreshTokenExpiry: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      email: true,
      rol: true,
    },
  });

  return usuario ? { ...usuario, rol: usuario.rol.toString() } : null;
};

/**
 * Limpia el token de reset de un usuario
 */
export const clearResetToken = async (userId: number): Promise<void> => {
  await prisma.usuario.update({
    where: { id: userId },
    data: {
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
};

/**
 * Limpia el refresh token de un usuario
 */
export const clearRefreshToken = async (userId: number): Promise<void> => {
  await prisma.usuario.update({
    where: { id: userId },
    data: {
      refreshToken: null,
      refreshTokenExpiry: null,
    },
  });
};

/**
 * Actualiza la contraseña de un usuario y limpia el token de reset
 */
export const updatePasswordAndClearToken = async (
  userId: number,
  nuevaContraseña: string
): Promise<void> => {
  const contraseñaHash = await hashPassword(nuevaContraseña);

  await prisma.usuario.update({
    where: { id: userId },
    data: {
      contraseña: contraseñaHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });
};

