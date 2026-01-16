/**
 * Rutas para gestión de repositorios de GitHub vinculados a proyectos
 */
import { Router } from 'express';
import {
  obtenerRepositorios,
  crearRepositorio,
  actualizarRepositorio,
  eliminarRepositorio,
} from '../controllers/repositorio.controller';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { crearRepositorioSchema, actualizarRepositorioSchema } from '../validations/repositorio.validation';

const router = Router();

router.get(
  '/',
  authenticateToken,
  requireAnyRole,
  obtenerRepositorios
);

router.post(
  '/',
  authenticateToken,
  requireAnyRole,
  validate(crearRepositorioSchema),
  crearRepositorio
);

router.put(
  '/:id',
  authenticateToken,
  requireAnyRole,
  validate(actualizarRepositorioSchema),
  actualizarRepositorio
);

router.delete(
  '/:id',
  authenticateToken,
  requireAnyRole,
  eliminarRepositorio
);

export default router;

