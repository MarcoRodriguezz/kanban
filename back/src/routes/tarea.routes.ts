/**
 * Rutas para gestión de tareas: CRUD completo, cambio de estados, vista Kanban y "Mi trabajo".
 * Protege endpoints con autenticación y permisos específicos según el tipo de operación.
 */
import { Router } from 'express';
import { 
  obtenerTareaPorId, 
  crearTarea, 
  actualizarTarea, 
  eliminarTarea,
  verificarPermisosEdicion,
} from '../controllers/tarea.controller';
import {
  miTrabajo,
  kanban
} from '../controllers/tarea-kanban.controller';
import {
  cambiarEstadoTarea,
  autoasignarTarea,
} from '../controllers/tarea-asignacion.controller';
import { 
  crearTareaSchema, 
  actualizarTareaSchema,
  cambiarEstadoTareaSchema,
  kanbanQuerySchema,
  miTrabajoQuerySchema
} from '../validations/tarea.validation';
import { validateQuery, validate } from '../middleware/validation.middleware';
import { 
  authenticateToken,
  canCreateTasks, 
  canEditTarea
} from '../middleware/auth.middleware';
import { requireAuth } from '../utils/response-helpers';

const router = Router();

router.get(
  '/mi-trabajo',
  ...requireAuth,
  validateQuery(miTrabajoQuerySchema),
  miTrabajo
);

router.get(
  '/kanban',
  ...requireAuth,
  validateQuery(kanbanQuerySchema),
  kanban
);

router.get(
  '/:id/permisos',
  authenticateToken,
  verificarPermisosEdicion
);

router.get(
  '/:id',
  ...requireAuth,
  obtenerTareaPorId
);

router.post(
  '/',
  authenticateToken,
  canCreateTasks,
  validate(crearTareaSchema),
  crearTarea
);

router.patch(
  '/:id/asignar',
  ...requireAuth,
  autoasignarTarea
);

router.patch(
  '/:id/estado',
  ...requireAuth,
  validate(cambiarEstadoTareaSchema),
  cambiarEstadoTarea
);

router.put(
  '/:id',
  authenticateToken,
  canEditTarea,
  validate(actualizarTareaSchema),
  actualizarTarea
);

router.delete(
  '/:id',
  authenticateToken,
  canEditTarea,
  eliminarTarea
);

export default router;