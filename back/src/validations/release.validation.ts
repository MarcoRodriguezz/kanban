/**
 * Schemas de validación Zod para releases: crear, actualizar y buscar releases.
 */
import { z } from 'zod';
import { stringSchema, optionalStringSchema, positiveIdSchema, requiredDateSchema, positiveIdFromStringSchema } from './validation-helpers';

export const crearReleaseSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre').trim(),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  fecha_inicio: requiredDateSchema(),
  fecha_lanzamiento: requiredDateSchema(),
  estado: z.enum(['En_progreso', 'Sin_lanzar', 'Publicado']).optional().default('Sin_lanzar'),
  estadoFrontend: z.enum(['En progreso', 'Sin lanzar', 'Publicado']).optional(),
  proyectoId: positiveIdSchema('ID del proyecto'),
}).refine((data) => {
  return new Date(data.fecha_lanzamiento) >= new Date(data.fecha_inicio);
}, {
  message: 'La fecha de lanzamiento debe ser posterior o igual a la fecha de inicio',
  path: ['fecha_lanzamiento'],
});

export const actualizarReleaseSchema = crearReleaseSchema.partial().extend({
  proyectoId: positiveIdSchema('ID del proyecto').optional(),
  estadoFrontend: z.enum(['En progreso', 'Sin lanzar', 'Publicado']).optional(),
}).refine((data) => {
  if (data.fecha_inicio && data.fecha_lanzamiento) {
    return new Date(data.fecha_lanzamiento) >= new Date(data.fecha_inicio);
  }
  return true;
}, {
  message: 'La fecha de lanzamiento debe ser posterior o igual a la fecha de inicio',
  path: ['fecha_lanzamiento'],
});

export const buscarReleasesQuerySchema = z.object({
  proyecto: positiveIdFromStringSchema(),
  estado: z.string().optional(),
  pagina: z
    .string()
    .optional()
    .default('1')
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;
    })
    .pipe(z.number().int().min(1)),
  limite: z
    .string()
    .optional()
    .default('10')
    .transform((val) => {
      const num = parseInt(val || '10', 10);
      if (isNaN(num) || num < 1) return 10;
      return num > 100 ? 100 : num;
    })
    .pipe(z.number().int().min(1).max(100)),
});

export type CrearReleaseInput = z.infer<typeof crearReleaseSchema>;
export type ActualizarReleaseInput = z.infer<typeof actualizarReleaseSchema>;
export type BuscarReleasesQuery = z.infer<typeof buscarReleasesQuerySchema>;

