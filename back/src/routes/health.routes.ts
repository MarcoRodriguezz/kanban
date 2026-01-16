/**
 * Rutas de health check: endpoints /live, /ready y / para monitoreo de la aplicación.
 * Proporciona información de estado del sistema para Kubernetes, load balancers y herramientas de monitoreo.
 */
import { Router, Request, Response } from 'express';
import { getHealthStatus, getQuickHealth } from '../utils/health-check';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.json(getQuickHealth());
});

router.get('/ready', async (_req: Request, res: Response) => {
  const health = await getHealthStatus();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

router.get('/', (_req: Request, res: Response) => {
  res.json(getQuickHealth());
});

export default router;

