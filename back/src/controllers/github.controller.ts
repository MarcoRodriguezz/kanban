/**
 * Controlador para endpoints de GitHub: obtener commits de repositorios vinculados a proyectos
 */
import { Request, Response } from 'express';
import { handleError } from '../utils/error-handler';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { githubService } from '../services/githubService';
import { parseId } from '../utils/validation';
import { logger } from '../utils/logger';
import { prisma } from '../utils/prisma';

export interface CommitResponse {
  repo: string;
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  url: string;
}

/**
 * Obtiene commits de todos los repositorios vinculados a un proyecto
 * GET /api/github/projects/:projectId/commits?limit=10
 */
export const getProjectCommits = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    
    if (!userId) {
      return;
    }

    const projectId = req.params.projectId;
    const limit = Number(req.query.limit) || 10;

    if (!projectId) {
      res.status(400).json({ error: 'ID de proyecto requerido' });
      return;
    }
    
    const proyectoIdNum = parseId(projectId);
    
    if (proyectoIdNum === null) {
      res.status(400).json({ error: 'ID de proyecto inválido' });
      return;
    }
    
    // Obtener repositorios activos de la base de datos
    const repositoriosDB = await prisma.repositorioGitHub.findMany({
      where: {
        proyectoId: proyectoIdNum,
        tipo: 'github',
        activo: true, // Solo repositorios activos
      },
      select: {
        owner: true,
        repo: true,
      },
    });
    
    if (repositoriosDB.length === 0) {
      logger.debug(`No se encontraron repositorios para proyecto ID: ${projectId}`, {
        projectId,
        proyectoIdNum,
      });
      // Devolver 200 con datos vacíos en lugar de 404 para evitar errores en consola
      // Esto es más RESTful cuando simplemente no hay datos, no es un error
      res.json({
        commits: [],
        total: 0,
        repos: [],
        repositorios: [],
        proyectoId: projectId,
      });
      return;
    }
    
    const repos = repositoriosDB.map((r: { owner: string; repo: string }) => ({ owner: r.owner, repo: r.repo }));
    
    logger.debug(`Repositorios encontrados en BD para proyecto ID: ${projectId}`, {
      projectId,
      foundRepos: repos.length,
    });

    // Verificar si hay token configurado para este proyecto (necesario para repos privados)
    const tieneToken = await githubService.isTokenConfigured(proyectoIdNum);
    if (!tieneToken) {
      logger.warn(`No hay token de GitHub configurado para el proyecto ${proyectoIdNum}. Solo se podrán acceder repositorios públicos.`);
    }
    const perRepo = Math.max(Math.ceil(limit / repos.length), 5);

    const repoErrors: Array<{ repo: string; error: string; status?: number }> = [];
    
    const results = await Promise.all(
      repos.map(async (repo) => {
        try {
          const commits = await githubService.getCommits(repo.owner, repo.repo, perRepo, proyectoIdNum);
          return commits;
        } catch (error: any) {

          const errorInfo = {
            repo: `${repo.owner}/${repo.repo}`,
            error: error.message,
            status: error.response?.status,
          };
          repoErrors.push(errorInfo);
          
          logger.error(`Error obteniendo commits de ${repo.owner}/${repo.repo}`, error, {
            owner: repo.owner,
            repo: repo.repo,
          });
          return [];
        }
      })
    );

    const allCommits = results.flat();

    allCommits.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    const commits = allCommits.slice(0, limit);

    logger.debug(`Commits obtenidos para proyecto ${projectId}`, {
      total: allCommits.length,
      limitado: commits.length,
      reposConsultados: repos.length,
      tokenConfigurado: tieneToken,
    });

    // Información de diagnóstico
    const repoStatus = repos.map((repo, index) => ({
      repo: `${repo.owner}/${repo.repo}`,
      commitsObtenidos: results[index]?.length || 0,
    }));

    const repositoriosCompletos = await prisma.repositorioGitHub.findMany({
      where: {
        proyectoId: proyectoIdNum,
        tipo: 'github',
        activo: true, // Solo repositorios activos
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        url: true,
        tipo: true,
        owner: true,
        repo: true,
        activo: true,
        proyectoId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const reposFormateados = repositoriosCompletos.map((repo) => ({
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
        activo: repo.activo,
        proyectoId: repo.proyectoId,
        createdAt: repo.createdAt.toISOString(),
        updatedAt: repo.updatedAt.toISOString(),
      },
    }));

    res.json({
      commits,
      total: commits.length,
      repos: repos.map(r => `${r.owner}/${r.repo}`),
      repositorios: reposFormateados,
      proyectoId: projectId,
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          reposConsultados: repoStatus,
          tokenConfigurado: tieneToken,
          totalRepos: repos.length,
          errores: repoErrors.length > 0 ? repoErrors : undefined,
        },
      }),
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener commits del proyecto');
  }
};

