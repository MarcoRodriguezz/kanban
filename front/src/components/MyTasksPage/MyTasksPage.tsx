import React, { useState, useEffect } from 'react';
import { getUserTasks, UserTask } from '../../services/api';
import { PRIORITY_BADGE_STYLES } from '../BoardPage/boardData';

export type MyTask = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: 'Pendiente' | 'En progreso' | 'En revisión' | 'Completado';
  priority: 'Alta' | 'Media' | 'Baja';
  dueDate: string;
  dueDateRaw?: string; // Fecha original sin formatear para ordenamiento
  boardTaskRef?: {
    columnId: string;
    taskId: string;
  };
};

// Función para formatear la fecha límite
const formatDueDate = (dateString: string): string => {
  if (!dateString || dateString === 'Sin fecha') {
    return 'Sin fecha';
  }

  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    const diffTime = taskDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Hoy';
    } else if (diffDays === 1) {
      return 'Mañana';
    } else if (diffDays === -1) {
      return 'Ayer';
    } else if (diffDays > 0 && diffDays <= 7) {
      return `En ${diffDays} días`;
    } else {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
      }).format(date);
    }
  } catch {
    return dateString;
  }
};

const statusStyles: Record<MyTask['status'], string> = {
  Pendiente: 'bg-amber-100 text-amber-700',
  'En progreso': 'bg-blue-100 text-blue-700',
  'En revisión': 'bg-purple-100 text-purple-700',
  Completado: 'bg-emerald-100 text-emerald-700',
};

type MyTasksPageProps = {
  tasks?: MyTask[];
  onOpenProject?: (projectId: string) => void;
  onOpenTaskDetails?: (task: MyTask) => void;
  onOpenBoardTask?: (options: { taskId: string; columnId?: string; projectId: string }) => void;
  title?: string;
  description?: string;
};

const MyTasksPage: React.FC<MyTasksPageProps> = ({
  tasks: tasksProp,
  onOpenProject,
  onOpenTaskDetails,
  onOpenBoardTask,
  title = 'Mis tareas asignadas',
  description = 'Consulta tus tareas pendientes y su estado actual dentro de cada proyecto.',
}) => {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Estado para ordenamiento
  const [sortBy, setSortBy] = useState<'priority' | 'dueDate' | 'none'>('none');
  
  // Estado para mostrar/ocultar el menú de filtros
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);

  useEffect(() => {
    // Si se pasan tareas como prop, usarlas directamente (asegurando que tengan dueDateRaw)
    if (tasksProp) {
      const tasksWithRawDate = tasksProp.map(task => ({
        ...task,
        dueDateRaw: task.dueDateRaw || (task.dueDate && task.dueDate !== 'Sin fecha' ? task.dueDate : undefined),
      }));
      setTasks(tasksWithRawDate);
      return;
    }

    // Si no, cargar desde el backend
    const loadTasks = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userTasks = await getUserTasks();
        // Convertir UserTask[] a MyTask[]
        const convertedTasks: MyTask[] = userTasks.map((task) => ({
          id: task.id,
          title: task.title,
          projectId: task.projectId,
          projectName: task.projectName,
          status: task.status as MyTask['status'],
          priority: task.priority,
          dueDate: task.dueDate ? formatDueDate(task.dueDate) : 'Sin fecha',
          dueDateRaw: task.dueDate || undefined, // Guardar fecha original para ordenamiento (undefined si es null)
          boardTaskRef: task.boardTaskRef && task.boardTaskRef.columnId
            ? {
                taskId: task.boardTaskRef.taskId,
                columnId: task.boardTaskRef.columnId,
              }
            : undefined,
        }));
        setTasks(convertedTasks);
      } catch (err: any) {
        console.error('Error cargando tareas:', err);
        setError(err.message || 'Error al cargar las tareas asignadas');
      } finally {
        setIsLoading(false);
      }
    };

    loadTasks();
  }, [tasksProp]);

  const handleTaskClick = (task: MyTask) => {
    if (onOpenTaskDetails) {
      onOpenTaskDetails(task);
    } else if (onOpenBoardTask && task.boardTaskRef) {
      // Si hay referencia al board, abrir la tarea en el board
      onOpenBoardTask({
        taskId: task.boardTaskRef.taskId,
        columnId: task.boardTaskRef.columnId,
        projectId: task.projectId,
      });
    } else {
      // Si no, abrir el proyecto
      onOpenProject?.(task.projectId);
    }
  };

  // Obtener lista única de proyectos
  const projects = React.useMemo(() => {
    const projectMap = new Map<string, string>();
    tasks.forEach(task => {
      if (!projectMap.has(task.projectId)) {
        projectMap.set(task.projectId, task.projectName);
      }
    });
    return Array.from(projectMap.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Función auxiliar para aplicar ordenamiento
  const applySorting = (tasksToSort: MyTask[]): MyTask[] => {
    const sorted = [...tasksToSort];
    
    if (sortBy === 'priority') {
      const priorityOrder: Record<'Alta' | 'Media' | 'Baja', number> = {
        'Alta': 3,
        'Media': 2,
        'Baja': 1,
      };
      sorted.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
    } else if (sortBy === 'dueDate') {
      sorted.sort((a, b) => {
        // Obtener fechas válidas normalizadas a medianoche o null si no hay fecha
        const getValidDate = (dateString: string | undefined): number | null => {
          if (!dateString || dateString === 'Sin fecha' || dateString.trim() === '') {
            return null;
          }
          
          try {
            // Parsear la fecha
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
              return null;
            }
            
            // Normalizar a medianoche en hora local para comparar solo fechas (sin horas)
            // Usar getFullYear, getMonth, getDate para evitar problemas de zona horaria
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            const normalizedDate = new Date(year, month, day);
            
            return normalizedDate.getTime();
          } catch {
            return null;
          }
        };

        const dateA = getValidDate(a.dueDateRaw);
        const dateB = getValidDate(b.dueDateRaw);

        // Si ambas tienen fecha, ordenar de más cercana a más lejana (ascendente)
        if (dateA !== null && dateB !== null) {
          // Comparar directamente los timestamps normalizados
          // Las fechas más pequeñas (más cercanas) van primero
          return dateA - dateB;
        }
        // Si solo una tiene fecha, la que tiene fecha va primero
        if (dateA !== null && dateB === null) return -1;
        if (dateA === null && dateB !== null) return 1;
        // Si ninguna tiene fecha, mantener orden original
        return 0;
      });
    }
    
    return sorted;
  };

  // Aplicar filtros y ordenamiento, separando completadas de activas
  const { activeTasks, completedTasks } = React.useMemo(() => {
    let result = [...tasks];

    // Aplicar filtros
    if (filterProject !== 'all') {
      result = result.filter(task => task.projectId === filterProject);
    }
    if (filterPriority !== 'all') {
      result = result.filter(task => task.priority === filterPriority);
    }
    if (filterStatus !== 'all') {
      result = result.filter(task => task.status === filterStatus);
    }

    // Separar tareas completadas de las activas
    // Si el filtro de estado está en "Completado", solo mostrar completadas
    // Si está en otro estado específico, solo mostrar ese estado
    // Si está en "all", separar completadas de activas
    const completed = result.filter(task => task.status === 'Completado');
    const active = result.filter(task => task.status !== 'Completado');

    return {
      activeTasks: applySorting(active),
      completedTasks: applySorting(completed),
    };
  }, [tasks, filterProject, filterPriority, filterStatus, sortBy]);

  return (
    <section className="flex h-full flex-col gap-6 rounded-3xl bg-white px-6 py-8 shadow-lg shadow-slate-900/10 md:px-8 md:py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        
        {/* Botón de filtros y ordenamiento */}
        {tasks.length > 0 && (
          <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowFiltersMenu(!showFiltersMenu)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:border-slate-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
            {(filterProject !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' || sortBy !== 'none') && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                {(filterProject !== 'all' ? 1 : 0) + (filterPriority !== 'all' ? 1 : 0) + (filterStatus !== 'all' ? 1 : 0) + (sortBy !== 'none' ? 1 : 0)}
              </span>
            )}
            <svg className={`h-3 w-3 transition-transform ${showFiltersMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Menú desplegable */}
          {showFiltersMenu && (
            <>
              {/* Overlay para cerrar al hacer clic fuera */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowFiltersMenu(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="p-3 space-y-3">
                  {/* Filtro por proyecto */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Proyecto
                    </label>
                    <select
                      value={filterProject}
                      onChange={(e) => setFilterProject(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="all">Todos</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro por prioridad */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Prioridad
                    </label>
                    <select
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="all">Todas</option>
                      <option value="Alta">Alta</option>
                      <option value="Media">Media</option>
                      <option value="Baja">Baja</option>
                    </select>
                  </div>

                  {/* Filtro por estado */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Estado
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="all">Todos</option>
                      <option value="Pendiente">Pendiente</option>
                      <option value="En progreso">En progreso</option>
                      <option value="En revisión">En revisión</option>
                      <option value="Completado">Completado</option>
                    </select>
                  </div>

                  {/* Ordenamiento */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                      Ordenar por
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'priority' | 'dueDate' | 'none')}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="none">Sin ordenar</option>
                      <option value="priority">Prioridad</option>
                      <option value="dueDate">Fecha límite</option>
                    </select>
                  </div>

                  {/* Botón para limpiar filtros */}
                  {(filterProject !== 'all' || filterPriority !== 'all' || filterStatus !== 'all' || sortBy !== 'none') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterProject('all');
                        setFilterPriority('all');
                        setFilterStatus('all');
                        setSortBy('none');
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {error}
        </div>
      ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-500">
          {tasks.length === 0 
            ? 'No tienes tareas asignadas en este momento.'
            : 'No hay tareas que coincidan con los filtros seleccionados.'}
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {/* Tareas activas */}
          {activeTasks.length > 0 && (
            <div>
              <div className="grid flex-1 content-start gap-3 md:grid-cols-2 xl:grid-cols-4">
                {activeTasks.map((task) => (
                  <article
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="group flex h-full min-h-[180px] w-full max-w-xs cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[task.status]}`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 text-xs text-slate-500">
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{task.projectName}</span>
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1">
                        Fecha límite: <strong className="text-slate-700">{task.dueDate}</strong>
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                        {task.boardTaskRef ? 'Ver tarea' : 'Ver proyecto'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${PRIORITY_BADGE_STYLES[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Tareas completadas - Sección separada */}
          {completedTasks.length > 0 && (
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Completadas</h3>
              <div className="grid flex-1 content-start gap-3 md:grid-cols-2 xl:grid-cols-4">
                {completedTasks.map((task) => (
                  <article
                    key={task.id}
                    onClick={() => handleTaskClick(task)}
                    className="group flex h-full min-h-[180px] w-full max-w-xs cursor-pointer flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:border-blue-200 hover:shadow-lg opacity-75"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusStyles[task.status]}`}
                      >
                        {task.status}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 text-xs text-slate-500">
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{task.projectName}</span>
                      <span className="w-fit rounded-full bg-slate-100 px-3 py-1">
                        Fecha límite: <strong className="text-slate-700">{task.dueDate}</strong>
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                        {task.boardTaskRef ? 'Ver tarea' : 'Ver proyecto'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${PRIORITY_BADGE_STYLES[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default MyTasksPage;

