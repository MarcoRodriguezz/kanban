/**
 * Rutas para gestión de notificaciones
 */
import { Router } from 'express';
import {
  obtenerNotificaciones,
  obtenerConteoNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from '../controllers/notificacion.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', obtenerNotificaciones);
router.get('/conteo', obtenerConteoNotificaciones);
router.patch('/:id/leida', marcarNotificacionLeida);
router.patch('/marcar-todas-leidas', marcarTodasNotificacionesLeidas);

export default router;