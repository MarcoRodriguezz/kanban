/**
 * Rutas para gestión de comentarios: crear, actualizar, eliminar y buscar comentarios en tareas.
 * Permite acceso a cualquier usuario autenticado, con validación de autoría para edición/eliminación.
 */
import { Router } from 'express';
import {
  obtenerComentariosPorTarea,
  crearComentario,
  actualizarComentario,
  eliminarComentario,
} from '../controllers/comentario.controller';
import {
  crearComentarioSchema,
  actualizarComentarioSchema,
} from '../validations/comentario.validation';
import { validate } from '../middleware/validation.middleware';
import { requireAuth } from '../utils/response-helpers';

const router = Router();

router.get(
  '/tarea/:tareaId',
  ...requireAuth,
  obtenerComentariosPorTarea
);

router.post(
  '/',
  ...requireAuth,
  validate(crearComentarioSchema),
  crearComentario
);

router.put(
  '/:id',
  ...requireAuth,
  validate(actualizarComentarioSchema),
  actualizarComentario
);

router.delete(
  '/:id',
  ...requireAuth,
  eliminarComentario
);

export default router;

