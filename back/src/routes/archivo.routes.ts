/**
 * Rutas para gestión de archivos adjuntos en tareas: crear, obtener, eliminar archivos.
 * Protege endpoints con autenticación y validación de permisos.
 */
import { Router } from 'express';
import {
  obtenerArchivosPorTarea,
  crearArchivo,
  eliminarArchivo,
} from '../controllers/archivo.controller';
import { upload } from '../middleware/upload.middleware';
import { requireAuth } from '../utils/response-helpers';

const router = Router();

router.get(
  '/tarea/:tareaId',
  ...requireAuth,
  obtenerArchivosPorTarea
);

router.post(
  '/',
  ...requireAuth,
  upload.single('archivo'),
  crearArchivo
);

router.delete(
  '/:id',
  ...requireAuth,
  eliminarArchivo
);

export default router;

