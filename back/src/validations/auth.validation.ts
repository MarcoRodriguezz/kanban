/**
 * Schemas de validación Zod para autenticación: login, registro, recuperación de contraseña y refresh tokens.
 * Define tipos TypeScript inferidos y validaciones de formato para todos los endpoints de autenticación.
 */
import { z } from 'zod';
import { emailSchema, passwordSchema, simplePasswordSchema, stringSchema } from './validation-helpers';

// Esquema para login
export const loginSchema = z.object({
  email: emailSchema,
  contraseña: simplePasswordSchema(6, 50),
});

// Esquema para solicitar recuperación de contraseña
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Esquema para restablecer contraseña con token
export const resetPasswordWithTokenSchema = z.object({
  token: z.string('El token debe ser un texto').min(1, 'El token es requerido'),
  contraseña: passwordSchema(6, 100),
  confirmarContraseña: z
    .string('Debe confirmar la contraseña')
    .min(1, 'Debe confirmar la contraseña'),
}).refine((data) => data.contraseña === data.confirmarContraseña, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmarContraseña'],
});

export type LoginInput = z.infer<typeof loginSchema>;

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export type ResetPasswordWithTokenInput = z.infer<typeof resetPasswordWithTokenSchema>;

// Esquema para cambio de contraseña autenticado
export const changePasswordSchema = z.object({
  currentPassword: z.string('La contraseña actual debe ser un texto').min(1, 'La contraseña actual es requerida'),
  newPassword: passwordSchema(6, 100),
  confirmPassword: z.string('Debe confirmar la nueva contraseña').min(1, 'Debe confirmar la nueva contraseña'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'La confirmación de contraseña no coincide con la nueva contraseña',
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// Esquema para actualizar perfil
export const actualizarPerfilSchema = z.object({
  nombreCompleto: stringSchema(2, 255, 'El nombre completo').trim().optional(),
  email: emailSchema.optional(),
}).refine((data) => data.nombreCompleto || data.email, {
  message: 'Debe proporcionar al menos un campo para actualizar',
});

export type ActualizarPerfilInput = z.infer<typeof actualizarPerfilSchema>;

// Esquema para crear usuario (solo admin/gestor)
export const crearUsuarioSchema = z.object({
  nombreCompleto: stringSchema(2, 255, 'El nombre completo').trim(),
  email: emailSchema,
  rol: z
    .enum(['Administrador', 'Empleado'], {
      message: 'El rol debe ser: Administrador o Empleado',
    })
    .optional()
    .default('Empleado'),
  contraseña: passwordSchema(6, 100).optional(), // Contraseña opcional, si no se proporciona se usa "empleado123"
});

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

