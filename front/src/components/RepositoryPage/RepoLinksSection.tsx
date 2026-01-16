import React, { useState, useEffect, useCallback } from 'react';
import { REPO_TYPE_LABELS } from './constants';
import {
  getGitHubTokens,
  updateGitHubToken,
  deleteGitHubToken,
  updateRepositorio,
  deleteRepositorio,
  GitHubToken,
  RepoLink,
} from '../../services/api';

type RepoLinksSectionProps = {
  links: RepoLink[];
  proyectoId?: number;
  currentUser?: {
    name: string;
    role: 'admin' | 'product-owner' | 'employee';
  };
  refreshTrigger?: number;
  onRepositorioDeleted?: () => void;
};

const RepoLinksSection: React.FC<RepoLinksSectionProps> = ({ links, proyectoId, currentUser, refreshTrigger, onRepositorioDeleted }) => {
  const isAdmin = currentUser?.role === 'admin';
  const canManageRepos = !!currentUser;
  const [tokens, setTokens] = useState<GitHubToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showDeleteRepoConfirm, setShowDeleteRepoConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    if (!proyectoId) {
      return;
    }
    
    setIsLoadingTokens(true);
    setError(null);
    try {
      const response = await getGitHubTokens(proyectoId);
      setTokens(response.tokens);
    } catch (err: any) {
      console.error('Error cargando tokens:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  }, [proyectoId]);

  // Cargar tokens para todos los usuarios autenticados
  useEffect(() => {
    if (canManageRepos && proyectoId) {
      loadTokens();
    }
  }, [canManageRepos, proyectoId, loadTokens, refreshTrigger]);

  const handleToggleActive = async (tokenId: number, currentStatus: boolean) => {
    try {
      await updateGitHubToken(tokenId.toString(), { activo: !currentStatus });
      await loadTokens();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el token');
      console.error('Error actualizando token:', err);
    }
  };

  const handleDeleteToken = async (tokenId: number) => {
    try {
      await deleteGitHubToken(tokenId.toString());
      setShowDeleteConfirm(null);
      await loadTokens();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el token');
      console.error('Error eliminando token:', err);
    }
  };

  const handleToggleRepositorioActive = async (repositorioId: string, currentStatus: boolean) => {
    try {
      await updateRepositorio(repositorioId, { activo: !currentStatus });
      setError(null);
      // Llamar al callback para refrescar la lista de repositorios
      if (onRepositorioDeleted) {
        onRepositorioDeleted();
      }
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el repositorio');
      console.error('Error actualizando repositorio:', err);
    }
  };

  const handleDeleteRepositorio = async (repositorioId: string) => {
    try {
      await deleteRepositorio(repositorioId);
      setShowDeleteRepoConfirm(null);
      setError(null);
      // Llamar al callback para refrescar la lista de repositorios
      if (onRepositorioDeleted) {
        onRepositorioDeleted();
      }
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el repositorio');
      console.error('Error eliminando repositorio:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const activeToken = tokens.find((t) => t.activo);

  return (
    <>
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Repositorios vinculados</h2>
            {activeToken && (
              <p className="mt-1 text-xs text-slate-500">
                Token activo: {activeToken.nombre}
              </p>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <ul className="space-y-3 text-sm text-slate-600">
          {links.map((link) => {
            const repositorio = link.repositorio;
            const isActive = repositorio?.activo ?? true;
            const showActions = canManageRepos && repositorio;
            
            return (
              <li key={link.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold uppercase tracking-wide">
                      {REPO_TYPE_LABELS[link.type]}
                    </span>
                    {showActions && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isActive ? '✓' : '○'}
                      </span>
                    )}
                  </div>
                  <a
                    href={link.url}
                    className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir ↗
                  </a>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <span className="text-sm font-semibold text-slate-900">{link.label}</span>
                    {link.description && <span className="text-xs text-slate-500">{link.description}</span>}
                  </div>
                  {showActions && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRepositorioActive(repositorio.id.toString(), isActive)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          isActive
                            ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            : 'border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                        title={isActive ? 'Desactivar' : 'Activar'}
                      >
                        {isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteRepoConfirm(repositorio.id.toString())}
                        className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                        title="Eliminar repositorio"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Sección de tokens (todos los usuarios pueden gestionar tokens) */}
        {canManageRepos && (
          <div className="mt-6 space-y-3 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Tokens de GitHub
            </h3>
            {isLoadingTokens ? (
              <div className="py-4 text-center text-xs text-slate-500">Cargando tokens...</div>
            ) : tokens.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                No hay tokens configurados. Añade uno para acceder a repositorios privados.
              </div>
            ) : (
              <ul className="space-y-2">
                {tokens.map((token) => (
                  <li
                    key={token.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900">{token.nombre}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            token.activo
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {token.activo ? '✓' : '○'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Creado por {token.creadoPor.nombreCompleto} el {formatDate(token.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(token.id, token.activo)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          token.activo
                            ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            : 'border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                        title={token.activo ? 'Desactivar' : 'Activar'}
                      >
                        {token.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(token.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Modal de confirmación para eliminar token */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Eliminar token</h2>
            <p className="mt-2 text-sm text-slate-500">
              ¿Estás seguro de que deseas eliminar este token? Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteToken(showDeleteConfirm)}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar repositorio */}
      {showDeleteRepoConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Eliminar repositorio</h2>
            <p className="mt-2 text-sm text-slate-500">
              ¿Estás seguro de que deseas eliminar este repositorio? Esta acción no se puede deshacer.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteRepoConfirm(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRepositorio(showDeleteRepoConfirm)}
                className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RepoLinksSection;

