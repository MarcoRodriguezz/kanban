/**
 * Servicio para interactuar con la API de GitHub
 * Obtiene commits de repositorios públicos y privados usando un token de acceso personal
 * Soporta tokens desde variable de entorno o desde base de datos cifrada
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface GitHubCommit {
  repo: string;
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  url: string;
}

class GitHubService {
  private client: AxiosInstance;
  private token: string | null;

  constructor() {
    // Primero intentar desde variable de entorno (para compatibilidad)
    this.token = process.env.GITHUB_TOKEN || null;
    
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'User-Agent': 'kanban-app',
      },
      timeout: 10000, // 10 segundos
    });
  }

  /**
   * Obtiene el token activo de un proyecto específico (de BD o de env)
   * Recarga desde BD para el proyecto específico
   */
  private async getActiveToken(proyectoId: number): Promise<string | null> {
    try {
      const { obtenerTokenActivo } = await import('../controllers/github-token.controller');
      const projectToken = await obtenerTokenActivo(proyectoId);
      
      // Si hay token del proyecto, usarlo; si no, usar el token de entorno como fallback
      return projectToken || this.token;
    } catch (error) {
      logger.warn('Error al cargar token de GitHub desde BD', {
        error: error instanceof Error ? error.message : String(error),
        proyectoId,
      });
      // En caso de error, usar el token de entorno como fallback
      return this.token;
    }
  }

  /**
   * Obtiene commits de un repositorio usando el token del proyecto específico
   */
  async getCommits(
    owner: string,
    repo: string,
    limit: number = 10,
    proyectoId?: number
  ): Promise<GitHubCommit[]> {
    // Obtener token activo del proyecto (de BD o env)
    let activeToken: string | null = null;
    
    try {
      // Obtener token del proyecto si se proporciona proyectoId
      if (proyectoId) {
        activeToken = await this.getActiveToken(proyectoId);
      } else {
        // Fallback al token de entorno si no hay proyectoId
        activeToken = this.token;
      }
      
      if (!activeToken) {
        logger.warn('No hay token de GitHub configurado. Solo se pueden acceder repositorios públicos.', {
          owner,
          repo,
        });
      }
      
      // Configurar headers con el token
      const headers: Record<string, string> = {
        'User-Agent': 'kanban-app',
      };
      
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }

      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
        params: {
          per_page: Math.min(limit, 100), // GitHub permite máximo 100 por página
        },
        headers,
      });

      if (!response.data || response.data.length === 0) {
        logger.debug(`Repositorio ${owner}/${repo} no tiene commits o está vacío`);
        return [];
      }

      const mappedCommits = response.data.map((commit: any) => ({
        repo: `${owner}/${repo}`,
        sha: commit.sha.substring(0, 7), // Solo los primeros 7 caracteres
        message: commit.commit.message.split('\n')[0], // Solo la primera línea
        author: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
        date: commit.commit.author.date,
        url: commit.html_url,
      }));
      
      return mappedCommits;
    } catch (error: any) {
      logger.error('Error obteniendo commits de GitHub', error, {
        owner,
        repo,
        limit,
      });

      // Si es un error 404, el repo no existe o no tenemos acceso
      if (error.response?.status === 404) {
        const errorMessage = error.response?.data?.message || 'Repositorio no encontrado';
        
        logger.warn(`Repositorio ${owner}/${repo} no encontrado o sin acceso`, {
          owner,
          repo,
          hasToken: !!activeToken,
          errorMessage,
        });
        
        let userMessage = `Repositorio ${owner}/${repo} no encontrado o sin acceso.`;
        if (activeToken) {
          userMessage += ` El token está configurado pero no tiene acceso a este repositorio.`;
        } else {
          userMessage += ` No hay token configurado. Solo se pueden acceder repositorios públicos.`;
        }
        
        throw new Error(userMessage);
      }

      // Si es un error 401/403, problema de autenticación
      // Intentar recargar el token del proyecto por si se añadió uno nuevo
      if ((error.response?.status === 401 || error.response?.status === 403) && proyectoId) {
        const retryToken = await this.getActiveToken(proyectoId);
        
        if (retryToken && retryToken !== activeToken) {
          // Si hay un token nuevo, intentar de nuevo con el nuevo token
          logger.info('Token recargado, reintentando petición a GitHub', { proyectoId });
          const retryHeaders: Record<string, string> = {
            'User-Agent': 'kanban-app',
            Authorization: `Bearer ${retryToken}`,
          };
          
          const retryResponse = await this.client.get(`/repos/${owner}/${repo}/commits`, {
            params: {
              per_page: Math.min(limit, 100),
            },
            headers: retryHeaders,
          });
          
          return retryResponse.data.map((commit: any) => ({
            repo: `${owner}/${repo}`,
            sha: commit.sha.substring(0, 7),
            message: commit.commit.message.split('\n')[0],
            author: commit.commit.author.name,
            authorEmail: commit.commit.author.email,
            date: commit.commit.author.date,
            url: commit.html_url,
          }));
        }
        
        throw new Error(`Sin permisos para acceder a ${owner}/${repo}. Verifica que el token de GitHub esté activo y tenga los permisos necesarios.`);
      }

      throw new Error(`Error al obtener commits: ${error.message}`);
    }
  }

  /**
   * Verifica si el token de GitHub está configurado para un proyecto específico
   */
  async isTokenConfigured(proyectoId: number): Promise<boolean> {
    const activeToken = await this.getActiveToken(proyectoId);
    return !!activeToken;
  }
}

export const githubService = new GitHubService();

