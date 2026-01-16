/**
 * Schemas de validación Zod para consultas de actividades: filtros por entidad, usuario y paginación.
 * Valida tipos de entidades permitidas y parámetros de búsqueda para el log de auditoría.
 */
import { z } from 'zod';
import { positiveIdFromStringSchema } from './validation-helpers';

export const buscarActividadesQuerySchema = z.object({
  entidad: z.enum(['Tarea', 'Proyecto', 'Comentario', 'Archivo', 'Etiqueta']).optional(),
  usuarioId: positiveIdFromStringSchema(),
  fechaInicio: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const fecha = new Date(val);
      return isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
    }),
  fechaFin: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const fecha = new Date(val);
      return isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
    }),
  pagina: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;
    })
    .pipe(z.number().int().min(1)),
  limite: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '50', 10);
      if (isNaN(num) || num < 1) return 50;
      return num > 100 ? 50 : num;
    })
    .pipe(z.number().int().min(1).max(100)),
});

export type BuscarActividadesQuery = z.infer<typeof buscarActividadesQuerySchema>;

export const buscarMisActividadesQuerySchema = z.object({
  fechaInicio: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const fecha = new Date(val);
      return isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
    }),
  fechaFin: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const fecha = new Date(val);
      return isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
    }),
  pagina: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;
    })
    .pipe(z.number().int().min(1)),
  limite: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '50', 10);
      if (isNaN(num) || num < 1) return 50;
      return num > 100 ? 50 : num;
    })
    .pipe(z.number().int().min(1).max(100)),
});

export type BuscarMisActividadesQuery = z.infer<typeof buscarMisActividadesQuerySchema>;

export const buscarActividadesProyectoSchema = z.object({
  fechaInicio: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const fecha = new Date(val);
      return isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
    }),
  fechaFin: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const fecha = new Date(val);
      return isNaN(fecha.getTime()) ? undefined : fecha.toISOString();
    }),
  pagina: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;
    })
    .pipe(z.number().int().min(1)),
  limite: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '100', 10);
      if (isNaN(num) || num < 1) return 100;
      return num > 200 ? 200 : num;
    })
    .pipe(z.number().int().min(1).max(200)),
});

export type BuscarActividadesProyectoQuery = z.infer<typeof buscarActividadesProyectoSchema>;

