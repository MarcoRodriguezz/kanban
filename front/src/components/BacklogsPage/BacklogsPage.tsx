import React from 'react';
import Sidebar, { DEFAULT_PROJECTS, SidebarProject } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import BacklogsHero from './BacklogsHero';
import BacklogsFilters from './BacklogsFilters';
import BacklogActivityList from './BacklogActivityList';
import { ACTION_FILTERS, BACKLOG_ACTIVITY } from './constants';
import type { BacklogActionType, BacklogActivityGroup } from './types';
import { getActividadesProyecto, Actividad } from '../../services/api';

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

type BacklogsPageProps = {
  project?: SidebarProject | null;
  projects?: SidebarProject[];
  selectedId: string;
  onSelect: (projectId: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  headerNotifications?: HeaderProps['notifications'];
};

const BacklogsPage: React.FC<BacklogsPageProps> = ({
  project,
  projects = DEFAULT_PROJECTS,
  selectedId,
  onSelect,
  onBack,
  onProfileClick,
  onLogout,
  headerNotifications,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<'all' | BacklogActionType>('all');
  const [authorSearch, setAuthorSearch] = React.useState('');
  const [activities, setActivities] = React.useState<BacklogActivityGroup[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = React.useState(false);
  const [activitiesError, setActivitiesError] = React.useState<string | null>(null);

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);

  // El backend ya procesa las actividades y proporciona backlogAction

  // Función para cargar actividades
  const cargarActividades = React.useCallback(() => {
    if (!project?.id) {
      setActivities([]);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setActivities([]);
      return;
    }

    setIsLoadingActivities(true);
    setActivitiesError(null);

    // Obtener actividades del proyecto desde el backend (ya procesadas)
    getActividadesProyecto(String(proyectoId), 1, 200)
      .then((response) => {
        // Agrupar actividades por fecha
        const actividadesPorFecha = new Map<string, any[]>();
        
        // El backend ya filtra y procesa las actividades, solo usar las que tienen backlogAction
        const actividadesFiltradas = response.actividades.filter(
          (act: Actividad) => act.backlogAction !== undefined && act.backlogAction !== null
        );
        
        
        actividadesFiltradas.forEach((actividad: Actividad) => {
          const fecha = new Date(actividad.createdAt);
          const fechaKey = fecha.toLocaleDateString('es-ES', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          });
          
          if (!actividadesPorFecha.has(fechaKey)) {
            actividadesPorFecha.set(fechaKey, []);
          }
          
          // Usar los campos procesados del backend
          const accionMapeada = actividad.backlogAction as BacklogActionType;
          if (accionMapeada) {
            const usuarioNombre = actividad.usuario?.nombreCompleto || 'Usuario desconocido';
            const iniciales = usuarioNombre
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join('') || 'U';
            
            // Usar los campos procesados del backend (from, to, taskTitle)
            const from = actividad.from;
            const to = actividad.to;
            const taskTitle = actividad.taskTitle || actividad.descripcion || `${actividad.entidad} ${actividad.entidadId}`;
            
            // Formatear timestamp con fecha y hora
            const timestamp = `${fecha.toLocaleDateString('es-ES', { 
              day: 'numeric', 
              month: 'short' 
            })} · ${fecha.toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}`;
            
            actividadesPorFecha.get(fechaKey)!.push({
              id: `log-${actividad.id}`,
              timestamp,
              author: usuarioNombre,
              actorInitials: iniciales,
              action: accionMapeada,
              taskId: actividad.entidad === 'Proyecto' ? `PROJ-${actividad.entidadId}` : `KB-${actividad.entidadId}`,
              taskTitle,
              from,
              to,
              notes: actividad.descripcion,
            });
          }
        });

        // Convertir a formato BacklogActivityGroup[]
        const grupos: BacklogActivityGroup[] = Array.from(actividadesPorFecha.entries())
          .map(([date, entries]) => ({
            date,
            entries: entries.sort((a, b) => {
              // Ordenar por timestamp descendente
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }),
          }))
          .sort((a, b) => {
            // Ordenar por fecha descendente
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });

        setActivities(grupos.length > 0 ? grupos : []);
      })
      .catch((error: any) => {
        console.error('Error cargando actividades del proyecto:', error);
        setActivitiesError(error.message || 'Error al cargar las actividades del proyecto');
        // No usar datos por defecto, dejar vacío si falla
        setActivities([]);
      })
      .finally(() => {
        setIsLoadingActivities(false);
      });
  }, [project?.id]);

  // Cargar actividades cuando cambia el proyecto
  React.useEffect(() => {
    cargarActividades();
  }, [cargarActividades]);

  // Recargar actividades cuando la página vuelve a estar visible
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && project?.id) {
        cargarActividades();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cargarActividades, project?.id]);

  // Recargar actividades cuando la ventana vuelve a tener foco
  React.useEffect(() => {
    const handleFocus = () => {
      if (project?.id) {
        cargarActividades();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [cargarActividades, project?.id]);

  const filteredActivity = React.useMemo<BacklogActivityGroup[]>(() => {
    
    const normalizedSearch = normalizeText(authorSearch.trim());

    const filtered = activities.map((group) => {
      const entries = group.entries.filter((entry) => {
        const matchesAction = activeFilter === 'all' || entry.action === activeFilter;
        const matchesAuthor =
          normalizedSearch === '' || normalizeText(entry.author).includes(normalizedSearch);
        return matchesAction && matchesAuthor;
      });

      return {
        date: group.date,
        entries,
      };
    }).filter((group) => group.entries.length > 0);
    
    return filtered;
  }, [activeFilter, authorSearch, activities]);

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
          title="Backlogs"
          onBack={onBack}
          onProfileClick={onProfileClick}
          notifications={headerNotifications}
        />

        <main className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
          <BacklogsHero projectName={project ? project.name : 'Tablero principal'} />

          {activitiesError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {activitiesError}
            </div>
          )}

          <BacklogsFilters
            filters={ACTION_FILTERS}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            authorSearch={authorSearch}
            onAuthorSearchChange={setAuthorSearch}
          />

          {isLoadingActivities ? (
            <div className="py-12 text-center text-sm text-slate-500">Cargando actividades...</div>
          ) : (
            <BacklogActivityList groups={filteredActivity} />
          )}
        </main>
      </div>

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

export default BacklogsPage;
