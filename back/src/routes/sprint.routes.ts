/**
 * Rutas para gestión de sprints: CRUD completo.
 */
import { Router } from 'express';
import {
  crearSprint,
  actualizarSprint,
  eliminarSprint,
} from '../controllers/sprint.controller';
import { requireAuth } from '../utils/response-helpers';
import { validate } from '../middleware/validation.middleware';
import { crearSprintSchema, actualizarSprintSchema } from '../validations/sprint.validation';

const router = Router();

router.post('/', ...requireAuth, validate(crearSprintSchema), crearSprint);
router.put('/:id', ...requireAuth, validate(actualizarSprintSchema), actualizarSprint);
router.delete('/:id', ...requireAuth, eliminarSprint);

export default router;

