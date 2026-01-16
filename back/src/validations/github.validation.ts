/**
 * Schemas de validación Zod para gestión de tokens de GitHub
 */
import { z } from 'zod';
import { stringSchema } from './validation-helpers';

export const crearGitHubTokenSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre').trim(),
  token: stringSchema(10, 200, 'El token de GitHub'),
  proyectoId: z.number().int().positive('El ID del proyecto debe ser un número positivo'),
});

export const actualizarGitHubTokenSchema = z.object({
  nombre: stringSchema(1, 255, 'El nombre').trim().optional(),
  activo: z.boolean().optional(),
});

export type CrearGitHubTokenInput = z.infer<typeof crearGitHubTokenSchema>;
export type ActualizarGitHubTokenInput = z.infer<typeof actualizarGitHubTokenSchema>;

