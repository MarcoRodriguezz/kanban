/**
 * Helpers genéricos reutilizables para validaciones Zod.
 * Reduce duplicación de código en schemas de validación.
 */
import { z } from 'zod';

/**
 * Constantes para paginación
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Helper para parsear enteros positivos desde strings
 */
export const parsePositiveInt = (val: string | undefined, defaultValue?: number): number | undefined => {
  if (!val || val === '') return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) || num < 1 ? defaultValue : num;
};

/**
 * Schema genérico para paginación (pagina y limite)
 */
export const paginationSchema = {
  pagina: z
    .string()
    .optional()
    .transform((val) => parsePositiveInt(val, PAGINATION_DEFAULTS.DEFAULT_PAGE) ?? PAGINATION_DEFAULTS.DEFAULT_PAGE)
    .pipe(z.number().int().min(1)),
  limite: z
    .string()
    .optional()
    .transform((val) => {
      const parsed = parsePositiveInt(val, PAGINATION_DEFAULTS.DEFAULT_LIMIT);
      const maxLimit = parsed && parsed > PAGINATION_DEFAULTS.MAX_LIMIT 
        ? PAGINATION_DEFAULTS.DEFAULT_LIMIT 
        : (parsed ?? PAGINATION_DEFAULTS.DEFAULT_LIMIT);
      return maxLimit;
    })
    .pipe(z.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT)),
};

/**
 * Schema para ID positivo opcional desde string
 */
export const positiveIdFromStringSchema = (defaultValue?: number) =>
  z
    .string()
    .optional()
    .transform((val) => parsePositiveInt(val, defaultValue))
    .pipe(z.number().int().positive().optional());

/**
 * Schema para ID positivo requerido desde string
 */
export const positiveIdFromStringRequiredSchema = () =>
  z
    .string()
    .transform((val) => {
      const num = parsePositiveInt(val);
      if (!num) throw new Error('ID inválido');
      return num;
    })
    .pipe(z.number().int().positive());

/**
 * Schema para string con longitud mínima y máxima
 */
export const stringSchema = (min: number, max: number, fieldName: string = 'campo') =>
  z
    .string()
    .min(min, `${fieldName} es requerido`)
    .max(max, `${fieldName} no puede exceder ${max} caracteres`);

/**
 * Schema para string opcional con longitud máxima
 */
export const optionalStringSchema = (max: number, fieldName: string = 'campo') =>
  z
    .string()
    .max(max, `${fieldName} no puede exceder ${max} caracteres`)
    .optional();

/**
 * Schema para email
 */
export const emailSchema = z
  .string('El email debe ser un texto')
  .email('El email debe tener un formato válido')
  .min(1, 'El email es requerido')
  .max(255, 'El email es demasiado largo')
  .toLowerCase()
  .trim();

/**
 * Schema para contraseña con validación de complejidad
 */
export const passwordSchema = (minLength: number = 6, maxLength: number = 100) =>
  z
    .string('La contraseña debe ser un texto')
    .min(minLength, `La contraseña debe tener al menos ${minLength} caracteres`)
    .max(maxLength, `La contraseña es demasiado larga`)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    );

/**
 * Schema para contraseña simple (sin regex)
 */
export const simplePasswordSchema = (minLength: number = 6, maxLength: number = 50) =>
  z
    .string('La contraseña debe ser un texto')
    .min(minLength, `La contraseña debe tener al menos ${minLength} caracteres`)
    .max(maxLength, `La contraseña es demasiado larga`);

/**
 * Schema para ID numérico positivo
 */
export const positiveIdSchema = (fieldName: string = 'ID') =>
  z.number().int().positive(`El ${fieldName} debe ser un número positivo`);

/**
 * Schema para fecha/datetime opcional
 */
export const optionalDateSchema = () =>
  z
    .union([
      z.string().datetime('La fecha debe ser una fecha válida'),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido').transform((val) => {
        // Convertir fecha YYYY-MM-DD a ISO datetime
        return new Date(val + 'T00:00:00.000Z').toISOString();
      }),
      z.date(),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === null || val === undefined) return null;
      return typeof val === 'string' ? new Date(val) : val;
    });

/**
 * Schema para fecha/datetime requerida
 */
export const requiredDateSchema = () =>
  z
    .union([
      z.string().datetime('La fecha debe ser una fecha válida'),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido').transform((val) => {
        // Convertir fecha YYYY-MM-DD a ISO datetime
        return new Date(val + 'T00:00:00.000Z').toISOString();
      }),
      z.date(),
    ])
    .transform((val) => {
      if (typeof val === 'string') {
        // Si ya es ISO datetime, convertir a Date directamente
        return new Date(val);
      }
      return val;
    });

