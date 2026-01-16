/**
 * Rutas para estadísticas: obtener métricas generales y estadísticas específicas por proyecto.
 * Proporciona endpoints para análisis de productividad y distribución de tareas en el sistema.
 */
import { Router } from 'express';
import {
  obtenerEstadisticasProyecto,
  obtenerEstadisticasUsuario,
} from '../controllers/estadisticas.controller';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';

const router = Router();

router.get(
  '/proyecto/:id',
  authenticateToken,
  requireAnyRole,
  obtenerEstadisticasProyecto
);

router.get(
  '/usuario',
  authenticateToken,
  requireAnyRole,
  obtenerEstadisticasUsuario
);

export default router;

