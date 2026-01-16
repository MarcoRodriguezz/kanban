/**
 * Schemas de validación Zod para tareas: crear, actualizar, cambiar estado, búsqueda y filtros Kanban.
 * Valida estados, prioridades, fechas y parámetros de paginación con transformaciones y valores por defecto.
 */
import { z } from 'zod';
import { positiveIdFromStringSchema, paginationSchema, stringSchema, optionalStringSchema, positiveIdSchema, optionalDateSchema } from './validation-helpers';

const estadosTarea = ['Pendiente', 'En_progreso', 'En_revision', 'Completado'] as const;


const tareaBaseSchema = z.object({
  titulo: stringSchema(1, 255, 'El título'),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  estado: z.enum(estadosTarea, {
    message: 'El estado debe ser: Pendiente, En_progreso, En_revision o Completado',
  }).default('Pendiente'),
  prioridad: stringSchema(1, 50, 'La prioridad'),
  asignado_a: stringSchema(1, 255, 'El campo asignado_a'),
  proyectoId: positiveIdSchema('ID del proyecto'),
  usuarioId: z.union([
    positiveIdSchema('ID del usuario'),
    z.null(),
  ]).nullable().optional(),
  fecha_limite: optionalDateSchema(),
});

// Schema para crear: asignado_a NO se incluye porque el backend lo establece automáticamente
// Creamos un schema nuevo sin asignado_a y usamos strip para eliminar campos desconocidos
export const crearTareaSchema = z.object({
  titulo: stringSchema(1, 255, 'El título'),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  estado: z.enum(estadosTarea, {
    message: 'El estado debe ser: Pendiente, En_progreso, En_revision o Completado',
  }).default('Pendiente'),
  prioridad: stringSchema(1, 50, 'La prioridad'),
  proyectoId: positiveIdSchema('ID del proyecto'),
  usuarioId: z.union([
    positiveIdSchema('ID del usuario'),
    z.null(),
  ]).nullable().optional(),
  fecha_limite: optionalDateSchema(),
}).strip();

export type CrearTareaInput = z.infer<typeof crearTareaSchema>;

// Schema para actualizar: todos los campos son opcionales, y asignado_a puede ser string vacío
export const actualizarTareaSchema = tareaBaseSchema.partial().extend({
  asignado_a: z
    .union([
      z.string().min(1).max(255, 'El campo asignado_a no puede exceder 255 caracteres'),
      z.literal('').transform(() => null),
      z.null(),
    ])
    .optional(),
});

export type ActualizarTareaInput = z.infer<typeof actualizarTareaSchema>;


export const cambiarEstadoTareaSchema = z.object({
  estado: z.enum(estadosTarea, {
    message: 'El estado debe ser: Pendiente, En_progreso, En_revision o Completado',
  }),
});

export type CambiarEstadoTareaInput = z.infer<typeof cambiarEstadoTareaSchema>;

export const kanbanQuerySchema = z.object({
  proyectoId: positiveIdFromStringSchema(),
  usuarioId: positiveIdFromStringSchema(),
});

export type KanbanQuery = z.infer<typeof kanbanQuerySchema>;

export const miTrabajoQuerySchema = z.object({
  estado: z.enum(estadosTarea, {
    message: 'El estado debe ser: Pendiente, En_progreso, En_revision o Completado',
  }).optional(),
  prioridad: optionalStringSchema(50, 'La prioridad'),
  proyectoId: positiveIdFromStringSchema(),
  ...paginationSchema,
});

export type MiTrabajoQuery = z.infer<typeof miTrabajoQuerySchema>;