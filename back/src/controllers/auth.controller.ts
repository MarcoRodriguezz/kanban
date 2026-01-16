/**
 * Controlador de autenticación: registro, login, refresh tokens, logout y recuperación de contraseña.
 * Maneja la generación de tokens JWT, refresh tokens y envío de emails de recuperación.
 */
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { handleError } from '../utils/error-handler';
import { sendPasswordResetEmail } from '../services/emailService';
import { logger } from '../utils/logger';
import { ROLES } from '../utils/constants';
import {
  buildUserResponseWithoutDates,
  buildUserResponse,
  requireAuthenticated,
  buildAuthResponse,
  calculateUserInitials,
} from '../utils/response-helpers';
import { 
  generateResetToken, 
  calculateResetTokenExpiry, 
  generateAndSaveTokens,
  validateCredentials,
  isEmailRegistered,
  findUserByResetToken,
  clearResetToken,
  updatePasswordAndClearToken,
  hashPassword,
  verifyPassword,
} from '../utils/auth-helpers';
import fs from 'fs';
import path from 'path';

const usuarioSelect = {
  id: true,
  email: true,
  nombreCompleto: true,
  fotoPerfil: true,
  rol: true,
  createdAt: true,
} as const;

const PASSWORD_RESET_MESSAGE =
  'Si el email está registrado, recibirás un enlace de recuperación en breve';


export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Los datos ya están validados por Zod en el middleware
    // Solo necesitamos extraerlos del body validado
    const { email, contraseña } = req.body;

    // Limpiar espacios en blanco del email y contraseña
    const emailLimpio = email.trim().toLowerCase();
    const contraseñaLimpia = contraseña.trim();

    logger.info('Intento de login', { email: emailLimpio });

    const usuarioValidado = await validateCredentials(emailLimpio, contraseñaLimpia);
    if (!usuarioValidado) {
      logger.warn('Login fallido: credenciales inválidas', { email: emailLimpio });
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    logger.info('Credenciales válidas, generando tokens', { 
      email: usuarioValidado.email, 
      userId: usuarioValidado.id 
    });

    const { token, refreshToken } = await generateAndSaveTokens(
      usuarioValidado.id,
      usuarioValidado.email,
      usuarioValidado.rol
    );

    logger.info('Login exitoso', { 
      email: usuarioValidado.email, 
      userId: usuarioValidado.id 
    });

    res.json(buildAuthResponse(token, refreshToken, buildUserResponseWithoutDates(usuarioValidado)));
  } catch (error) {
    // Mejorar el logging de errores para capturar mejor los errores de Prisma
    if (error instanceof Prisma.PrismaClientInitializationError) {
      logger.error('Error de inicialización de Prisma durante login (problema de conexión)', error, {
        email: req.body.email,
        errorCode: error.errorCode,
      });
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error('Error de Prisma durante login', error, {
        email: req.body.email,
        code: error.code,
        meta: error.meta,
      });
    } else {
      logger.error('Error al iniciar sesión', error, { email: req.body.email });
    }
    handleError(res, error, 'Error al iniciar sesión', 500);
  }
};

/**
 * Obtener datos usuario actual autenticado
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireAuthenticated(req, res)) {
      return;
    }

    const userId = req.user!.userId;
    
    // Usar usuarioSelect explícitamente para asegurar que fotoPerfil se incluya
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: usuarioSelect,
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    
    const userResponse = buildUserResponse(usuario);
    
    res.json(userResponse);
  } catch (error) {
    handleError(res, error, 'Error al obtener usuario actual', 500);
  }
};

/**
 * Obtener lista de todos los usuarios (solo administradores y gestores)
 */
export const obtenerUsuarios = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireAuthenticated(req, res)) {
      return;
    }

    const usuario = req.user!;
    
    logger.info('Solicitud de lista de usuarios', {
      userId: usuario.userId,
      rol: usuario.rol,
      email: usuario.email,
    });
    
    // Administradores, gestores y creadores de proyectos pueden ver la lista de usuarios
    const [esGestor, esCreador] = await Promise.all([
      prisma.proyecto.findFirst({
        where: {
          gestorId: usuario.userId,
        },
        select: {
          id: true,
          nombre: true,
        },
      }),
      prisma.proyecto.findFirst({
        where: {
          creadoPorId: usuario.userId,
        },
        select: {
          id: true,
          nombre: true,
        },
      }),
    ]);

    logger.info('Verificación de permisos para lista de usuarios', {
      userId: usuario.userId,
      rol: usuario.rol,
      esAdmin: usuario.rol === ROLES.ADMINISTRADOR,
      esGestor: esGestor !== null,
      proyectoGestor: esGestor?.nombre || null,
      esCreador: esCreador !== null,
      proyectoCreador: esCreador?.nombre || null,
    });

    const tienePermisos = usuario.rol === ROLES.ADMINISTRADOR || esGestor !== null || esCreador !== null;

    if (!tienePermisos) {
      logger.warn('Intento de acceso a lista de usuarios sin permisos', {
        userId: usuario.userId,
        rol: usuario.rol,
        esGestor: esGestor !== null,
        esCreador: esCreador !== null,
      });
      res.status(403).json({ error: 'No tienes permisos para ver la lista de usuarios' });
      return;
    }

    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
        rol: true,
        createdAt: true,
      },
      orderBy: {
        nombreCompleto: 'asc',
      },
    });

    res.json({
      usuarios: usuarios.map((u) => ({
        id: u.id.toString(),
        name: u.nombreCompleto,
        email: u.email,
        role: u.rol,
        initials: calculateUserInitials(u.nombreCompleto),
      })),
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener usuarios', 500);
  }
};

/**
 * Solicitar recuperación de contraseña
 * Envía un email con un enlace para restablecer la contraseña
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
      },
    });
    if (!usuario) {
      logger.warn('Intento de recuperación para email no registrado', { email });
      res.json({ message: PASSWORD_RESET_MESSAGE });
      return;
    }

    const { token: resetToken, hashedToken } = generateResetToken();
    const resetTokenExpiry = calculateResetTokenExpiry();

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry,
      },
    });

    try {
      await sendPasswordResetEmail(usuario.email, usuario.nombreCompleto, resetToken);
      logger.info('Email de recuperación enviado', {
        email: usuario.email,
        userId: usuario.id,
      });

      res.json({ message: PASSWORD_RESET_MESSAGE });
    } catch (error) {
      logger.error('Error al enviar email de recuperación', error, {
        email: usuario.email,
        userId: usuario.id,
      });

      await clearResetToken(usuario.id);

      res.status(500).json({
        error: 'No se pudo enviar el email de recuperación. Intenta de nuevo más tarde.',
      });
    }
  } catch (error) {
    handleError(res, error, 'Error al procesar solicitud de recuperación', 500);
  }
};

/**
 * Restablecer contraseña con token
 * Valida el token y actualiza la contraseña del usuario
 */
export const resetPasswordWithToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, contraseña } = req.body;

    const usuario = await findUserByResetToken(token);
    if (!usuario) {
      res.status(400).json({ error: 'Token inválido o expirado' });
      return;
    }

    await updatePasswordAndClearToken(usuario.id, contraseña);

    logger.info('Contraseña restablecida exitosamente', {
      email: usuario.email,
      userId: usuario.id,
    });

    res.json({
      message: 'Contraseña restablecida exitosamente',
    });
  } catch (error) {
    handleError(res, error, 'Error al restablecer contraseña', 500);
  }
};


/**
 * Cambiar contraseña (requiere autenticación)
 * Permite a un usuario autenticado cambiar su contraseña proporcionando la contraseña actual
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireAuthenticated(req, res)) {
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validaciones básicas (aunque Zod ya las valida)
    if (!currentPassword || currentPassword.trim().length === 0) {
      res.status(400).json({ error: 'La contraseña actual es requerida' });
      return;
    }
    if (!newPassword || newPassword.trim().length === 0) {
      res.status(400).json({ error: 'La nueva contraseña es requerida' });
      return;
    }
    if (!confirmPassword || confirmPassword.trim().length === 0) {
      res.status(400).json({ error: 'Debe confirmar la nueva contraseña' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'La confirmación de contraseña no coincide con la nueva contraseña' });
      return;
    }

    // Obtener el usuario actual con su contraseña
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        contraseña: true,
      },
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const isValidPassword = await verifyPassword(currentPassword, usuario.contraseña);
    if (!isValidPassword) {
      res.status(401).json({ error: 'La contraseña actual es incorrecta' });
      return;
    }

    const isSamePassword = await verifyPassword(newPassword, usuario.contraseña);
    if (isSamePassword) {
      res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual' });
      return;
    }

    const nuevaContraseñaHash = await hashPassword(newPassword);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        contraseña: nuevaContraseñaHash,
      },
    });

    logger.info('Contraseña cambiada exitosamente', {
      email: usuario.email,
      userId: usuario.id,
    });

    res.json({
      message: 'Contraseña cambiada exitosamente',
    });
  } catch (error) {
    handleError(res, error, 'Error al cambiar contraseña', 500);
  }
};

/**
 * Actualizar perfil del usuario (nombre y email)
 * PUT /api/auth/profile
 */
export const actualizarPerfil = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireAuthenticated(req, res)) {
      return;
    }

    const { nombreCompleto, email } = req.body;

    if (!nombreCompleto && !email) {
      res.status(400).json({ error: 'Debe proporcionar al menos un campo para actualizar' });
      return;
    }

    const userId = req.user!.userId;
    const updateData: { nombreCompleto?: string; email?: string } = {};

    if (email) {
      const emailExists = await prisma.usuario.findFirst({
        where: {
          email,
          NOT: { id: userId },
        },
      });

      if (emailExists) {
        res.status(400).json({ error: 'El email ya está en uso por otro usuario' });
        return;
      }
      updateData.email = email;
    }

    if (nombreCompleto) {
      updateData.nombreCompleto = nombreCompleto.trim();
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id: userId },
      data: updateData,
      select: usuarioSelect,
    });

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: buildUserResponse(usuarioActualizado),
    });
  } catch (error) {
    handleError(res, error, 'Error al actualizar el perfil', 500);
  }
};

/**
 * Subir foto de perfil
 * POST /api/auth/profile/photo
 */
export const subirFotoPerfil = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireAuthenticated(req, res)) {
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No se proporcionó ningún archivo' });
      return;
    }

    const userId = req.user!.userId;

    // Obtener el usuario actual para eliminar la foto anterior si existe
    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { 
        fotoPerfil: true 
      },
    });

    // Si hay una foto anterior, eliminarla
    if (usuarioActual?.fotoPerfil) {
      const fotoAnteriorPath = path.join(process.cwd(), usuarioActual.fotoPerfil);
      if (fs.existsSync(fotoAnteriorPath)) {
        try {
          fs.unlinkSync(fotoAnteriorPath);
        } catch (error) {
          logger.warn(`No se pudo eliminar la foto anterior: ${fotoAnteriorPath}`);
        }
      }
    }
    const fotoPath = `/uploads/${req.file.filename}`;
    const usuarioActualizado = await prisma.usuario.update({
      where: { id: userId },
      data: { 
        fotoPerfil: fotoPath
      },
      select: usuarioSelect,
    });
    
    const userResponse = buildUserResponse(usuarioActualizado);

    res.json({
      message: 'Foto de perfil actualizada exitosamente',
      user: userResponse,
    });
  } catch (error) {
    handleError(res, error, 'Error al subir la foto de perfil', 500);
  }
};

/**
 * Crear un nuevo usuario (solo administradores y gestores)
 * Permite crear usuarios con contraseña opcional (si no se proporciona, se usa la contraseña genérica "empleado123")
 */
export const crearUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!requireAuthenticated(req, res)) {
      return;
    }

    const usuarioActual = req.user!;
    const [esGestor, esCreador] = await Promise.all([
      prisma.proyecto.findFirst({
        where: {
          gestorId: usuarioActual.userId,
        },
        select: {
          id: true,
        },
      }),
      prisma.proyecto.findFirst({
        where: {
          creadoPorId: usuarioActual.userId,
        },
        select: {
          id: true,
        },
      }),
    ]);

    const tienePermisos = usuarioActual.rol === ROLES.ADMINISTRADOR || esGestor !== null || esCreador !== null;

    if (!tienePermisos) {
      logger.warn('Intento de crear usuario sin permisos', {
        userId: usuarioActual.userId,
        rol: usuarioActual.rol,
        esGestor: esGestor !== null,
        esCreador: esCreador !== null,
      });
      res.status(403).json({ error: 'Solo los administradores, gestores y creadores de proyecto pueden crear usuarios' });
      return;
    }

    const { nombreCompleto, email, rol, contraseña } = req.body;

    // Normalizar email: convertir a minúsculas y quitar espacios
    const emailNormalizado = email.trim().toLowerCase();

    // Verificar que el email no esté registrado
    if (await isEmailRegistered(emailNormalizado)) {
      res.status(400).json({ error: 'El email ya está registrado' });
      return;
    }

    // Usar contraseña genérica por defecto si no se proporciona o está vacía
    // Asegurarse de que si viene como string vacío también se use la por defecto
    const contraseñaFinal = (contraseña && contraseña.trim().length > 0) ? contraseña.trim() : 'empleado123';
    const contraseñaHash = await hashPassword(contraseñaFinal);

    // Verificar que el hash se generó correctamente
    if (!contraseñaHash || !contraseñaHash.startsWith('$2')) {
      logger.error('Error al hashear contraseña: hash inválido', {
        email: emailNormalizado,
        contraseñaLength: contraseñaFinal.length,
      });
      res.status(500).json({ error: 'Error al crear usuario' });
      return;
    }

    logger.info('Creando usuario', {
      email: emailNormalizado,
      nombreCompleto,
      rol: rol || ROLES.EMPLEADO,
      usaContraseñaPorDefecto: !contraseña || contraseña.trim().length === 0,
      hashGenerado: contraseñaHash.substring(0, 20) + '...',
    });

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombreCompleto: nombreCompleto.trim(),
        email: emailNormalizado,
        contraseña: contraseñaHash,
        rol: rol || ROLES.EMPLEADO,
      },
      select: usuarioSelect,
    });

    logger.info('Usuario creado exitosamente', {
      email: nuevoUsuario.email,
      userId: nuevoUsuario.id,
      creadoPor: usuarioActual.userId,
    });

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: buildUserResponseWithoutDates(nuevoUsuario),
      contraseñaTemporal: (!contraseña || contraseña.trim().length === 0) ? contraseñaFinal : undefined, // "empleado123" si no se proporcionó contraseña
    });
  } catch (error) {
    handleError(res, error, 'Error al crear usuario', 500);
  }
};

/**
 * Eliminar un usuario (solo administradores)
 * No se puede eliminar un usuario si es creador o gestor de algún proyecto
 */
export const eliminarUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Eliminar usuario - Ruta alcanzada', { 
      usuarioId: req.params.id,
      method: req.method,
      path: req.path 
    });
    
    if (!requireAuthenticated(req, res)) {
      return;
    }

    const usuarioActual = req.user!;
    
    // Solo administradores pueden eliminar usuarios
    if (usuarioActual.rol !== ROLES.ADMINISTRADOR) {
      logger.warn('Intento de eliminar usuario sin permisos', {
        userId: usuarioActual.userId,
        rol: usuarioActual.rol,
      });
      res.status(403).json({ error: 'Solo los administradores pueden eliminar usuarios' });
      return;
    }

    const usuarioId = parseInt(req.params.id, 10);
    
    if (isNaN(usuarioId)) {
      res.status(400).json({ error: 'ID de usuario inválido' });
      return;
    }

    // No permitir que un usuario se elimine a sí mismo
    if (usuarioId === usuarioActual.userId) {
      res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
      return;
    }

    // Verificar que el usuario existe
    const usuarioAEliminar = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        email: true,
        nombreCompleto: true,
        rol: true,
      },
    });

    if (!usuarioAEliminar) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Verificar si el usuario es creador o gestor de algún proyecto
    const [proyectosComoCreador, proyectosComoGestor] = await Promise.all([
      prisma.proyecto.findFirst({
        where: { creadoPorId: usuarioId },
        select: { id: true, nombre: true },
      }),
      prisma.proyecto.findFirst({
        where: { gestorId: usuarioId },
        select: { id: true, nombre: true },
      }),
    ]);

    if (proyectosComoCreador) {
      res.status(400).json({ 
        error: `No se puede eliminar el usuario porque es creador del proyecto "${proyectosComoCreador.nombre}"` 
      });
      return;
    }

    if (proyectosComoGestor) {
      res.status(400).json({ 
        error: `No se puede eliminar el usuario porque es gestor del proyecto "${proyectosComoGestor.nombre}"` 
      });
      return;
    }

    // Eliminar el usuario (las relaciones con onDelete: Cascade se eliminarán automáticamente)
    await prisma.usuario.delete({
      where: { id: usuarioId },
    });

    logger.info('Usuario eliminado exitosamente', {
      usuarioEliminadoId: usuarioId,
      email: usuarioAEliminar.email,
      eliminadoPor: usuarioActual.userId,
    });

    res.json({
      message: 'Usuario eliminado exitosamente',
    });
  } catch (error) {
    handleError(res, error, 'Error al eliminar usuario', 500);
  }
};