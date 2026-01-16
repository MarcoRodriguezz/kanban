import React from 'react';
import Sidebar, { SidebarProject, DEFAULT_PROJECTS } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import ReportsHero from './ReportsHero';
import MetricsGrid from './MetricsGrid';
import DistributionSection from './DistributionSection';
import PerformanceSection from './PerformanceSection';
import ResolutionSection from './ResolutionSection';
import {
  STATUS_METADATA,
  COLUMN_ORDER,
  PROJECT_TASK_SNAPSHOTS,
} from './constants';
import { getProjectTasks, BoardTask, KanbanTaskItem } from '../../services/api';
import type {
  DistributionItem,
  PerformanceItem,
  ReportMetric,
  ResolutionPoint,
  WeeklySummary,
  BoardTasksByColumn,
  Trend,
} from './types';
import {
  formatMonthLabel,
  formatWeekLabel,
  getWeekStart,
  parseSpanishDate,
} from './utils';

type ReportsPageProps = {
  project?: SidebarProject | null;
  projects?: SidebarProject[];
  selectedId: string;
  onSelect: (projectId: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  headerNotifications?: HeaderProps['notifications'];
};

const ReportsPage: React.FC<ReportsPageProps> = ({
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
  const [tasksSnapshot, setTasksSnapshot] = React.useState<BoardTasksByColumn>(PROJECT_TASK_SNAPSHOTS.default);
  const [isLoadingTasks, setIsLoadingTasks] = React.useState(false);
  const [tasksError, setTasksError] = React.useState<string | null>(null);

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);

  // Cargar tareas del proyecto cuando cambia el proyecto
  React.useEffect(() => {
    if (!project?.id) {
      setTasksSnapshot(PROJECT_TASK_SNAPSHOTS.default);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setTasksSnapshot(PROJECT_TASK_SNAPSHOTS.default);
      return;
    }

    setIsLoadingTasks(true);
    setTasksError(null);

    getProjectTasks(String(proyectoId))
      .then((tareasPorColumna) => {
        // Función helper para generar iniciales del avatar
        const getAvatarInitials = (owner: string | undefined): string => {
          if (!owner) return 'U';
          const parts = owner.split(' ').filter(Boolean);
          if (parts.length === 0) return 'U';
          if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
          return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
        };

        // Convertir el formato de tareas a BoardTasksByColumn
        const snapshot: BoardTasksByColumn = {
          pending: (tareasPorColumna.pending || []).map((t: KanbanTaskItem) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: 'Pendiente' as const,
            priority: t.priority,
            owner: t.owner || 'Sin asignar',
            avatar: getAvatarInitials(t.owner),
            due: t.dueDate || 'Sin fecha',
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          })),
          'in-progress': (tareasPorColumna['in-progress'] || []).map((t: KanbanTaskItem) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: 'En progreso' as const,
            priority: t.priority,
            owner: t.owner || 'Sin asignar',
            avatar: getAvatarInitials(t.owner),
            due: t.dueDate || 'Sin fecha',
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          })),
          review: (tareasPorColumna.review || []).map((t: KanbanTaskItem) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: 'En revisión' as const,
            priority: t.priority,
            owner: t.owner || 'Sin asignar',
            avatar: getAvatarInitials(t.owner),
            due: t.dueDate || 'Sin fecha',
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          })),
          done: (tareasPorColumna.done || []).map((t: KanbanTaskItem) => ({
            id: t.id,
            title: t.title,
            description: t.description || '',
            status: 'Completado' as const,
            priority: t.priority,
            owner: t.owner || 'Sin asignar',
            avatar: getAvatarInitials(t.owner),
            due: t.dueDate || 'Sin fecha',
            createdAt: t.createdAt || new Date().toISOString(),
            updatedAt: t.updatedAt || new Date().toISOString(),
          })),
        };
        setTasksSnapshot(snapshot);
      })
      .catch((error: any) => {
        console.error('Error cargando tareas para reports:', error);
        setTasksError(error.message || 'Error al cargar las tareas');
        // Usar datos por defecto si falla
        setTasksSnapshot(PROJECT_TASK_SNAPSHOTS.default);
      })
      .finally(() => {
        setIsLoadingTasks(false);
      });
  }, [project?.id]);

  const flattenedTasks = React.useMemo(() => {
    return COLUMN_ORDER.flatMap((columnId) => {
      const columnTasks = tasksSnapshot[columnId] ?? [];
      return columnTasks.map((task) => ({
        task,
        columnId,
        createdAtDate: parseSpanishDate(task.createdAt),
        updatedAtDate: parseSpanishDate(task.updatedAt),
      }));
    });
  }, [tasksSnapshot]);

  const totalTasks = flattenedTasks.length;
  const doneTasks = flattenedTasks.filter(({ task }) => task.status === 'Completado');
  const openTasks = totalTasks - doneTasks.length;

  const cycleDurations = React.useMemo(() => {
    return doneTasks
      .map(({ createdAtDate, updatedAtDate }) => {
        if (!createdAtDate || !updatedAtDate) {
          return null;
        }
        const milliseconds = updatedAtDate.getTime() - createdAtDate.getTime();
        return milliseconds > 0 ? milliseconds / 86_400_000 : null;
      })
      .filter((value): value is number => value !== null);
  }, [doneTasks]);

  const averageCycleTime = React.useMemo(() => {
    if (cycleDurations.length === 0) {
      return null;
    }
    const total = cycleDurations.reduce((accumulator, value) => accumulator + value, 0);
    return total / cycleDurations.length;
  }, [cycleDurations]);

  const weeklySummary = React.useMemo<WeeklySummary[]>(() => {
    if (flattenedTasks.length === 0) {
      return [];
    }

    const map = new Map<string, WeeklySummary>();

    const ensureEntry = (date: Date) => {
      const start = getWeekStart(date);
      const key = start.toISOString();
      if (!map.has(key)) {
        map.set(key, {
          key,
          start,
          newCount: 0,
          completedCount: 0,
          pendingCount: 0,
          completedDurations: [],
        });
      }
      return map.get(key)!;
    };

    flattenedTasks.forEach(({ task, createdAtDate, updatedAtDate }) => {
      if (createdAtDate) {
        ensureEntry(createdAtDate).newCount += 1;
      }
      if (task.status === 'Completado' && updatedAtDate) {
        const entry = ensureEntry(updatedAtDate);
        entry.completedCount += 1;
        if (createdAtDate) {
          const diff =
            (updatedAtDate.getTime() - createdAtDate.getTime()) / 86_400_000;
          if (diff >= 0) {
            entry.completedDurations.push(diff);
          }
        }
      }
    });

    const entries = Array.from(map.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime()
    );

    entries.forEach((entry) => {
      const weekEnd = new Date(entry.start);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const pendingCount = flattenedTasks.filter(({ task, createdAtDate, updatedAtDate }) => {
        if (!createdAtDate) {
          return false;
        }
        if (createdAtDate > weekEnd) {
          return false;
        }
        if (task.status === 'Completado' && updatedAtDate && updatedAtDate <= weekEnd) {
          return false;
        }
        return true;
      }).length;
      entry.pendingCount = pendingCount;
    });

    return entries.sort((a, b) => b.start.getTime() - a.start.getTime());
  }, [flattenedTasks]);

  const distributionData = React.useMemo<DistributionItem[]>(() => {
    if (totalTasks === 0) {
      return COLUMN_ORDER.map((columnId) => ({
        id: columnId,
        label: STATUS_METADATA[columnId].label,
        value: 0,
        percentage: 0,
        colorClass: STATUS_METADATA[columnId].colorClass,
      }));
    }

    let accumulated = 0;

    return COLUMN_ORDER.map((columnId, index) => {
      const value = tasksSnapshot[columnId]?.length ?? 0;
      let percentage = Math.round((value / totalTasks) * 100);

      if (index === COLUMN_ORDER.length - 1) {
        percentage = Math.max(0, 100 - accumulated);
      } else {
        accumulated += percentage;
      }

      return {
        id: columnId,
        label: STATUS_METADATA[columnId].label,
        value,
        percentage,
        colorClass: STATUS_METADATA[columnId].colorClass,
      };
    });
  }, [tasksSnapshot, totalTasks]);

  const performanceRows = React.useMemo<PerformanceItem[]>(() => {
    if (weeklySummary.length === 0) {
      return [];
    }

    return weeklySummary.slice(0, 4).map((entry, index) => ({
      id: entry.key,
      label:
        index === 0
          ? 'Esta semana'
          : index === 1
          ? 'Semana pasada'
          : formatWeekLabel(entry.start),
      completed: entry.completedCount,
      new: entry.newCount,
      pending: entry.pendingCount,
    }));
  }, [weeklySummary]);

  const resolutionTrendPoints = React.useMemo<ResolutionPoint[]>(() => {
    if (flattenedTasks.length === 0) {
      return [];
    }

    const completedTasks = flattenedTasks.filter(
      ({ task, updatedAtDate }) => task.status === 'Completado' && updatedAtDate
    );

    const referenceDate =
      completedTasks.length > 0
        ? completedTasks.reduce((latest, item) => {
            if (!item.updatedAtDate) {
              return latest;
            }
            return item.updatedAtDate > latest ? item.updatedAtDate : latest;
          }, completedTasks[0].updatedAtDate!)
        : flattenedTasks.reduce((latest, item) => {
            if (!item.createdAtDate) {
              return latest;
            }
            return item.createdAtDate > latest ? item.createdAtDate : latest;
          }, new Date());

    const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 5, 1);
    const monthCounts = new Map<string, number>();

    completedTasks.forEach(({ updatedAtDate }) => {
      if (!updatedAtDate) {
        return;
      }
      const key = `${updatedAtDate.getFullYear()}-${updatedAtDate.getMonth()}`;
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    });

    const points: ResolutionPoint[] = [];
    const cursor = new Date(startDate);

    for (let i = 0; i < 6; i += 1) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      points.push({
        month: formatMonthLabel(cursor),
        value: monthCounts.get(key) ?? 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }, [flattenedTasks]);

  const resolutionMaxValue = React.useMemo(() => {
    if (resolutionTrendPoints.length === 0) {
      return 1;
    }
    return Math.max(...resolutionTrendPoints.map((point) => point.value), 1);
  }, [resolutionTrendPoints]);

  const resolutionAverage = React.useMemo(() => {
    if (resolutionTrendPoints.length === 0) {
      return null;
    }
    const total = resolutionTrendPoints.reduce((accumulator, point) => accumulator + point.value, 0);
    return total / resolutionTrendPoints.length;
  }, [resolutionTrendPoints]);

  const resolutionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  const metrics = React.useMemo<ReportMetric[]>(() => {
    const latestWeek = weeklySummary[0];
    const previousWeek = weeklySummary[1];

    const totalDelta =
      latestWeek !== undefined
        ? `${latestWeek.newCount >= 0 ? '+' : ''}${latestWeek.newCount} nuevas`
        : undefined;

    const totalTrend: Trend =
      latestWeek !== undefined && previousWeek !== undefined
        ? latestWeek.newCount >= previousWeek.newCount
          ? 'up'
          : 'down'
        : 'neutral';

    const completedDelta =
      latestWeek !== undefined && previousWeek !== undefined
        ? latestWeek.completedCount - previousWeek.completedCount
        : latestWeek !== undefined
        ? latestWeek.completedCount
        : null;

    let resolutionDelta: string | undefined;
    let resolutionTrend: Trend = 'neutral';
    if (completedDelta !== null) {
      resolutionDelta = `${completedDelta >= 0 ? '+' : ''}${completedDelta} completadas vs semana anterior`;
      resolutionTrend = completedDelta >= 0 ? 'up' : 'down';
    }

    const latestCycleAverage =
      latestWeek && latestWeek.completedDurations.length > 0
        ? latestWeek.completedDurations.reduce((accumulator, value) => accumulator + value, 0) /
          latestWeek.completedDurations.length
        : null;

    const previousCycleAverage =
      previousWeek && previousWeek.completedDurations.length > 0
        ? previousWeek.completedDurations.reduce((accumulator, value) => accumulator + value, 0) /
          previousWeek.completedDurations.length
        : null;

    let cycleDelta: string | undefined;
    let cycleTrend: Trend = 'neutral';

    if (latestCycleAverage !== null && previousCycleAverage !== null) {
      const diff = previousCycleAverage - latestCycleAverage;
      cycleTrend = diff >= 0 ? 'up' : 'down';
      cycleDelta = `${diff >= 0 ? '-' : '+'}${Math.abs(diff).toFixed(1)} días vs semana anterior`;
    }

    const latestPending = latestWeek?.pendingCount ?? openTasks;
    const previousPending = previousWeek?.pendingCount ?? latestPending;
    const pendingDiff = latestPending - previousPending;

    const pendingDelta =
      previousWeek !== undefined || latestWeek !== undefined
        ? `${pendingDiff >= 0 ? '+' : ''}${pendingDiff} vs semana anterior`
        : undefined;

    const pendingTrend: Trend =
      pendingDiff < 0 ? 'up' : pendingDiff > 0 ? 'down' : 'neutral';

    return [
      {
        id: 'total',
        label: 'Total de tareas',
        value: totalTasks.toString(),
      },
      {
        id: 'resolution',
        label: 'Tasa de resolución',
        value: `${resolutionRate}%`,
      },
      {
        id: 'cycle',
        label: 'Tiempo promedio',
        value: averageCycleTime !== null ? `${averageCycleTime.toFixed(1)} días` : '—',
      },
      {
        id: 'pending',
        label: 'Pendientes de gestionar',
        value: openTasks.toString(),
      },
    ];
  }, [averageCycleTime, openTasks, resolutionRate, totalTasks, weeklySummary]);

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
          title="Reports"
          onBack={onBack}
          onProfileClick={onProfileClick}
          notifications={headerNotifications}
        />

        <main className="flex flex-1 flex-col gap-6 overflow-hidden p-8">
          <ReportsHero projectName={project ? project.name : 'Tablero principal'} />

          {tasksError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {tasksError}
            </div>
          )}

          {isLoadingTasks ? (
            <div className="py-12 text-center text-sm text-slate-500">Cargando estadísticas...</div>
          ) : (
            <>
              <MetricsGrid metrics={metrics} />

          <section className="grid gap-6 lg:grid-cols-2">
            <DistributionSection items={distributionData} totalTasks={totalTasks} />
            <PerformanceSection rows={performanceRows} />
          </section>

              <ResolutionSection
                points={resolutionTrendPoints}
                resolutionAverage={resolutionAverage}
                resolutionMaxValue={resolutionMaxValue}
              />
            </>
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

export default ReportsPage;


