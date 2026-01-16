/**
 * Rutas para consulta de actividades de auditoría: buscar actividades por entidad, usuario y obtener historial personal.
 * Solo administradores y gestores pueden acceder
 * Proporciona acceso al log de actividades con paginación y filtros para análisis y trazabilidad.
 */
import { Router } from 'express';
import {
  obtenerActividades,
  obtenerActividadesProyecto,
} from '../controllers/actividad.controller';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import {
  buscarActividadesQuerySchema,
  buscarActividadesProyectoSchema,
} from '../validations/actividad.validation';

const router = Router();

router.get(
  '/',
  authenticateToken,
  requireAnyRole,
  validateQuery(buscarActividadesQuerySchema),
  obtenerActividades
);

router.get(
  '/de-proyecto/:proyectoId',
  authenticateToken,
  requireAnyRole,
  validateQuery(buscarActividadesProyectoSchema),
  obtenerActividadesProyecto
);

export default router;

