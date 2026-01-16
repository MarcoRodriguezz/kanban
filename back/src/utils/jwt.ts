/**
 * Utilidades para manejo de tokens JWT: generación y verificación de access tokens y refresh tokens.
 * Incluye funciones para hashear refresh tokens y calcular fechas de expiración de forma segura.
 */
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { SECURITY_CONSTANTS, TIME_CONSTANTS } from './constants';

export interface TokenPayload {
  userId: number;
  email: string;
  rol: string;
}

/**
 * Genera un access token JWT
 */
export const generateToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
};

/**
 * Verifica y decodifica un access token JWT
 */
export const verifyToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expirado');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Token inválido');
    }
    throw new Error('Token inválido o expirado');
  }
};

/**
 * Genera un refresh token aleatorio y seguro
 */
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(SECURITY_CONSTANTS.RESET_TOKEN_BYTES).toString('hex');
};

/**
 * Hashea un refresh token para almacenarlo de forma segura
 */
export const hashRefreshToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Calcula la fecha de expiración del refresh token (30 días)
 */
export const getRefreshTokenExpiry = (): Date => {
  return new Date(Date.now() + TIME_CONSTANTS.SEVEN_DAYS_MS * 30);
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};