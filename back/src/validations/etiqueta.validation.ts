/**
 * Schemas de validación Zod para etiquetas: crear, actualizar, buscar y asociar etiquetas a tareas.
 * Valida nombres únicos, colores hexadecimales y listas de IDs para operaciones de asociación masiva.
 */
import { z } from 'zod';
import { stringSchema, optionalStringSchema, positiveIdSchema, paginationSchema } from './validation-helpers';

/**
 * Schema para crear una etiqueta
 */
export const crearEtiquetaSchema = z.object({
  nombre: stringSchema(1, 100, 'El nombre de la etiqueta'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un código hexadecimal válido (ej: #FF5733)')
    .optional()
    .nullable(),
});

export type CrearEtiquetaInput = z.infer<typeof crearEtiquetaSchema>;

/**
 * Schema para actualizar una etiqueta
 */
export const actualizarEtiquetaSchema = z.object({
  nombre: stringSchema(1, 100, 'El nombre de la etiqueta').optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un código hexadecimal válido (ej: #FF5733)')
    .optional()
    .nullable(),
});

export type ActualizarEtiquetaInput = z.infer<typeof actualizarEtiquetaSchema>;

/**
 * Schema para asociar/desasociar etiquetas a una tarea
 * Permite array vacío para eliminar todas las etiquetas
 */
export const asociarEtiquetasSchema = z.object({
  etiquetaIds: z
    .array(positiveIdSchema('ID de etiqueta'))
    .default([]),
});

export type AsociarEtiquetasInput = z.infer<typeof asociarEtiquetasSchema>;

/**
 * Schema para query de búsqueda de etiquetas
 */
export const buscarEtiquetasQuerySchema = z.object({
  nombre: optionalStringSchema(100),
  ...paginationSchema,
});

export type BuscarEtiquetasQuery = z.infer<typeof buscarEtiquetasQuerySchema>;

