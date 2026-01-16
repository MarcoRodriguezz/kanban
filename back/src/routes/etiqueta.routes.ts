/**
 * Rutas para gestión de etiquetas: CRUD de etiquetas y asociación/desasociación con tareas.
 * Requiere permisos de administrador o gestor para crear/editar etiquetas, y permisos de tarea para asociarlas.
 */
import { Router } from 'express';
import {
  obtenerTodasLasEtiquetas,
  crearEtiqueta,
  asociarEtiquetasATarea,
} from '../controllers/etiqueta.controller';
import {
  crearEtiquetaSchema,
  asociarEtiquetasSchema,
} from '../validations/etiqueta.validation';
import { validate } from '../middleware/validation.middleware';
import {
  requireAdmin,
} from '../middleware/auth.middleware';
import { requireAuth } from '../utils/response-helpers';

const router = Router();

router.get('/todas', ...requireAuth, obtenerTodasLasEtiquetas);

router.post(
  '/',
  ...requireAuth,
  requireAdmin,
  validate(crearEtiquetaSchema),
  crearEtiqueta
);

router.post(
  '/tarea/:tareaId/asociar',
  ...requireAuth,
  validate(asociarEtiquetasSchema),
  asociarEtiquetasATarea
);

export default router;

