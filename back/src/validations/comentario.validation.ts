/**
 * Schemas de validación Zod para comentarios: crear, actualizar y buscar comentarios en tareas.
 * Valida contenido de comentarios y parámetros de búsqueda con paginación para listados.
 */
import { z } from 'zod';
import { stringSchema, positiveIdSchema, positiveIdFromStringSchema, paginationSchema } from './validation-helpers';

/**
 * Schema para crear un comentario
 */
export const crearComentarioSchema = z.object({
  contenido: stringSchema(1, 5000, 'El contenido del comentario'),
  tareaId: positiveIdSchema('ID de la tarea'),
});

export type CrearComentarioInput = z.infer<typeof crearComentarioSchema>;

/**
 * Schema para actualizar un comentario
 */
export const actualizarComentarioSchema = z.object({
  contenido: stringSchema(1, 5000, 'El contenido del comentario'),
});

export type ActualizarComentarioInput = z.infer<typeof actualizarComentarioSchema>;

/**
 * Schema para query de búsqueda de comentarios
 */
export const buscarComentariosQuerySchema = z.object({
  tareaId: positiveIdFromStringSchema(),
  ...paginationSchema,
});

export type BuscarComentariosQuery = z.infer<typeof buscarComentariosQuerySchema>;

