/**
 * Schemas de validación Zod para componentes: crear, actualizar y buscar componentes.
 */
import { z } from 'zod';
import { stringSchema, optionalStringSchema, positiveIdSchema, positiveIdFromStringSchema, paginationSchema } from './validation-helpers';

/**
 * Categorías válidas de componentes
 */
export const CATEGORIAS_COMPONENTE = ['logos', 'iconos', 'ilustraciones', 'fondos'] as const;
export type CategoriaComponente = typeof CATEGORIAS_COMPONENTE[number];

/**
 * Schema para crear un componente
 */
export const crearComponenteSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre del componente'),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  categoria: z.enum(CATEGORIAS_COMPONENTE, {
    message: 'La categoría debe ser: logos, iconos, ilustraciones o fondos',
  }),
  preview: stringSchema(1, 500, 'La URL de vista previa'),
  tags: z.array(z.string()).optional().nullable(),
  proyectoId: positiveIdSchema('ID del proyecto').optional().nullable(),
});

export type CrearComponenteInput = z.infer<typeof crearComponenteSchema>;

/**
 * Schema para actualizar un componente
 */
export const actualizarComponenteSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre del componente').optional(),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable().optional(),
  categoria: z.enum(CATEGORIAS_COMPONENTE).optional(),
  preview: stringSchema(1, 500, 'La URL de vista previa').optional(),
  tags: z.array(z.string()).optional().nullable(),
  proyectoId: positiveIdSchema('ID del proyecto').optional().nullable(),
});

export type ActualizarComponenteInput = z.infer<typeof actualizarComponenteSchema>;

/**
 * Schema para query de búsqueda de componentes
 */
export const buscarComponentesQuerySchema = z.object({
  proyectoId: positiveIdFromStringSchema().optional(),
  categoria: z.enum(CATEGORIAS_COMPONENTE).optional(),
  busqueda: optionalStringSchema(100), // Búsqueda por nombre o descripción
  ...paginationSchema,
});

export type BuscarComponentesQuery = z.infer<typeof buscarComponentesQuerySchema>;

