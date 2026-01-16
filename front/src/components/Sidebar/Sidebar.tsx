import React from 'react';
import { BOARD_MEMBERS } from '../BoardPage/boardData';
import { getUsuarios } from '../../services/api';

export type SidebarProject = {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  ownerId?: string; // ID del usuario responsable/gestor
  team?: string;
  startDate?: string;
  endDate?: string;
  status?: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado';
};

const TasksIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect
      x="3.5"
      y="2.5"
      width="17"
      height="19"
      rx="2.5"
      ry="2.5"
      stroke="#0F172A"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 7.5 L9 9.5 L12 6.5"
      stroke="#0F172A"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 12.5 L9 14.5 L12 11.5"
      stroke="#0F172A"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 17.5 L9 19.5 L12 16.5"
      stroke="#0F172A"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="13.5"
      y1="8"
      x2="18"
      y2="8"
      stroke="#0F172A"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <line
      x1="13.5"
      y1="13"
      x2="18"
      y2="13"
      stroke="#0F172A"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <line
      x1="13.5"
      y1="18"
      x2="18"
      y2="18"
      stroke="#0F172A"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

type SidebarProps = {
  projects?: SidebarProject[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogoutRequest?: () => void;
  onSelect?: (projectId: string) => void;
  selectedId?: string | null;
  onCreateProject?: (project: Omit<SidebarProject, 'id'>) => Promise<void>;
  currentUser?: { name: string; id?: string } | null;
};

export const DEFAULT_PROJECTS: SidebarProject[] = [
  {
    id: 'marketing',
    name: 'Marketing Launch',
    description: 'Campañas y lanzamientos',
    owner: 'Laura Méndez',
    team: 'Marketing',
    startDate: '2025-01-10',
    endDate: '2025-04-30',
    status: 'Pendiente',
  },
  {
    id: 'desarrollo',
    name: 'Desarrollo Web',
    description: 'Infraestructura y nuevas features',
    owner: 'Carlos Ortega',
    team: 'Frontend + Backend',
    startDate: '2025-02-03',
    endDate: '2025-07-15',
    status: 'En progreso',
  },
  {
    id: 'design',
    name: 'UI/UX Design',
    description: 'Investigación y prototipos',
    owner: 'Ana Ruiz',
    team: 'Product Design',
    startDate: '2025-03-01',
    endDate: '2025-05-20',
    status: 'En revisión',
  },
  {
    id: 'ventas',
    name: 'Ventas Enterprise',
    description: 'Embudo y seguimiento',
    owner: 'Javier Morales',
    team: 'Sales Ops',
    startDate: '2025-01-15',
    endDate: '2025-06-30',
    status: 'Completado',
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  projects,
  collapsed = false,
  onToggleCollapse,
  onLogoutRequest,
  onSelect,
  selectedId = 'my-tasks',
  onCreateProject,
  currentUser,
}) => {
  const projectList = projects ?? DEFAULT_PROJECTS;
  const [showNewProjectModal, setShowNewProjectModal] = React.useState(false);
  const [newProjectForm, setNewProjectForm] = React.useState({
    name: '',
    description: '',
    team: '',
    owner: '', // Nombre del responsable (para mostrar)
    ownerId: '', // ID del responsable (para enviar al backend como gestorId)
  });
  const [availableUsers, setAvailableUsers] = React.useState<Array<{ id: string; name: string }>>([]);

  // Cargar lista de usuarios disponibles cuando se abre el modal
  React.useEffect(() => {
    if (showNewProjectModal) {
      const loadUsers = async () => {
        try {
          const response = await getUsuarios();
          const usuarios = response.usuarios || [];
          setAvailableUsers(usuarios.map(u => ({ id: u.id, name: u.name })));
        } catch (error) {
          console.error('Error cargando usuarios:', error);
          // Si falla, usar BOARD_MEMBERS como fallback
          setAvailableUsers(BOARD_MEMBERS.filter(m => m.display !== 'Sin asignar').map(m => ({ id: m.id, name: m.name })));
        }
      };
      loadUsers();
    }
  }, [showNewProjectModal]);

  // Combinar usuarios del backend con el usuario actual si no está incluido
  const responsibleOptions = React.useMemo(() => {
    const users = new Map<string, { id: string; name: string }>();
    
    // Agregar usuarios del backend
    availableUsers.forEach(user => {
      users.set(user.name, user);
    });
    
    // Agregar usuario actual si no está incluido
    if (currentUser?.name && !users.has(currentUser.name)) {
      users.set(currentUser.name, { id: currentUser.id || '', name: currentUser.name });
    }
    
    // Si no hay usuarios del backend, usar BOARD_MEMBERS como fallback
    if (users.size === 0) {
      BOARD_MEMBERS.filter(m => m.display !== 'Sin asignar').forEach(member => {
        users.set(member.name, { id: member.id, name: member.name });
      });
    }
    
    return Array.from(users.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableUsers, currentUser]);

  const handleSelect = (projectId: string) => {
    onSelect?.(projectId);
  };

  const handleOpenNewProjectModal = () => {
    setNewProjectForm({
      name: '',
      description: '',
      team: '',
      owner: '',
      ownerId: '',
    });
    setCreateProjectError(null);
    setShowNewProjectModal(true);
  };

  const handleCloseNewProjectModal = () => {
    setShowNewProjectModal(false);
    setCreateProjectError(null);
  };

  const [isCreatingProject, setIsCreatingProject] = React.useState(false);
  const [createProjectError, setCreateProjectError] = React.useState<string | null>(null);

  const handleSubmitNewProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Validar que onCreateProject esté definido
    if (!onCreateProject) {
      setCreateProjectError('Error: No se puede crear el proyecto. Por favor, recarga la página.');
      console.error('onCreateProject no está definido');
      return;
    }
    
    // Validar que el nombre no esté vacío (aunque el input tiene required, validamos por si acaso)
    if (!newProjectForm.name.trim()) {
      setCreateProjectError('El nombre del proyecto es requerido');
      return;
    }
    
    // Limpiar errores previos
    setCreateProjectError(null);
    setIsCreatingProject(true);
    
    try {
      // Si no se seleccionó un responsable, usar el usuario actual (se manejará en handleCreateProject)
      await onCreateProject({
        name: newProjectForm.name.trim(),
        description: newProjectForm.description.trim() || undefined,
        team: newProjectForm.team.trim() || undefined,
        owner: newProjectForm.owner.trim() || undefined,
        // Solo enviar ownerId si tiene un valor válido (no string vacío)
        ownerId: newProjectForm.ownerId && newProjectForm.ownerId.trim() ? newProjectForm.ownerId : undefined,
      });
      // Solo cerrar el modal si la creación fue exitosa
      setShowNewProjectModal(false);
      // Limpiar el formulario
      setNewProjectForm({
        name: '',
        description: '',
        team: '',
        owner: '',
        ownerId: '',
      });
      setCreateProjectError(null);
    } catch (error: any) {
      console.error('Error creando proyecto:', error);
      // Mostrar error específico al usuario
      const errorMessage = error?.message || error?.error || 'Error al crear el proyecto. Por favor, intenta nuevamente.';
      setCreateProjectError(errorMessage);
      // No cerrar el modal si hay un error, para que el usuario pueda intentar de nuevo
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <aside
      className={`sticky top-0 z-30 flex h-screen flex-col border-r border-slate-200 bg-slate-50/60 p-4 text-slate-700 transition-[width] duration-300 ease-out ${
        collapsed ? 'w-18' : 'w-60'
      }`}
    >
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <img src="/img/kanban-logo2.svg" alt="Kanban" className="h-10 w-10" />
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="Expandir sidebar"
            >
              <span className="text-xl">»</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('my-tasks')}
              className={`mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                selectedId === 'my-tasks'
                  ? 'border-slate-400 bg-slate-300 text-slate-900'
                  : 'border-slate-300 bg-slate-100 text-slate-700 hover:border-blue-200'
              }`}
              aria-label="Mis tareas"
            >
              <TasksIcon />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <img src="/img/kanban-logo.svg" alt="Kanban" className="h-8" />
              <button
                type="button"
                onClick={onToggleCollapse}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                aria-label="Contraer sidebar"
              >
                <span className="text-xl">«</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleSelect('my-tasks')}
              className={`mt-6 flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                selectedId === 'my-tasks'
                  ? 'border-transparent bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100'
              }`}
            >
              <span>Mis tareas</span>
            </button>
            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Proyectos
              </h2>
              <button
                type="button"
                onClick={handleOpenNewProjectModal}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                aria-label="Crear nuevo proyecto"
              >
                <span className="text-sm font-semibold">+</span>
              </button>
            </div>
          </>
        )}

        {!collapsed && (
          <div>
            <div className="mt-4 space-y-2">
              {projectList.map((project) => {
                const isActive = project.id === selectedId;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelect(project.id)}
                    className={`flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-500/20 ${
                      isActive
                        ? 'border-transparent bg-white shadow-lg shadow-blue-500/10'
                        : 'border-transparent bg-white/70 hover:border-blue-100 hover:bg-white'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-900">{project.name}</span>
                    {project.description && (
                      <span className="text-xs text-slate-500">{project.description}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onLogoutRequest}
          className={`mx-auto inline-flex items-center justify-center rounded-full text-sm font-semibold text-slate-500 transition hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500/20 ${
            collapsed ? 'h-10 w-10' : 'gap-2 px-4 py-2'
          }`}
        >
          <img src="/img/log_out-icon.svg" alt="Cerrar sesión" className="h-5 w-5" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
      {showNewProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Crear nuevo proyecto</h2>
                <p className="text-xs text-slate-500">Completa los datos para crear un nuevo proyecto.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseNewProjectModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitNewProject} className="space-y-4">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nombre del proyecto
                <input
                  type="text"
                  value={newProjectForm.name}
                  onChange={(event) => setNewProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ej: Marketing Launch"
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </label>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descripción
                <textarea
                  value={newProjectForm.description}
                  onChange={(event) => setNewProjectForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Breve descripción del proyecto"
                  className="min-h-[80px] rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Equipo
                  <input
                    type="text"
                    value={newProjectForm.team}
                    onChange={(event) => setNewProjectForm((prev) => ({ ...prev, team: event.target.value }))}
                    placeholder="Ej: Marketing"
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </label>

                <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Responsable
                  <select
                    value={newProjectForm.ownerId}
                    onChange={(event) => {
                      const selectedUser = responsibleOptions.find(u => u.id === event.target.value);
                      setNewProjectForm((prev) => ({ 
                        ...prev, 
                        ownerId: event.target.value,
                        owner: selectedUser?.name || ''
                      }));
                    }}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">Selecciona un responsable</option>
                    {responsibleOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {createProjectError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {createProjectError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseNewProjectModal}
                  disabled={isCreatingProject}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject || !newProjectForm.name.trim()}
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingProject ? 'Creando...' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;

