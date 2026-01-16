import React from 'react';
import { CommitEntry } from './types';
import { GitHubCommit } from '../../services/api';

type CommitsSectionProps = {
  commits: CommitEntry[] | GitHubCommit[];
  isLoading?: boolean;
  error?: string | null;
  hasRepositories?: boolean;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date);
};

const CommitsSection: React.FC<CommitsSectionProps> = ({ commits, isLoading, error, hasRepositories }) => {
  // Verificar si son commits de GitHub o commits estáticos
  const isGitHubCommit = (commit: CommitEntry | GitHubCommit): commit is GitHubCommit => {
    return 'url' in commit && 'authorEmail' in commit;
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
      <header className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Commits recientes</h3>
        <p className="text-xs text-slate-500">Seguimiento de las últimas contribuciones y su estado actual.</p>
      </header>

      {isLoading && (
        <div className="py-8 text-center text-sm text-slate-500">
          Cargando commits...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {!isLoading && !error && commits.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500">
            {hasRepositories === false 
              ? 'No hay repositorios configurados' 
              : 'No hay commits disponibles'}
          </p>
          {hasRepositories === false && (
            <p className="mt-2 text-xs text-slate-400">
              Añade repositorios de GitHub desde la sección de enlaces para ver los commits aquí.
            </p>
          )}
        </div>
      )}

      {!isLoading && !error && commits.length > 0 && (
        <ul className="space-y-3 text-sm text-slate-600">
          {commits.map((commit, index) => {
            if (isGitHubCommit(commit)) {
              // Commit de GitHub
              return (
                <li 
                  key={`${commit.sha}-${index}`} 
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 hover:border-slate-300 transition"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{commit.author}</span>
                    <span>{formatDate(commit.date)}</span>
                  </div>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition"
                  >
                    {commit.message}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Hash {commit.sha}</span>
                    <span>•</span>
                    <span className="font-mono">{commit.repo}</span>
                  </div>
                </li>
              );
            } else {
              // Commit estático (fallback)
              return (
                <li key={commit.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{commit.author}</span>
                    <span>{commit.timestamp}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{commit.message}</span>
                  <span className="text-xs text-slate-500">Hash {commit.sha}</span>
                </li>
              );
            }
          })}
        </ul>
      )}
    </section>
  );
};

export default CommitsSection;

