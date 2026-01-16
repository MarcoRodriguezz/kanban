/**
 * Controlador para gestión de tokens de GitHub: crear, listar, actualizar y eliminar tokens cifrados
 * Todos los usuarios pueden gestionar tokens (los tokens se cifran automáticamente)
 */
import { Request, Response } from 'express';
import { handleError, sendNotFoundError } from '../utils/error-handler';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { prisma } from '../utils/prisma';
import { validateAndParseId } from '../utils/crud-helpers';
import { encrypt, decrypt } from '../security/encryption';
import { CrearGitHubTokenInput, ActualizarGitHubTokenInput } from '../validations/github.validation';
import { logger } from '../utils/logger';

/**
 * Lista los tokens de GitHub de un proyecto
 * GET /api/github/tokens?proyectoId=1
 */
export const listarTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const proyectoIdParam = req.query.proyectoId;
    if (!proyectoIdParam) {
      res.status(400).json({ error: 'El parámetro proyectoId es requerido' });
      return;
    }

    const proyectoId = parseInt(String(proyectoIdParam));
    if (isNaN(proyectoId)) {
      res.status(400).json({ error: 'ID de proyecto inválido' });
      return;
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
      },
    });

    if (!proyecto) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const tokens = await prisma.gitHubToken.findMany({
      where: {
        proyectoId: proyectoId,
      },
      select: {
        id: true,
        nombre: true,
        activo: true,
        proyectoId: true,
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ tokens });
  } catch (error) {
    handleError(res, error, 'Error al listar tokens de GitHub');
  }
};

/**
 * Crea un nuevo token de GitHub cifrado
 * POST /api/github/tokens
 */
export const crearToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const datos: CrearGitHubTokenInput = req.body;

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: datos.proyectoId },
      select: {
        id: true,
        gestorId: true,
        creadoPorId: true,
      },
    });

    if (!proyecto) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const tokenCifrado = encrypt(datos.token);
    try {
      const testResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${datos.token}`,
          'User-Agent': 'kanban-app',
        },
      });

      if (!testResponse.ok && testResponse.status !== 401) {
        logger.warn('No se pudo verificar el token de GitHub', {
          status: testResponse.status,
        });
      }
    } catch (error) {
      logger.warn('Error al verificar token de GitHub', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const token = await prisma.gitHubToken.create({
      data: {
        nombre: datos.nombre,
        tokenCifrado,
        activo: true,
        proyectoId: datos.proyectoId,
        creadoPorId: userId,
      },
      select: {
        id: true,
        nombre: true,
        activo: true,
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Token de GitHub creado', {
      tokenId: token.id,
      nombre: token.nombre,
      userId,
    });

    res.status(201).json({
      message: 'Token de GitHub creado exitosamente',
      token,
    });
  } catch (error) {
    handleError(res, error, 'Error al crear token de GitHub');
  }
};

/**
 * Actualiza un token de GitHub
 * PUT /api/github/tokens/:id
 */
export const actualizarToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const tokenId = validateAndParseId(req, res, 'id', 'Token');
    if (!tokenId) return;

    const datos: ActualizarGitHubTokenInput = req.body;

    const tokenExistente = await prisma.gitHubToken.findUnique({
      where: { id: tokenId },
      include: {
        proyecto: {
          select: {
            id: true,
            gestorId: true,
            creadoPorId: true,
          },
        },
      },
    });

    if (!tokenExistente) {
      sendNotFoundError(res, 'Token de GitHub');
      return;
    }

    const token = await prisma.gitHubToken.update({
      where: { id: tokenId },
      data: {
        ...(datos.nombre && { nombre: datos.nombre }),
        ...(datos.activo !== undefined && { activo: datos.activo }),
      },
        select: {
        id: true,
        nombre: true,
        activo: true,
        proyectoId: true,
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Token de GitHub actualizado', {
      tokenId: token.id,
      userId,
    });

    res.json({
      message: 'Token de GitHub actualizado exitosamente',
      token,
    });
  } catch (error) {
    handleError(res, error, 'Error al actualizar token de GitHub');
  }
};

/**
 * Elimina un token de GitHub
 * DELETE /api/github/tokens/:id
 */
export const eliminarToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const tokenId = validateAndParseId(req, res, 'id', 'Token');
    if (!tokenId) return;

    const tokenExistente = await prisma.gitHubToken.findUnique({
      where: { id: tokenId },
      include: {
        proyecto: {
          select: {
            id: true,
            gestorId: true,
            creadoPorId: true,
          },
        },
      },
    });

    if (!tokenExistente) {
      sendNotFoundError(res, 'Token de GitHub');
      return;
    }

    await prisma.gitHubToken.delete({
      where: { id: tokenId },
    });

    logger.info('Token de GitHub eliminado', {
      tokenId,
      userId,
    });

    res.json({ message: 'Token de GitHub eliminado exitosamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar token de GitHub');
  }
};

/**
 * Obtiene un token activo de un proyecto específico y lo descifra
 */
export async function obtenerTokenActivo(proyectoId: number): Promise<string | null> {
  const token = await prisma.gitHubToken.findFirst({
    where: { 
      activo: true,
      proyectoId: proyectoId,
    },
    orderBy: { createdAt: 'desc' }, 
  });

  if (!token) {
    return null;
  }

  try {
    return decrypt(token.tokenCifrado);
  } catch (error) {
    logger.error('Error al descifrar token de GitHub', error, {
      tokenId: token.id,
      proyectoId,
    });
    return null;
  }
}

