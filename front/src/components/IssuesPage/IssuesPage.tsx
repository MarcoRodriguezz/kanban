import React from 'react';
import Sidebar, { SidebarProject, DEFAULT_PROJECTS } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import { getIssues, createIssue, updateIssueStatus, Issue as ApiIssue } from '../../services/api';

type IssueCategory = 'Bug' | 'Mejora' | 'Idea' | 'Pregunta';

type IssueStatus = 'Abierto' | 'En revisión' | 'Asignado' | 'Resuelto';

type IssuePriority = 'Alta' | 'Media' | 'Baja';

type Issue = {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  priority: IssuePriority;
  reporter: string;
  createdAt: string;
  assignee?: string;
};

type IssuesPageProps = {
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
    role?: 'admin' | 'product-owner' | 'employee';
    rol?: string;
  };
};

const ISSUE_CATEGORIES: IssueCategory[] = ['Bug', 'Mejora', 'Idea', 'Pregunta'];
const ISSUE_PRIORITIES: IssuePriority[] = ['Alta', 'Media', 'Baja'];
const ISSUE_STATUSES: IssueStatus[] = ['Abierto', 'En revisión', 'Asignado', 'Resuelto'];

const CURRENT_USER_FALLBACK = {
  name: 'María Sánchez',
  role: 'employee' as const,
  rol: undefined as string | undefined,
};

const INITIAL_ISSUES: Issue[] = [
  {
    id: 'ISS-120',
    title: 'Error al guardar etiquetas en Board',
    description: 'Cuando añado una etiqueta personalizada y guardo, la etiqueta desaparece al refrescar la página.',
    category: 'Bug',
    status: 'En revisión',
    priority: 'Alta',
    reporter: 'Daniel P.',
    createdAt: '2025-04-08',
    assignee: 'Product Owner',
  },
  {
    id: 'ISS-121',
    title: 'Atajo para mover tarjetas',
    description: 'Propuesta de atajo (Shift + flechas) para reordenar tarjetas dentro de la misma columna.',
    category: 'Idea',
    status: 'Abierto',
    priority: 'Media',
    reporter: 'Ana R.',
    createdAt: '2025-04-10',
  },
  {
    id: 'ISS-122',
    title: 'Tooltip con métricas en timeline',
    description: 'Sería útil mostrar métricas (personas asignadas, fechas clave) cuando se pasa el cursor por un release.',
    category: 'Mejora',
    status: 'Asignado',
    priority: 'Baja',
    reporter: 'Carlos O.',
    createdAt: '2025-04-11',
    assignee: 'Laura M.',
  },
];

const formatDisplayDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const IssuesPage: React.FC<IssuesPageProps> = ({
  project,
  projects = DEFAULT_PROJECTS,
  selectedId,
  onSelect,
  onBack,
  onProfileClick,
  onLogout,
  headerNotifications,
  currentUser = CURRENT_USER_FALLBACK,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [isLoadingIssues, setIsLoadingIssues] = React.useState(false);
  const [issuesError, setIssuesError] = React.useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = React.useState<IssueCategory | 'Todas'>('Todas');
  const [statusFilter, setStatusFilter] = React.useState<IssueStatus | 'Todos'>('Todos');
  const [priorityFilter, setPriorityFilter] = React.useState<IssuePriority | 'Todas'>('Todas');
  const [searchTerm, setSearchTerm] = React.useState('');

  const [showNewIssueModal, setShowNewIssueModal] = React.useState(false);
  const [newIssueForm, setNewIssueForm] = React.useState<{
    title: string;
    description: string;
    category: IssueCategory;
    priority: IssuePriority;
  }>({
    title: '',
    description: '',
    category: 'Bug',
    priority: 'Media',
  });

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);

  // Cargar issues cuando cambia el proyecto
  React.useEffect(() => {
    if (!project?.id) {
      setIssues([]);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setIssues([]);
      return;
    }

    setIsLoadingIssues(true);
    setIssuesError(null);

    getIssues(String(proyectoId))
      .then((issuesApi: ApiIssue[]) => {
        // Mapear issues de la API al formato del componente
        const issuesMapeados: Issue[] = issuesApi.map((issueApi) => ({
          id: issueApi.id,
          title: issueApi.title,
          description: issueApi.description || '',
          category: issueApi.category as IssueCategory,
          status: issueApi.status as IssueStatus,
          priority: issueApi.priority as IssuePriority,
          reporter: issueApi.reporter,
          createdAt: issueApi.createdAt,
          assignee: issueApi.assignee,
        }));

        setIssues(issuesMapeados);
      })
      .catch((error: any) => {
        console.error('Error cargando issues:', error);
        setIssuesError(error.message || 'Error al cargar los issues');
        setIssues([]);
      })
      .finally(() => {
        setIsLoadingIssues(false);
      });
  }, [project?.id]);

  const filteredIssues = React.useMemo(() => {
    return issues.filter((issue) => {
      const matchesCategory = categoryFilter === 'Todas' || issue.category === categoryFilter;
      const matchesStatus = statusFilter === 'Todos' || issue.status === statusFilter;
      const matchesPriority = priorityFilter === 'Todas' || issue.priority === priorityFilter;
      const matchesSearch =
        searchTerm.trim() === '' ||
        issue.title.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        issue.description.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        issue.reporter.toLowerCase().includes(searchTerm.trim().toLowerCase());

      return matchesCategory && matchesStatus && matchesPriority && matchesSearch;
    });
  }, [categoryFilter, statusFilter, priorityFilter, searchTerm, issues]);

  // Solo administradores pueden cambiar el estado de los issues
  const canManageIssues = currentUser.rol === 'Administrador';

  const handleOpenNewIssueModal = () => {
    setNewIssueForm({
      title: '',
      description: '',
      category: 'Bug',
      priority: 'Media',
    });
    setShowNewIssueModal(true);
  };

  const handleCloseNewIssueModal = () => {
    setShowNewIssueModal(false);
  };

  const handleSubmitIssue = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!project?.id) {
      alert('No se pudo identificar el proyecto. Por favor, recarga la página.');
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      alert('ID de proyecto inválido.');
      return;
    }

    try {
      const response = await createIssue({
        title: newIssueForm.title.trim() || 'Nuevo problema',
        description: newIssueForm.description.trim(),
        category: newIssueForm.category,
        priority: newIssueForm.priority,
        projectId: String(proyectoId),
      });

      // Mapear el issue de la API al formato del componente
      const nuevoIssue: Issue = {
        id: response.issue.id,
        title: response.issue.title,
        description: response.issue.description,
        category: response.issue.category as IssueCategory,
        status: response.issue.status as IssueStatus,
        priority: response.issue.priority as IssuePriority,
        reporter: response.issue.reporter,
        createdAt: response.issue.createdAt,
        assignee: response.issue.assignee,
      };

      setIssues((prev) => [nuevoIssue, ...prev]);
      setShowNewIssueModal(false);
    } catch (error: any) {
      console.error('Error creando issue:', error);
      alert(error.message || 'Error al crear el issue. Por favor, intenta de nuevo.');
    }
  };

  const handleIssueStatusChange = async (index: number, status: IssueStatus) => {
    const issue = issues[index];
    if (!issue) return;

    try {
      const response = await updateIssueStatus(issue.id, status);
      
      // Actualizar el issue en el estado local
      setIssues((prev) =>
        prev.map((item) => (item.id === issue.id ? { ...item, status: response.issue.status as IssueStatus } : item))
      );
    } catch (error: any) {
      console.error('Error actualizando estado del issue:', error);
      alert(error.message || 'Error al actualizar el estado del issue. Por favor, intenta de nuevo.');
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
          title="Issues"
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
              {issuesError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {issuesError}
                </div>
              )}
              <button
                type="button"
                onClick={handleOpenNewIssueModal}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300"
              >
                Reportar problema
              </button>
            </div>
            <p className="mt-4 max-w-3xl text-sm text-slate-600">
              Registra bugs, sugerencias o ideas. Los Product Owners y administradores podrán priorizarlos, asignarlos y darles
              seguimiento para mantener el producto estable y alineado a las necesidades del equipo.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Listado de issues</h3>
                <p className="text-xs text-slate-500">Filtra por tipo, estado o prioridad y revisa los reportes recientes.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-500">
                  <span className="text-slate-400">Buscar</span>
                  <input
                    type="search"
                    placeholder="Título, autor..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-40 bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as IssueCategory | 'Todas')}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  <option value="Todas">Todas las categorías</option>
                  {ISSUE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as IssueStatus | 'Todos')}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  <option value="Todos">Todos los estados</option>
                  {ISSUE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value as IssuePriority | 'Todas')}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  <option value="Todas">Todas las prioridades</option>
                  {ISSUE_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            {isLoadingIssues ? (
              <div className="mt-6 py-12 text-center text-sm text-slate-500">Cargando issues...</div>
            ) : filteredIssues.length === 0 ? (
              <div className="mt-6 py-12 text-center text-sm text-slate-500">No hay issues disponibles</div>
            ) : (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-600">
                  <thead className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-3 font-semibold">ID</th>
                      <th className="px-3 py-3 font-semibold">Título</th>
                      <th className="px-3 py-3 font-semibold">Categoría</th>
                      <th className="px-3 py-3 font-semibold">Prioridad</th>
                      <th className="px-3 py-3 font-semibold">Estado</th>
                      <th className="px-3 py-3 font-semibold">Reportado por</th>
                      <th className="px-3 py-3 font-semibold">Creado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredIssues.map((issue, index) => (
                    <tr key={issue.id} className="hover:bg-slate-50">
                      <td className="px-3 py-4 text-xs font-semibold text-slate-400">{issue.id}</td>
                      <td className="px-3 py-4 font-semibold text-slate-900">
                        <div className="flex flex-col gap-1">
                          <span>{issue.title}</span>
                          {issue.description && <span className="text-xs text-slate-500">{issue.description}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-500">{issue.category}</td>
                      <td className="px-3 py-4 text-xs text-slate-500">{issue.priority}</td>
                      <td className="px-3 py-4">
                        {canManageIssues ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ISSUE_STATUSES.map((status) => (
                              <button
                                key={`${issue.id}-${status}`}
                                type="button"
                                onClick={() => handleIssueStatusChange(issues.findIndex((item) => item.id === issue.id), status)}
                                className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide transition ${
                                  issue.status === status
                                    ? 'border-blue-300 bg-blue-50 text-blue-600'
                                    : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                            {issue.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-xs text-slate-500">{issue.reporter}</td>
                      <td className="px-3 py-4 text-xs text-slate-500">{formatDisplayDate(issue.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </section>
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

      {showNewIssueModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Reportar nuevo issue</h2>
                <p className="text-xs text-slate-500">
                  Describe el problema, sugerencia o idea para que el equipo de producto pueda revisarlo.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseNewIssueModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Título
                  <input
                    type="text"
                    value={newIssueForm.title}
                    onChange={(event) => setNewIssueForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Resumen corto del issue"
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Categoría
                  <select
                    value={newIssueForm.category}
                    onChange={(event) => setNewIssueForm((prev) => ({ ...prev, category: event.target.value as IssueCategory }))}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {ISSUE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Prioridad
                  <select
                    value={newIssueForm.priority}
                    onChange={(event) => setNewIssueForm((prev) => ({ ...prev, priority: event.target.value as IssuePriority }))}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {ISSUE_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Visibilidad
                  <span className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Reportado por <span className="font-semibold text-slate-800">{currentUser.name}</span>
                  </span>
                </div>
              </div>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descripción
                <textarea
                  value={newIssueForm.description}
                  onChange={(event) => setNewIssueForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Incluye pasos a reproducir, impacto o contexto adicional"
                  className="min-h-[120px] rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseNewIssueModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                >
                  Guardar issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuesPage;

