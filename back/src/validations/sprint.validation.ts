/**
 * Schemas de validación Zod para sprints: crear, actualizar y buscar sprints.
 */
import { z } from 'zod';
import { stringSchema, optionalStringSchema, positiveIdSchema, requiredDateSchema } from './validation-helpers';

export const crearSprintSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre').trim(),
  descripcion: optionalStringSchema(5000, 'La descripción').nullable(),
  fecha_inicio: requiredDateSchema(),
  fecha_fin: requiredDateSchema(),
  estado: z.enum(['Pendiente', 'En_progreso', 'Completado']).optional().default('Pendiente'),
  proyectoId: positiveIdSchema('ID del proyecto'),
}).refine((data) => {
  return new Date(data.fecha_fin) >= new Date(data.fecha_inicio);
}, {
  message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
  path: ['fecha_fin'],
});

export const actualizarSprintSchema = crearSprintSchema.partial().extend({
  proyectoId: positiveIdSchema('ID del proyecto').optional(),
}).refine((data) => {
  if (data.fecha_inicio && data.fecha_fin) {
    return new Date(data.fecha_fin) >= new Date(data.fecha_inicio);
  }
  return true;
}, {
  message: 'La fecha de fin debe ser posterior o igual a la fecha de inicio',
  path: ['fecha_fin'],
});

export type CrearSprintInput = z.infer<typeof crearSprintSchema>;
export type ActualizarSprintInput = z.infer<typeof actualizarSprintSchema>;

