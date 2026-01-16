import React from 'react';
import Sidebar, { DEFAULT_PROJECTS, SidebarProject } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import { RepoType } from './types';
import RepoLinksSection from './RepoLinksSection';
import CommitsSection from './CommitsSection';
import { getProjectCommits, GitHubCommit, createRepositorio, getRepositorios, RepoLink, createGitHubToken, CreateGitHubTokenData } from '../../services/api';

type RepositoryPageProps = {
  project?: SidebarProject | null;
  projects?: SidebarProject[];
  selectedId: string;
  onSelect: (projectId: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  headerNotifications?: HeaderProps['notifications'];
  currentUser?: {
    name: string;
    role: 'admin' | 'product-owner' | 'employee';
  };
};

const RepositoryPage: React.FC<RepositoryPageProps> = ({
  project,
  projects = DEFAULT_PROJECTS,
  selectedId,
  onSelect,
  onBack,
  onProfileClick,
  onLogout,
  headerNotifications,
  currentUser,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [showRepoModal, setShowRepoModal] = React.useState(false);
  const [repoForm, setRepoForm] = React.useState<{
    label: string;
    description: string;
    url: string;
    type: RepoType;
  }>({ label: '', description: '', url: '', type: 'github' });

  // Estado para el modal de token GitHub
  const [showTokenModal, setShowTokenModal] = React.useState(false);
  const [tokenForm, setTokenForm] = React.useState<Omit<CreateGitHubTokenData, 'proyectoId'>>({
    nombre: '',
    token: '',
  });
  const [isSubmittingToken, setIsSubmittingToken] = React.useState(false);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [refreshTokens, setRefreshTokens] = React.useState(0);

  const [repoLinks, setRepoLinks] = React.useState<RepoLink[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = React.useState(false);
  const [repoError, setRepoError] = React.useState<string | null>(null);
  
  // Ref para rastrear si los repositorios ya fueron cargados desde loadRepositorios
  const reposLoadedFromApi = React.useRef(false);

  // Estado para commits de GitHub
  const [githubCommits, setGithubCommits] = React.useState<GitHubCommit[]>([]);
  const [isLoadingCommits, setIsLoadingCommits] = React.useState(false);
  const [commitsError, setCommitsError] = React.useState<string | null>(null);

  const loadRepositorios = React.useCallback(async () => {
    if (!project?.id) {
      setRepoLinks([]);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setRepoLinks([]);
      return;
    }

    setIsLoadingRepos(true);
    setRepoError(null);

    try {
      const response = await getRepositorios(proyectoId);
      setRepoLinks(response.repositorios);
      reposLoadedFromApi.current = true; // Marcar que los repositorios fueron cargados desde la API
    } catch (error: any) {
      console.error('Error cargando repositorios:', error);
      setRepoError(error.message || 'Error al cargar repositorios');
      setRepoLinks([]);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [project?.id]);

  // Cargar repositorios cuando cambia el proyecto
  React.useEffect(() => {
    reposLoadedFromApi.current = false; // Resetear el flag cuando cambia el proyecto
    loadRepositorios();
  }, [loadRepositorios]);

  // Cargar commits de GitHub cuando cambia el proyecto
  React.useEffect(() => {
    if (!project?.id) {
      setGithubCommits([]);
      return;
    }

    setIsLoadingCommits(true);
    setCommitsError(null);
    
    getProjectCommits(String(project.id), 8)
      .then((response) => {
        // Si no hay commits y no hay repositorios en la respuesta, no mostrar error
        if (response.commits.length === 0 && (!response.repositorios || response.repositorios.length === 0)) {
          setCommitsError(null);
          setGithubCommits([]);
          return;
        }
        
        setGithubCommits(response.commits);
        
        // Si hay errores en debug, establecer un mensaje de error más específico
        if (response.debug?.errores && response.debug.errores.length > 0) {
          const firstError = response.debug.errores[0];
          let errorMessage = `Error al obtener commits: ${firstError.error}`;
          if (firstError.status === 401 || firstError.status === 403) {
            errorMessage = 'El token de GitHub no tiene permisos para acceder a este repositorio. Verifica que el token tenga el scope "repo" y acceso al repositorio.';
          } else if (firstError.status === 404) {
            errorMessage = 'Repositorio no encontrado o sin acceso. Verifica que el repositorio exista y que el token tenga acceso.';
          }
          setCommitsError(errorMessage);
        } else if (response.commits.length === 0 && response.debug?.tokenConfigurado && response.repositorios && response.repositorios.length > 0) {
          // Solo mostrar error si hay repositorios configurados pero no hay commits
          setCommitsError('No se encontraron commits. El repositorio podría estar vacío o el token no tiene los permisos necesarios.');
        } else {
          // Limpiar error si todo está bien o si simplemente no hay repositorios
          setCommitsError(null);
        }
      })
      .catch((error: any) => {
        // Solo mostrar errores críticos, no errores esperados como "no hay repositorios"
        if (error.message && (
          error.message.includes('No hay repositorios configurados') ||
          error.message.includes('repositorios configurados')
        )) {
          // Este caso ya debería ser manejado por getProjectCommits, pero por si acaso
          setCommitsError(null);
          setGithubCommits([]);
          // NO limpiar repoLinks aquí, se cargan por separado con loadRepositorios()
        } else {
          // Para otros errores reales, mostrar el error
          console.error('Error cargando commits de GitHub:', error);
          setCommitsError(error.response?.data?.message || error.message || 'Error al cargar commits');
          setGithubCommits([]);
        }
      })
      .finally(() => {
        setIsLoadingCommits(false);
      });
  }, [project?.id]);

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);
  // Todos los usuarios autenticados pueden gestionar repositorios y tokens
  const canManageRepos = !!currentUser; // Cualquier usuario autenticado puede gestionar repos
  const isAdmin = currentUser?.role === 'admin';

  const handleOpenRepoModal = () => {
    setRepoForm({ label: '', description: '', url: '', type: 'github' });
    setShowRepoModal(true);
  };

  const handleCloseRepoModal = () => {
    setShowRepoModal(false);
  };

  const handleSubmitRepo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!project?.id) {
      setRepoError('No se pudo identificar el proyecto. Por favor, recarga la página.');
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setRepoError('ID de proyecto inválido.');
      return;
    }

    try {
      setRepoError(null);
      await createRepositorio({
        nombre: repoForm.label.trim() || 'Nuevo repositorio',
        descripcion: repoForm.description.trim() || undefined,
        url: repoForm.url.trim(),
        tipo: repoForm.type,
        proyectoId,
      });
      
      // Recargar repositorios usando la función loadRepositorios
      await loadRepositorios();
      
      setShowRepoModal(false);
      setRepoForm({ label: '', description: '', url: '', type: 'github' });
    } catch (error: any) {
      console.error('Error creando repositorio:', error);
      setRepoError(error.message || 'Error al crear el repositorio');
    }
  };

  const handleOpenTokenModal = () => {
    setTokenForm({ nombre: '', token: '' });
    setTokenError(null);
    setShowTokenModal(true);
  };

  const handleCloseTokenModal = () => {
    setShowTokenModal(false);
    setTokenForm({ nombre: '', token: '' });
    setTokenError(null);
  };

  const handleSubmitToken = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!tokenForm.nombre.trim() || !tokenForm.token.trim()) {
      setTokenError('El nombre y el token son requeridos');
      return;
    }

    if (!project?.id) {
      setTokenError('No se pudo identificar el proyecto. Por favor, recarga la página.');
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setTokenError('ID de proyecto inválido.');
      return;
    }

    setIsSubmittingToken(true);
    setTokenError(null);
    try {
      await createGitHubToken({ ...tokenForm, proyectoId });
      setShowTokenModal(false);
      setTokenForm({ nombre: '', token: '' });
      // Forzar actualización de tokens en RepoLinksSection
      setRefreshTokens((prev) => prev + 1);
    } catch (error: any) {
      console.error('Error creando token:', error);
      setTokenError(error.message || 'Error al crear el token');
    } finally {
      setIsSubmittingToken(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        projects={projectList}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogoutRequest={() => setShowLogoutConfirm(true)}
        selectedId={selectedId}
        onSelect={onSelect}
      />

      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          title="Repository"
          onBack={onBack}
          onProfileClick={onProfileClick}
          notifications={headerNotifications}
        />

        <main className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Proyecto</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">{project ? project.name : 'Tablero principal'}</h2>
              </div>
              {canManageRepos && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenRepoModal}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300"
                  >
                    Añadir repositorio
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenTokenModal}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300"
                  >
                    + Añadir token GitHub
                  </button>
                </div>
              )}
            </div>
            <p className="mt-4 max-w-3xl text-sm text-slate-600">
              Accede a los repositorios clave del proyecto, consulta documentación externa y revisa la actividad de commits.
              Usa esta vista como hub central para coordinar cambios entre frontend, backend y librerías compartidas.
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <RepoLinksSection 
              links={repoLinks} 
              proyectoId={project?.id ? Number(project.id) : undefined}
              currentUser={currentUser}
              refreshTrigger={refreshTokens}
              onRepositorioDeleted={loadRepositorios}
            />
            <CommitsSection 
              commits={githubCommits} 
              isLoading={isLoadingCommits}
              error={commitsError}
              hasRepositories={repoLinks.length > 0}
            />
          </div>
        </main>
      </div>

      {showRepoModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Añadir repositorio</h2>
                <p className="text-xs text-slate-500">
                  Completa la información del repositorio o recurso externo que quieras vincular al proyecto.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseRepoModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitRepo} className="space-y-4">
              {repoError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {repoError}
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Nombre
                  <input
                    type="text"
                    value={repoForm.label}
                    onChange={(event) => setRepoForm((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Ej. Backend API"
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tipo
                  <select
                    value={repoForm.type}
                    onChange={(event) => setRepoForm((prev) => ({ ...prev, type: event.target.value as RepoType }))}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="github">GitHub</option>
                    <option value="design">Design</option>
                    <option value="documentation">Documentación</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                URL
                <input
                  type="url"
                  value={repoForm.url}
                  onChange={(event) => setRepoForm((prev) => ({ ...prev, url: event.target.value }))}
                  placeholder="https://github.com/empresa/proyecto"
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descripción
                <textarea
                  value={repoForm.description}
                  onChange={(event) => setRepoForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Breve contexto del repositorio o enlace"
                  className="min-h-[110px] rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseRepoModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                >
                  Guardar repositorio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTokenModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Añadir token de GitHub</h2>
                <p className="text-xs text-slate-500">
                  Introduce un token de acceso personal de GitHub. El token se cifrará antes de guardarse.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseTokenModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitToken} className="space-y-4">
              {tokenError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {tokenError}
                </div>
              )}
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nombre del token
                <input
                  type="text"
                  value={tokenForm.nombre}
                  onChange={(e) =>
                    setTokenForm((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Ej. Token principal de producción"
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                  disabled={isSubmittingToken}
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Token de GitHub
                <input
                  type="password"
                  value={tokenForm.token}
                  onChange={(e) =>
                    setTokenForm((prev) => ({ ...prev, token: e.target.value }))
                  }
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                  disabled={isSubmittingToken}
                />
                <p className="text-xs text-slate-400">
                  Crea un token en{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GitHub Settings → Developer settings → Personal access tokens
                  </a>
                </p>
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseTokenModal}
                  disabled={isSubmittingToken}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingToken}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {isSubmittingToken ? 'Guardando...' : 'Guardar token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">¿Cerrar sesión?</h2>
            <p className="mt-2 text-sm text-slate-500">
              Tu sesión se cerrará y deberás volver a iniciar sesión para acceder al tablero.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout?.();
                }}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RepositoryPage;
