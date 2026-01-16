/**
 * Schemas de validación Zod para consultas de estadísticas: filtros opcionales por proyecto y usuario.
 * Valida IDs numéricos positivos con transformaciones para parámetros de query en endpoints de estadísticas.
 */
import { z } from 'zod';
import { positiveIdFromStringSchema } from './validation-helpers';

export const buscarEstadisticasQuerySchema = z.object({
  proyectoId: positiveIdFromStringSchema(),
  usuarioId: positiveIdFromStringSchema(),
});

export type BuscarEstadisticasQuery = z.infer<typeof buscarEstadisticasQuerySchema>;

