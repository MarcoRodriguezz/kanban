/**
 * Rutas para gestión de issues
 */
import { Router } from 'express';
import {
  obtenerIssues,
  crearIssue,
  actualizarEstadoIssue,
} from '../controllers/issue.controller';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireAnyRole);

router.get('/', obtenerIssues);
router.post('/', crearIssue);
router.patch('/:id/estado', actualizarEstadoIssue);

export default router;

