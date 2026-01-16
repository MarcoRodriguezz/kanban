/**
 * Rutas para gestión de releases: CRUD completo y página formateada.
 */
import { Router } from 'express';
import {
  buscarReleases,
  obtenerReleasePorId,
  crearRelease,
  actualizarRelease,
  eliminarRelease,
  obtenerDatosReleasesPage,
  calcularFechasDesdeTimeline,
} from '../controllers/release.controller';
import { requireAuth } from '../utils/response-helpers';
import { validate } from '../middleware/validation.middleware';
import { crearReleaseSchema, actualizarReleaseSchema } from '../validations/release.validation';

const router = Router();

// Ruta especial para página de releases (debe ir antes de /:id)
router.get(
  '/page/:proyectoId',
  ...requireAuth,
  obtenerDatosReleasesPage
);

// Ruta para calcular fechas desde posiciones del timeline (debe ir antes de /:id)
router.post(
  '/timeline/:proyectoId/calcular-fechas',
  ...requireAuth,
  calcularFechasDesdeTimeline
);

// Rutas CRUD (rutas genéricas con parámetros van al final)
// IMPORTANTE: El orden importa - rutas específicas primero, luego genéricas
router.get('/', ...requireAuth, buscarReleases);
router.post('/', ...requireAuth, validate(crearReleaseSchema), crearRelease);

// Rutas con parámetro :id - todas al final
router.get('/:id', ...requireAuth, obtenerReleasePorId);
router.put('/:id', ...requireAuth, validate(actualizarReleaseSchema), actualizarRelease);
router.delete('/:id', ...requireAuth, eliminarRelease);

export default router;

