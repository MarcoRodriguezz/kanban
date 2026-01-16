/**
 * Controlador para gestión de repositorios de GitHub vinculados a proyectos
 */
import { Request, Response } from 'express';
import { handleError } from '../utils/error-handler';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { prisma } from '../utils/prisma';
import { parseId } from '../utils/validation';
import { logger } from '../utils/logger';
import { CrearRepositorioInput, ActualizarRepositorioInput } from '../validations/repositorio.validation';

/**
 * Extrae owner y repo de una URL de GitHub
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Formato: https://github.com/owner/repo o https://github.com/owner/repo.git
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Obtiene todos los repositorios de un proyecto
 * GET /api/repositorios?proyectoId=1
 */
export const obtenerRepositorios = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const proyectoId = req.query.proyectoId ? parseId(req.query.proyectoId as string) : null;

    if (!proyectoId) {
      res.status(400).json({ error: 'ID de proyecto requerido' });
      return;
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: {
        id: true,
        nombre: true,
      },
    });

    if (!proyecto) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    const repositorios = await prisma.repositorioGitHub.findMany({
      where: { proyectoId },
      orderBy: { createdAt: 'desc' },
    });

    // Transformar repositorios al formato esperado por el frontend
    const repositoriosFormateados = repositorios.map((repo) => ({
      id: `repo-${repo.id}`,
      label: repo.nombre,
      description: repo.descripcion || '',
      url: repo.url,
      type: repo.tipo,
      repositorio: {
        id: repo.id,
        nombre: repo.nombre,
        descripcion: repo.descripcion,
        url: repo.url,
        owner: repo.owner,
        repo: repo.repo,
        tipo: repo.tipo,
        activo: (repo as any).activo ?? true, // Valor por defecto si no existe el campo
        proyectoId: repo.proyectoId,
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
      },
    }));

    res.json({
      repositorios: repositoriosFormateados,
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener repositorios');
  }
};

/**
 * Crea un nuevo repositorio vinculado a un proyecto
 * POST /api/repositorios
 */
export const crearRepositorio = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const datos: CrearRepositorioInput = req.body;

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

    // Extraer owner y repo de la URL si es GitHub
    let owner = '';
    let repo = '';
    const tipo = datos.tipo || 'github';

    if (tipo === 'github') {
      const parsed = parseGitHubUrl(datos.url);
      if (!parsed) {
        res.status(400).json({ error: 'URL de GitHub inválida. Debe ser: https://github.com/owner/repo' });
        return;
      }
      owner = parsed.owner;
      repo = parsed.repo;
    } else {
      const parsed = parseGitHubUrl(datos.url);
      if (parsed) {
        owner = parsed.owner;
        repo = parsed.repo;
      } else {
        // Para URLs no-GitHub, usar el nombre como repo y 'unknown' como owner
        owner = 'unknown';
        repo = datos.nombre.toLowerCase().replace(/\s+/g, '-');
      }
    }

    const repositorio = await prisma.repositorioGitHub.create({
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        url: datos.url,
        owner: owner || 'unknown',
        repo: repo || datos.nombre,
        tipo,
        proyectoId: datos.proyectoId,
      },
    });

    logger.info(`Repositorio creado: ${repositorio.id} para proyecto ${datos.proyectoId}`, {
      repositorioId: repositorio.id,
      proyectoId: datos.proyectoId,
      owner,
      repo,
    });

    res.status(201).json({
      message: 'Repositorio creado exitosamente',
      repositorio,
    });
  } catch (error) {
    handleError(res, error, 'Error al crear repositorio');
  }
};

/**
 * Actualiza un repositorio
 * PUT /api/repositorios/:id
 */
export const actualizarRepositorio = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const id = parseId(req.params.id);
    
    if (id === null) {
      res.status(400).json({ error: 'ID de repositorio inválido' });
      return;
    }
    
    const datos: ActualizarRepositorioInput = req.body;

    const repositorioExistente = await prisma.repositorioGitHub.findUnique({
      where: { id },
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

    if (!repositorioExistente) {
      res.status(404).json({ error: 'Repositorio no encontrado' });
      return;
    }

    // Si se actualiza la URL y es GitHub, actualizar owner y repo
    const updateData: any = {};
    if (datos.nombre !== undefined) updateData.nombre = datos.nombre;
    if (datos.descripcion !== undefined) updateData.descripcion = datos.descripcion || null;
    if (datos.tipo !== undefined) updateData.tipo = datos.tipo;
    if (datos.activo !== undefined) updateData.activo = datos.activo;

    if (datos.url !== undefined) {
      updateData.url = datos.url;
      const tipo = datos.tipo || repositorioExistente.tipo;
      if (tipo === 'github') {
        const parsed = parseGitHubUrl(datos.url);
        if (!parsed) {
          res.status(400).json({ error: 'URL de GitHub inválida. Debe ser: https://github.com/owner/repo' });
          return;
        }
        updateData.owner = parsed.owner;
        updateData.repo = parsed.repo;
      } else {
        // Para otros tipos, intentar extraer de la URL si es posible
        const parsed = parseGitHubUrl(datos.url);
        if (parsed) {
          updateData.owner = parsed.owner;
          updateData.repo = parsed.repo;
        } else {
          // Para URLs no-GitHub, usar el nombre como repo y 'unknown' como owner
          const nombre = datos.nombre || repositorioExistente.nombre;
          updateData.owner = 'unknown';
          updateData.repo = nombre.toLowerCase().replace(/\s+/g, '-');
        }
      }
    }

    const repositorio = await prisma.repositorioGitHub.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: 'Repositorio actualizado exitosamente',
      repositorio,
    });
  } catch (error) {
    handleError(res, error, 'Error al actualizar repositorio');
  }
};

/**
 * Elimina un repositorio
 * DELETE /api/repositorios/:id
 */
export const eliminarRepositorio = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const id = parseId(req.params.id);
    
    if (id === null) {
      res.status(400).json({ error: 'ID de repositorio inválido' });
      return;
    }

    const repositorio = await prisma.repositorioGitHub.findUnique({
      where: { id },
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

    if (!repositorio) {
      res.status(404).json({ error: 'Repositorio no encontrado' });
      return;
    }

    await prisma.repositorioGitHub.delete({
      where: { id },
    });

    logger.info(`Repositorio eliminado: ${id}`, {
      repositorioId: id,
      proyectoId: repositorio.proyectoId,
    });

    res.json({
      message: 'Repositorio eliminado exitosamente',
    });
  } catch (error) {
    handleError(res, error, 'Error al eliminar repositorio');
  }
};