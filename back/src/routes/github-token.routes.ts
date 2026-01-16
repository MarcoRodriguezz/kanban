/**
 * Rutas para gestión de tokens de GitHub: CRUD de tokens cifrados
 * Todos los usuarios autenticados pueden gestionar tokens (los tokens se cifran automáticamente)
 */
import { Router } from 'express';
import {
  listarTokens,
  crearToken,
  actualizarToken,
  eliminarToken,
} from '../controllers/github-token.controller';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  crearGitHubTokenSchema,
  actualizarGitHubTokenSchema,
} from '../validations/github.validation';

const router = Router();

router.use(authenticateToken);
router.use(requireAnyRole);

router.get('/', listarTokens);
router.post('/', validate(crearGitHubTokenSchema), crearToken);
router.put('/:id', validate(actualizarGitHubTokenSchema), actualizarToken);
router.delete('/:id', eliminarToken);

export default router;

