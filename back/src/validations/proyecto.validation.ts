/**
 * Schemas de validación Zod para proyectos: crear, actualizar y buscar proyectos con filtros.
 * Valida fechas, gestores, equipos y proporciona tipos TypeScript para todas las operaciones de proyectos.
 */
import { z } from 'zod';
import { stringSchema, optionalStringSchema, positiveIdSchema, requiredDateSchema, optionalDateSchema } from './validation-helpers';

// Esquema para crear proyecto
export const crearProyectoSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre').trim(),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  responsable: stringSchema(1, 255, 'El responsable').trim(),
  equipo: stringSchema(1, 255, 'El equipo').trim(),
  fecha_inicio: requiredDateSchema(),
  fecha_fin: optionalDateSchema(),
  gestorId: positiveIdSchema('ID del gestor'),
});

export const actualizarProyectoSchema = crearProyectoSchema.partial();

export const buscarProyectosQuerySchema = z.object({
  gestor: z
    .union([z.string(), z.undefined()])
    .optional()
    .transform((val) => {
      if (!val || val === '') return undefined;
      const num = parseInt(val, 10);
      return isNaN(num) || num < 1 ? undefined : num;
    })
    .pipe(z.number().int().positive().optional()),
  responsable: optionalStringSchema(255, 'El responsable'),
  pagina: z
    .union([z.string(), z.undefined()])
    .optional()
    .default('1')
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;
    })
    .pipe(z.number().int().min(1)),
  limite: z
    .union([z.string(), z.undefined()])
    .optional()
    .default('10')
    .transform((val) => {
      const num = parseInt(val || '10', 10);
      if (isNaN(num) || num < 1) return 10;
      return num > 100 ? 100 : num;
    })
    .pipe(z.number().int().min(1).max(100)),
}).passthrough();

export const cambiarGestorProyectoSchema = z.object({
  nuevoGestorId: positiveIdSchema('ID del nuevo gestor'),
});

export type CrearProyectoInput = z.infer<typeof crearProyectoSchema>;
export type ActualizarProyectoInput = z.infer<typeof actualizarProyectoSchema>;
export type BuscarProyectosQuery = z.infer<typeof buscarProyectosQuerySchema>;
export type CambiarGestorProyectoInput = z.infer<typeof cambiarGestorProyectoSchema>;

