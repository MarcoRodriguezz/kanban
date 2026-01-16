/**
 * Rutas de autenticación: registro, login, refresh token, logout y recuperación de contraseña.
 * Aplica rate limiting y validación con Zod a todos los endpoints de autenticación.
 */
import { Router } from 'express';
import { 
  login, 
  getCurrentUser, 
  obtenerUsuarios,
  crearUsuario,
  eliminarUsuario,
  actualizarPerfil,
  subirFotoPerfil,
  forgotPassword, 
  resetPasswordWithToken,
  changePassword
} from '../controllers/auth.controller';
import { 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordWithTokenSchema,
  changePasswordSchema,
  actualizarPerfilSchema,
  crearUsuarioSchema
} from '../validations/auth.validation';
import { validate } from '../middleware/validation.middleware';
import { authenticateToken, requireAnyRole } from '../middleware/auth.middleware';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit.middleware';
import { uploadProfilePhoto } from '../middleware/upload.middleware';
import { handleMulterError } from '../middleware/upload-error.middleware';
import { Request, Response, NextFunction } from 'express';

// Middleware que envuelve multer y maneja errores
const multerWithErrorHandling = (req: Request, res: Response, next: NextFunction) => {
  uploadProfilePhoto.single('photo')(req, res, (err) => {
    if (err) {
      // Si hay error, usar el error handler
      return handleMulterError(err, req, res, next);
    }
    // Si no hay error, continuar
    next();
  });
};

const router = Router();

const noOpMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();
const isDevelopment = process.env.NODE_ENV === 'development';
const authLimiter = isDevelopment ? noOpMiddleware : authRateLimiter;
const passwordResetLimiter = isDevelopment ? noOpMiddleware : passwordResetRateLimiter;

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validate(resetPasswordWithTokenSchema), resetPasswordWithToken);
router.post('/password-change', authenticateToken, requireAnyRole, authLimiter, validate(changePasswordSchema), changePassword);
router.get('/me', authenticateToken, requireAnyRole, getCurrentUser);
router.post(
  '/profile/photo',
  authenticateToken,
  requireAnyRole,
  authLimiter,
  multerWithErrorHandling,
  subirFotoPerfil
);
router.put('/profile', authenticateToken, requireAnyRole, authLimiter, validate(actualizarPerfilSchema), actualizarPerfil);
// IMPORTANTE: Las rutas con parámetros deben ir DESPUÉS de las rutas específicas
router.get('/usuarios', authenticateToken, requireAnyRole, obtenerUsuarios);
router.post('/usuarios', authenticateToken, requireAnyRole, validate(crearUsuarioSchema), crearUsuario);
router.delete('/usuarios/:id', authenticateToken, requireAnyRole, eliminarUsuario);

export default router;

