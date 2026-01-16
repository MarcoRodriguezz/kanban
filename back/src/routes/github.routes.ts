/**
 * Rutas para integración con GitHub: obtener commits de repositorios vinculados a proyectos
 */
import { Router } from 'express';
import { getProjectCommits } from '../controllers/github.controller';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';

const router = Router();

router.get(
  '/projects/:projectId/commits',
  authenticateToken,
  requireAnyRole,
  getProjectCommits
);

export default router;

