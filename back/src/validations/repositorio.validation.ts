/**
 * Schemas de validación Zod para repositorios de GitHub
 */
import { z } from 'zod';
import { stringSchema, optionalStringSchema, positiveIdSchema } from './validation-helpers';

export const crearRepositorioSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre').trim(),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  url: z
    .string()
    .min(1, 'La URL es requerida')
    .max(500, 'La URL no puede exceder 500 caracteres')
    .url('La URL debe ser válida'),
  tipo: z.enum(['github', 'design', 'documentation', 'other']).optional().default('github'),
  proyectoId: positiveIdSchema('ID del proyecto'),
}).refine((data) => {
  // Si es GitHub, validar formato de URL
  if (data.tipo === 'github') {
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/\s]+/;
    return githubUrlPattern.test(data.url);
  }
  return true;
}, {
  message: 'URL de GitHub inválida. Debe ser: https://github.com/owner/repo',
  path: ['url'],
});

export const actualizarRepositorioSchema = z.object({
  nombre: z
    .string()
    .max(255, 'El nombre no puede exceder 255 caracteres')
    .trim()
    .optional(),
  descripcion: z
    .string()
    .max(5000, 'La descripción no puede exceder 5000 caracteres')
    .trim()
    .optional()
    .nullable(),
  url: z
    .string()
    .min(1, 'La URL es requerida')
    .max(500, 'La URL no puede exceder 500 caracteres')
    .url('La URL debe ser válida')
    .optional(),
  tipo: z.enum(['github', 'design', 'documentation', 'other']).optional(),
  activo: z.boolean().optional(),
}).refine((data) => {
  // Si se actualiza la URL y es GitHub, validar formato
  if (data.url && data.tipo === 'github') {
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/\s]+/;
    return githubUrlPattern.test(data.url);
  }
  return true;
}, {
  message: 'URL de GitHub inválida. Debe ser: https://github.com/owner/repo',
  path: ['url'],
}).refine((data) => {
  // Asegurar que al menos un campo esté presente
  return Object.keys(data).length > 0;
}, {
  message: 'Debe proporcionar al menos un campo para actualizar',
});

export type CrearRepositorioInput = z.infer<typeof crearRepositorioSchema>;
export type ActualizarRepositorioInput = z.infer<typeof actualizarRepositorioSchema>;

