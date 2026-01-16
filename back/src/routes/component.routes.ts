/**
 * Rutas para gestión de componentes: crear, actualizar, eliminar y buscar componentes.
 * Actualizado: 2025-01-18
 */
import { Router, Request, Response, NextFunction } from 'express';
import {
  buscarComponentes,
  crearComponente,
  eliminarComponente,
  exportarComponente,
  servirImagenComponente,
} from '../controllers/component.controller';
import {
  crearComponenteSchema,
  buscarComponentesQuerySchema,
} from '../validations/component.validation';
import { validateQuery, validate } from '../middleware/validation.middleware';
import { requireAuth } from '../utils/response-helpers';
import { upload } from '../middleware/upload.middleware';
import { handleMulterError } from '../middleware/upload-error.middleware';

const router = Router();

router.get(
  '/imagen/:filename',
  servirImagenComponente
);

router.get(
  '/:id/exportar',
  ...requireAuth,
  exportarComponente
);

router.get(
  '/',
  ...requireAuth,
  validateQuery(buscarComponentesQuerySchema),
  buscarComponentes
);

router.post(
  '/',
  ...requireAuth,
  upload.single('archivo'),
  handleMulterError,
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return validate(crearComponenteSchema)(req, res, next);
    }
    next();
  },
  crearComponente
);

router.delete(
  '/:id',
  ...requireAuth,
  eliminarComponente
);

export default router;

