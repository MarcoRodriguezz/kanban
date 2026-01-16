/**
 * Rutas para gestión de proyectos: CRUD completo con validación de permisos de gestores y creadores.
 * Protege endpoints con autenticación y middleware específico para verificar permisos de edición.
 */
import { Router } from 'express';
import {
  buscarProyectos,
  obtenerProyectoPorId,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
} from '../controllers/proyecto.controller';
import {
  obtenerMiembrosProyecto,
  agregarMiembroProyecto,
  removerMiembroProyecto,
  salirDelProyecto,
  cambiarRolMiembro,
  cambiarGestorProyecto,
} from '../controllers/proyecto-miembros.controller';
import {
  crearProyectoSchema,
  actualizarProyectoSchema,
  cambiarGestorProyectoSchema,
} from '../validations/proyecto.validation';
import {validate } from '../middleware/validation.middleware';
import {
  authenticateToken,
  requireAnyRole,
  requireAdmin,
  canEditProyecto,
} from '../middleware/auth.middleware';
import { requireAuth } from '../utils/response-helpers';

const router = Router();

router.get('/', authenticateToken, requireAnyRole, buscarProyectos);
router.get('', authenticateToken, requireAnyRole, buscarProyectos);

router.post(
  '/',
  ...requireAuth,
  requireAdmin,
  validate(crearProyectoSchema),
  crearProyecto
);

router.get(
  '/:id',
  ...requireAuth,
  obtenerProyectoPorId
);

router.put(
  '/:id',
  ...requireAuth,
  canEditProyecto,
  validate(actualizarProyectoSchema),
  actualizarProyecto
);

router.get(
  '/:id/miembros',
  ...requireAuth,
  obtenerMiembrosProyecto
);

router.post(
  '/:id/miembros',
  ...requireAuth,
  canEditProyecto,
  agregarMiembroProyecto
);

router.delete(
  '/:id/miembros/:usuarioId',
  ...requireAuth,
  canEditProyecto,
  removerMiembroProyecto
);

router.post(
  '/:id/salir',
  ...requireAuth,
  salirDelProyecto
);

router.patch(
  '/:id/miembros/:usuarioId/rol',
  ...requireAuth,
  canEditProyecto,
  cambiarRolMiembro
);

router.patch(
  '/:id/gestor',
  ...requireAuth,
  validate(cambiarGestorProyectoSchema),
  cambiarGestorProyecto
);

router.delete(
  '/:id',
  ...requireAuth,
  canEditProyecto,
  eliminarProyecto
);

export default router;

