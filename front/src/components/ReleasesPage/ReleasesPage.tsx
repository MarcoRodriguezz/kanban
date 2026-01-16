import React from 'react';
import Sidebar, { SidebarProject, DEFAULT_PROJECTS } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import DatePicker from '../BoardPage/DatePicker';
import {
  getReleasesPageData,
  createRelease,
  updateRelease,
  deleteRelease,
  createSprint,
  updateSprint,
  deleteSprint,
  CreateReleaseData,
  UpdateReleaseData,
} from '../../services/api';

type ReleaseStatus = 'En progreso' | 'Sin lanzar' | 'Publicado';

type ReleaseProgressSegment = {
  title: string;
  value: number;
  colorClass: string;
};

type ReleaseRow = {
  id: string;
  version: string;
  status: ReleaseStatus;
  progress: ReleaseProgressSegment[];
  startDate: string;
  releaseDate: string;
  description: string;
};

type TimelineColumn = {
  id: string;
  label: string;
  secondaryLabel?: string;
  date?: string; // ISO date string para identificar la semana actual
};

type TimelineItem = {
  id: string;
  label: string;
  type: 'release' | 'sprint';
  status: 'En progreso' | 'Completado' | 'Pendiente';
  start: number;
  end: number;
  accent: string;
  backendId?: string;
  backendType?: 'release' | 'sprint';
};

type ReleaseFormState = {
  version: string;
  status: ReleaseStatus;
  startDate: string;
  releaseDate: string;
  description: string;
  progress: ReleaseProgressSegment[];
};

type TimelineFormState = {
  id?: string;
  label: string;
  type: TimelineItem['type'];
  status: TimelineItem['status'];
  start: number;
  end: number;
  startDate?: string; // Para sprints
  endDate?: string; // Para sprints
};

const RELEASE_STATUS_STYLES: Record<ReleaseStatus, string> = {
  'En progreso': 'bg-blue-100 text-blue-700 border border-blue-200',
  'Sin lanzar': 'bg-amber-100 text-amber-700 border border-amber-200',
  Publicado: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};



const defaultReleaseProgressForStatus = (status: ReleaseStatus): ReleaseProgressSegment[] => {
  if (status === 'Publicado') {
    return [{ title: 'Completado', value: 100, colorClass: 'bg-emerald-500' }];
  }

  if (status === 'Sin lanzar') {
    return [
      { title: 'Preparación', value: 20, colorClass: 'bg-emerald-500' },
      { title: 'Revisión', value: 15, colorClass: 'bg-blue-500' },
      { title: 'Pendiente', value: 65, colorClass: 'bg-slate-200' },
    ];
  }

  return [
    { title: 'Desarrollo', value: 45, colorClass: 'bg-blue-500' },
    { title: 'QA', value: 25, colorClass: 'bg-amber-400' },
    { title: 'Pendiente', value: 30, colorClass: 'bg-slate-200' },
  ];
};

const getTimelineAccent = (type: TimelineItem['type'], status: TimelineItem['status']): string => {
  if (type === 'release') {
    // Para releases, mapear estados de timeline a colores
    // 'Completado' corresponde a 'Publicado' -> Verde
    // 'En progreso' -> Azul
    // 'Pendiente' corresponde a 'Sin lanzar' -> Amarillo
    if (status === 'Completado') return 'bg-emerald-500'; // Verde
    if (status === 'En progreso') return 'bg-blue-500'; // Azul
    return 'bg-amber-400'; // Amarillo (Pendiente o por defecto)
  }

  // Para sprints, mantener la lógica original
  if (status === 'Completado') return 'bg-sky-900';
  if (status === 'En progreso') return 'bg-sky-400';
  if (status === 'Pendiente') return 'bg-sky-300';
  return 'bg-sky-300';
};

const formatDisplayDate = (value: string): string => {
  if (!value) {
    return 'Por definir';
  }
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

/**
 * Determina si una semana es la semana actual
 */
const esSemanaActual = (fechaSemana: string | undefined): boolean => {
  if (!fechaSemana) return false;
  const ahora = new Date();
  const fecha = new Date(fechaSemana);
  
  // Calcular el inicio de la semana de la fecha de la columna (lunes)
  const inicioSemanaColumna = new Date(fecha);
  const diaSemanaColumna = inicioSemanaColumna.getDay();
  const diasDesdeLunesColumna = diaSemanaColumna === 0 ? 6 : diaSemanaColumna - 1; // Lunes = 0
  inicioSemanaColumna.setDate(inicioSemanaColumna.getDate() - diasDesdeLunesColumna);
  inicioSemanaColumna.setHours(0, 0, 0, 0);
  
  // Calcular el inicio de la semana actual (lunes)
  const inicioSemanaActual = new Date(ahora);
  const diaSemanaActual = inicioSemanaActual.getDay();
  const diasDesdeLunesActual = diaSemanaActual === 0 ? 6 : diaSemanaActual - 1; // Lunes = 0
  inicioSemanaActual.setDate(inicioSemanaActual.getDate() - diasDesdeLunesActual);
  inicioSemanaActual.setHours(0, 0, 0, 0);
  
  // Comparar si ambas semanas comienzan el mismo día (mismo lunes)
  return inicioSemanaColumna.getTime() === inicioSemanaActual.getTime();
};

type ReleasesPageProps = {
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
    role: 'admin' | 'product-owner' | 'project-owner' | 'employee';
  };
};

const CURRENT_USER_FALLBACK = {
  name: 'María Sánchez',
  role: 'employee' as const,
};

const ReleasesPage: React.FC<ReleasesPageProps> = ({
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

  const [releaseRows, setReleaseRows] = React.useState<ReleaseRow[]>([]);
  const [timelineItems, setTimelineItems] = React.useState<TimelineItem[]>([]);
  const [timelineColumns, setTimelineColumns] = React.useState<TimelineColumn[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = React.useState(false);
  const [releasesError, setReleasesError] = React.useState<string | null>(null);

  const [showReleaseModal, setShowReleaseModal] = React.useState(false);
  const [editingReleaseIndex, setEditingReleaseIndex] = React.useState<number | null>(null);
  const [releaseForm, setReleaseForm] = React.useState<ReleaseFormState>({
    version: '',
    status: 'En progreso',
    startDate: '',
    releaseDate: '',
    description: '',
    progress: defaultReleaseProgressForStatus('En progreso'),
  });

  const [showTimelineModal, setShowTimelineModal] = React.useState(false);
  const [editingTimelineIndex, setEditingTimelineIndex] = React.useState<number | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = React.useState(false);
  const [timelineForm, setTimelineForm] = React.useState<TimelineFormState>({
    label: '',
    type: 'release',
    status: 'En progreso',
    start: 1,
    end: 2,
  });

  const projectList = React.useMemo(() => projects ?? DEFAULT_PROJECTS, [projects]);
  const canManageReleases = currentUser.role === 'admin' || currentUser.role === 'product-owner';

  // Función helper para recargar datos del backend
  const recargarDatos = React.useCallback(async () => {
    if (!project?.id) {
      setReleaseRows([]);
      setTimelineItems([]);
      setTimelineColumns([]);
      return;
    }

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) {
      setReleaseRows([]);
      setTimelineItems([]);
      setTimelineColumns([]);
      return;
    }

    try {
      setIsLoadingReleases(true);
      setReleasesError(null);
      const data = await getReleasesPageData(String(proyectoId));
      setReleaseRows(data.releases);
      setTimelineItems(data.timelineItems);
      setTimelineColumns(data.timelineColumns);
    } catch (error: any) {
      console.error('Error cargando releases:', error);
      setReleasesError(error.message || 'Error al cargar los releases');
      setReleaseRows([]);
      setTimelineItems([]);
      setTimelineColumns([]);
    } finally {
      setIsLoadingReleases(false);
    }
  }, [project?.id]);

  // Cargar datos de releases cuando cambia el proyecto
  React.useEffect(() => {
    recargarDatos();
  }, [recargarDatos]);

  const handleOpenNewReleaseModal = () => {
    if (!canManageReleases) return;
    setEditingReleaseIndex(null);
    setReleaseForm({
      version: '',
      status: 'En progreso',
      startDate: '',
      releaseDate: '',
      description: '',
      progress: defaultReleaseProgressForStatus('En progreso'),
    });
    setShowReleaseModal(true);
  };

  const handleEditRelease = (index: number) => {
    if (!canManageReleases) return;
    const release = releaseRows[index];
    setEditingReleaseIndex(index);
    setReleaseForm({
      version: release.version,
      status: release.status,
      startDate: release.startDate,
      releaseDate: release.releaseDate,
      description: release.description,
      progress: release.progress.map((segment) => ({ ...segment })),
    });
    setShowReleaseModal(true);
  };

  const handleCloseReleaseModal = () => {
    setShowReleaseModal(false);
  };

  const handleReleaseFieldChange = (field: keyof ReleaseFormState, value: string | ReleaseStatus) => {
    if (!canManageReleases) return;
    setReleaseForm((prev) => ({
      ...prev,
      [field]: value,
      progress: field === 'status' ? defaultReleaseProgressForStatus(value as ReleaseStatus) : prev.progress,
    }));
  };

  const handleSubmitRelease = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageReleases || !project?.id) return;

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) return;

    try {
      const nombre = releaseForm.version.trim() || 'Nueva versión';
      const descripcion = releaseForm.description.trim() || null;
      const estadoFrontend = releaseForm.status || 'Sin lanzar'; // Asegurar que siempre haya un estado válido

      // Validar que las fechas estén presentes y sean válidas
      if (!releaseForm.startDate || !releaseForm.releaseDate) {
        setReleasesError('Las fechas de inicio y lanzamiento son requeridas');
        return;
      }
      
      // Validar que el estado sea válido
      if (!['En progreso', 'Sin lanzar', 'Publicado'].includes(estadoFrontend)) {
        setReleasesError('Estado inválido');
        return;
      }

      // Convertir fechas YYYY-MM-DD a ISO datetime si es necesario
      const fechaInicio = releaseForm.startDate.includes('T') 
        ? releaseForm.startDate 
        : `${releaseForm.startDate}T00:00:00.000Z`;
      const fechaLanzamiento = releaseForm.releaseDate.includes('T')
        ? releaseForm.releaseDate
        : `${releaseForm.releaseDate}T00:00:00.000Z`;

      if (editingReleaseIndex !== null) {
        // Actualizar release existente
        const releaseId = releaseRows[editingReleaseIndex].id;
        const updateData: UpdateReleaseData = {
          nombre,
          descripcion,
          fecha_inicio: fechaInicio,
          fecha_lanzamiento: fechaLanzamiento,
          estadoFrontend: estadoFrontend, // Enviar el estado seleccionado (siempre presente)
          proyectoId,
        };

        await updateRelease(releaseId, updateData);
      } else {
        // Crear nuevo release
        const createData: CreateReleaseData = {
          nombre,
          descripcion,
          fecha_inicio: fechaInicio,
          fecha_lanzamiento: fechaLanzamiento,
          estadoFrontend: estadoFrontend || 'Sin lanzar', // Valor por defecto para nuevos releases
          proyectoId,
        };

        await createRelease(createData);
      }

      // Recargar datos del backend (sincroniza releases y timeline)
      await recargarDatos();

      setShowReleaseModal(false);
      setReleasesError(null); // Limpiar errores al guardar exitosamente
    } catch (error: any) {
      console.error('Error guardando release:', error);
      const errorMessage = error.message || error.error || 'Error al guardar el release';
      const details = error.details ? ` Detalles: ${JSON.stringify(error.details)}` : '';
      setReleasesError(`${errorMessage}${details}`);
      setIsLoadingReleases(false);
    }
  };

  const handleDeleteRelease = async (index: number) => {
    if (!canManageReleases || !project?.id) return;

    const releaseId = releaseRows[index].id;
    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) return;

    if (!window.confirm('¿Estás seguro de que quieres eliminar este release?')) {
      return;
    }

    try {
      await deleteRelease(releaseId);

      // Recargar datos del backend (sincroniza releases y timeline)
      await recargarDatos();
    } catch (error: any) {
      console.error('Error eliminando release:', error);
      setReleasesError(error.message || 'Error al eliminar el release');
      setIsLoadingReleases(false);
    }
  };

  const handleOpenNewTimelineModal = (type: 'release' | 'sprint' = 'release') => {
    if (!canManageReleases) return;
    setEditingTimelineIndex(null);
    setTimelineForm({
      label: '',
      type,
      status: 'En progreso',
      start: 1,
      end: 2,
      startDate: '',
      endDate: '',
    });
    setShowTimelineModal(true);
  };

  const handleEditTimeline = (index: number) => {
    if (!canManageReleases) return;
    const item = timelineItems[index];
    
    // Si es un release, abrir el modal de release en lugar del modal de timeline
    if (item.type === 'release' && item.backendId) {
      const releaseIndex = releaseRows.findIndex((r) => r.id === item.backendId);
      if (releaseIndex !== -1) {
        handleEditRelease(releaseIndex);
        return;
      }
    }
    
    // Para sprints o releases sin backendId, usar el modal de timeline
    setEditingTimelineIndex(index);
    
    // Si es un sprint con backendId, necesitamos obtener las fechas del backend
    // Por ahora, calculamos las fechas basándonos en las posiciones del timeline
    let startDate = '';
    let endDate = '';
    
    if (item.type === 'sprint' && timelineColumns.length > 0 && timelineColumns[0].date) {
      // Calcular fechas basándose en las posiciones del timeline
      const fechaMinima = new Date(timelineColumns[0].date);
      const fechaInicio = new Date(fechaMinima);
      fechaInicio.setDate(fechaInicio.getDate() + (item.start - 1) * 7);
      const fechaFin = new Date(fechaMinima);
      fechaFin.setDate(fechaFin.getDate() + (item.end - 1) * 7);
      
      startDate = fechaInicio.toISOString().split('T')[0];
      endDate = fechaFin.toISOString().split('T')[0];
    }
    
    setTimelineForm({
      id: item.id,
      label: item.label,
      type: item.type,
      status: item.status,
      start: item.start,
      end: item.end,
      startDate,
      endDate,
    });
    setShowTimelineModal(true);
  };

  const handleCloseTimelineModal = () => {
    setShowTimelineModal(false);
  };

  const handleTimelineFieldChange = <K extends keyof TimelineFormState>(field: K, value: TimelineFormState[K]) => {
    if (!canManageReleases) return;
    setTimelineForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Función para calcular la posición en el timeline basándose en una fecha
  const calcularPosicionDesdeFecha = (fecha: string, fechaMinima: Date, numColumnas: number): number => {
    if (!fecha) return 1;
    const fechaObj = new Date(fecha);
    const semanasDesdeInicio = Math.floor(
      (fechaObj.getTime() - fechaMinima.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, Math.min(numColumnas, semanasDesdeInicio + 1));
  };

  const handleSubmitTimeline = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManageReleases || !project?.id) return;

    const proyectoId = Number(project.id);
    if (isNaN(proyectoId)) return;

    try {
      let start = timelineForm.start;
      let end = timelineForm.end;

      // Si es un sprint y tiene fechas, calcular las posiciones del timeline
      if (timelineForm.type === 'sprint') {
        if (!timelineForm.startDate || !timelineForm.endDate) {
          setReleasesError('Las fechas de inicio y fin son requeridas para los sprints');
          return;
        }

        // Obtener la fecha mínima del timeline desde las columnas
        if (timelineColumns.length > 0 && timelineColumns[0].date) {
          const fechaMinima = new Date(timelineColumns[0].date);
          const numColumnas = timelineColumns.length;
          start = calcularPosicionDesdeFecha(timelineForm.startDate, fechaMinima, numColumnas);
          end = calcularPosicionDesdeFecha(timelineForm.endDate, fechaMinima, numColumnas);
        } else {
          // Si no hay columnas, usar las semanas directamente
          start = Math.max(1, Math.min(10, Number(timelineForm.start) || 1));
          end = Math.max(start, Math.min(10, Number(timelineForm.end) || start));
        }

        // Guardar el sprint en el backend
        const nombre = timelineForm.label.trim() || 'Nuevo sprint';
        const descripcion = null;
        
        // Mapear estado del frontend al backend
        let estadoBackend: 'Pendiente' | 'En_progreso' | 'Completado' = 'Pendiente';
        if (timelineForm.status === 'En progreso') {
          estadoBackend = 'En_progreso';
        } else if (timelineForm.status === 'Completado') {
          estadoBackend = 'Completado';
        } else if (timelineForm.status === 'Pendiente') {
          estadoBackend = 'Pendiente';
        }

        // Convertir fechas YYYY-MM-DD a ISO datetime si es necesario
        const fechaInicio = timelineForm.startDate.includes('T') 
          ? timelineForm.startDate 
          : `${timelineForm.startDate}T00:00:00.000Z`;
        const fechaFin = timelineForm.endDate.includes('T')
          ? timelineForm.endDate
          : `${timelineForm.endDate}T00:00:00.000Z`;

        if (editingTimelineIndex !== null && timelineItems[editingTimelineIndex].backendId) {
          // Actualizar sprint existente
          const sprintId = timelineItems[editingTimelineIndex].backendId;
          if (!sprintId) {
            setReleasesError('No se pudo encontrar el ID del sprint');
            return;
          }
          const updateData: any = {
            nombre,
            descripcion,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            estado: estadoBackend,
            proyectoId,
          };
          // Asegurar que el estado siempre se incluya
          if (!updateData.estado) {
            updateData.estado = 'Pendiente';
          }
          await updateSprint(sprintId, updateData);
        } else {
          // Crear nuevo sprint
          const createData: any = {
            nombre,
            descripcion,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            estado: estadoBackend,
            proyectoId,
          };
          // Asegurar que el estado siempre se incluya
          if (!createData.estado) {
            createData.estado = 'Pendiente';
          }
          await createSprint(createData);
        }

        // Recargar datos del backend
        await recargarDatos();
        setShowTimelineModal(false);
        setReleasesError(null); // Limpiar errores al guardar exitosamente
        return;
      }

      // Para releases o elementos sin backend, mantener la lógica anterior
      start = Math.max(1, Math.min(10, Number(timelineForm.start) || 1));
      end = Math.max(start, Math.min(10, Number(timelineForm.end) || start));

      const payload: TimelineItem = {
        id: timelineForm.id ?? `timeline-${Date.now()}`,
        label: timelineForm.label.trim() || (timelineForm.type === 'release' ? 'Nuevo release' : 'Nuevo sprint'),
        type: timelineForm.type,
        status: timelineForm.status,
        start,
        end,
        accent: getTimelineAccent(timelineForm.type, timelineForm.status),
      };

      if (editingTimelineIndex !== null) {
        setTimelineItems((prev) => prev.map((item, index) => (index === editingTimelineIndex ? payload : item)));
      } else {
        setTimelineItems((prev) => [payload, ...prev]);
      }

      setShowTimelineModal(false);
      setReleasesError(null); // Limpiar errores al guardar exitosamente
    } catch (error: any) {
      console.error('Error guardando sprint:', error);
      const errorMessage = error.message || error.error || 'Error al guardar el sprint';
      const details = error.details ? ` Detalles: ${JSON.stringify(error.details)}` : '';
      setReleasesError(`${errorMessage}${details}`);
    }
  };

  const handleDeleteTimelineItem = async (index: number) => {
    if (!canManageReleases) return;
    const item = timelineItems[index];
    
    // Si es un release, usar la función de eliminar release
    if (item.type === 'release' && item.backendId) {
      const releaseIndex = releaseRows.findIndex((r) => r.id === item.backendId);
      if (releaseIndex !== -1) {
        await handleDeleteRelease(releaseIndex);
        return;
      }
    }
    
    // Si es un sprint con backendId, eliminar del backend
    if (item.type === 'sprint' && item.backendId) {
      if (!window.confirm('¿Estás seguro de que quieres eliminar este sprint?')) {
        return;
      }
      
      try {
        const sprintId = item.backendId;
        if (!sprintId) {
          setReleasesError('No se pudo encontrar el ID del sprint');
          return;
        }
        await deleteSprint(sprintId);
        // Recargar datos del backend
        await recargarDatos();
      } catch (error: any) {
        console.error('Error eliminando sprint:', error);
        setReleasesError(error.message || 'Error al eliminar el sprint');
      }
      return;
    }
    
    // Para elementos sin backendId, solo eliminar del estado local
    setTimelineItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
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
          title="Releases"
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
              {canManageReleases && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                    className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300"
                  >
                    Crear
                  </button>
                  {showCreateDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowCreateDropdown(false)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDropdown(false);
                            handleOpenNewReleaseModal();
                          }}
                          className="w-full rounded-t-2xl px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                        >
                          Versión
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDropdown(false);
                            handleOpenNewTimelineModal('sprint');
                          }}
                          className="w-full rounded-b-2xl border-t border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                        >
                          Sprint
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="mt-4 max-w-3xl text-sm text-slate-600">
              Consulta todas las iteraciones planeadas, su avance y fechas relevantes. Utiliza la tabla y la vista de timeline
              para coordinar lanzamientos con tu equipo de producto, diseño y desarrollo.
            </p>
            {releasesError && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {releasesError}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
            {isLoadingReleases ? (
              <div className="py-8 text-center text-sm text-slate-500">Cargando releases...</div>
            ) : (
              <>
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Planeación de versiones</h3>
                    <p className="text-xs text-slate-500">
                      Filtra y consulta el estado actual de cada release, incluyendo fechas, progreso y notas relevantes.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      <span className="text-slate-400">Buscar</span>
                      <input
                        type="search"
                        placeholder="Filtrar versiones..."
                        className="w-36 bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
                    >
                      Todos los estados
                    </button>
                  </div>
                </header>

                {releaseRows.length === 0 ? (
                  <div className="mt-6 py-8 text-center text-sm text-slate-500">No hay releases disponibles</div>
                ) : (
                  <div className="mt-6 overflow-x-auto">
                    <table className="min-w-full text-left text-sm text-slate-600">
                      <thead className="text-xs uppercase tracking-[0.25em] text-slate-400">
                        <tr className="border-b border-slate-200">
                          <th className="px-3 py-3 font-semibold">Versión</th>
                          <th className="px-3 py-3 font-semibold">Estado</th>
                          <th className="px-3 py-3 font-semibold">Inicio</th>
                          <th className="px-3 py-3 font-semibold">Lanzamiento</th>
                          <th className="px-3 py-3 font-semibold">Descripción</th>
                          {canManageReleases && <th className="px-3 py-3 font-semibold">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {releaseRows.map((row, index) => (
                          <tr key={`${row.version}-${index}`} className="hover:bg-slate-50">
                            <td className="px-3 py-4 font-semibold text-slate-900">{row.version}</td>
                            <td className="px-3 py-4">
                              <span
                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${RELEASE_STATUS_STYLES[row.status]}`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="px-3 py-4 text-xs text-slate-500">{formatDisplayDate(row.startDate)}</td>
                            <td className="px-3 py-4 text-xs text-slate-500">{formatDisplayDate(row.releaseDate)}</td>
                            <td className="px-3 py-4 text-xs text-slate-500">{row.description || 'Sin descripción'}</td>
                            {canManageReleases && (
                              <td className="px-3 py-4 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditRelease(index)}
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRelease(index)}
                                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-500 transition hover:border-rose-300 hover:text-rose-600"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Cronograma de releases y sprints
                </h3>
                <p className="text-xs text-slate-500">
                  Visualiza la superposición de lanzamientos con los sprints activos y planificados.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Releases
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-500" /> Sprints
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Completado
                </span>
              </div>
            </header>

            <div className="mt-6 overflow-x-auto">
              <div className="min-w-[720px] space-y-2">
                <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 text-xs text-slate-400">
                  <div />
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${timelineColumns.length || 10}, minmax(0, 1fr))` }}>
                    {timelineColumns.map((column) => {
                      const esActual = esSemanaActual(column.date);
                      return (
                        <div key={column.id} className="flex flex-col items-center gap-1">
                          <span className={`text-[11px] font-semibold uppercase tracking-wide ${esActual ? 'text-red-600' : 'text-slate-400'}`}>
                            {column.label}
                          </span>
                          <span className={`text-[11px] ${esActual ? 'text-red-500 font-semibold' : 'text-slate-300'}`}>
                            {column.secondaryLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {timelineItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-4">
                      <div className="flex flex-col gap-2 text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">{item.label}</span>
                        <span className="text-[11px] text-slate-400">{item.type === 'release' ? 'Release' : 'Sprint'} · {item.status}</span>
                        {canManageReleases && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditTimeline(index)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTimelineItem(index)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 transition hover:border-rose-300 hover:text-rose-600"
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 py-1" style={{ gridTemplateColumns: `repeat(${timelineColumns.length || 10}, minmax(0, 1fr))` }}>
                        <div
                          className={`flex h-7 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm shadow-slate-900/10 ${item.accent}`}
                          style={{ gridColumn: `${item.start} / ${item.end + 1}` }}
                        >
                          {item.type === 'release' ? 'Release' : 'Sprint'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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

      {showReleaseModal && canManageReleases && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingReleaseIndex !== null ? 'Editar versión' : 'Nueva versión'}
                </h2>
                <p className="text-xs text-slate-500">
                  Define los datos clave del lanzamiento y ajusta las fechas previstas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseReleaseModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitRelease} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Versión
                  <input
                    type="text"
                    value={releaseForm.version}
                    onChange={(event) => handleReleaseFieldChange('version', event.target.value)}
                    placeholder="Ej. Versión 4.1"
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    required
                  />
                </label>
                <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                  <select
                    value={releaseForm.status}
                    onChange={(event) => handleReleaseFieldChange('status', event.target.value as ReleaseStatus)}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="En progreso">En progreso</option>
                    <option value="Sin lanzar">Sin lanzar</option>
                    <option value="Publicado">Publicado</option>
                  </select>
                </label>
                <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fecha de inicio
                  <DatePicker
                    value={releaseForm.startDate}
                    onChange={(date) => handleReleaseFieldChange('startDate', date)}
                  />
                </label>
                <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fecha de lanzamiento
                  <DatePicker
                    value={releaseForm.releaseDate}
                    onChange={(date) => handleReleaseFieldChange('releaseDate', date)}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Descripción
                <textarea
                  value={releaseForm.description}
                  onChange={(event) => handleReleaseFieldChange('description', event.target.value)}
                  placeholder="Contexto del release, alcance, dependencias..."
                  className="min-h-[120px] rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseReleaseModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTimelineModal && canManageReleases && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-6 py-10">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingTimelineIndex !== null ? 'Editar elemento' : 'Nuevo elemento en timeline'}
                </h2>
                <p className="text-xs text-slate-500">Configura las fechas que ocupará este release o sprint en el cronograma.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseTimelineModal}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
              >
                Cerrar
              </button>
            </header>

            <form onSubmit={handleSubmitTimeline} className="space-y-4">
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nombre
                <input
                  type="text"
                  value={timelineForm.label}
                  onChange={(event) => handleTimelineFieldChange('label', event.target.value)}
                  placeholder="Ej. Sprint Delta"
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tipo
                  <select
                    value={timelineForm.type}
                    onChange={(event) => handleTimelineFieldChange('type', event.target.value as TimelineItem['type'])}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="release">Release</option>
                    <option value="sprint">Sprint</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                  <select
                    value={timelineForm.status}
                    onChange={(event) => handleTimelineFieldChange('status', event.target.value as TimelineItem['status'])}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="En progreso">En progreso</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Completado">Completado</option>
                  </select>
                </label>
              </div>

              {timelineForm.type === 'sprint' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fecha de inicio
                    <DatePicker
                      value={timelineForm.startDate || ''}
                      onChange={(date) => handleTimelineFieldChange('startDate', date)}
                    />
                  </label>
                  <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fecha de fin
                    <DatePicker
                      value={timelineForm.endDate || ''}
                      onChange={(date) => handleTimelineFieldChange('endDate', date)}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Semana de inicio
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={timelineForm.start}
                      onChange={(event) => handleTimelineFieldChange('start', Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Semana de fin
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={timelineForm.end}
                      onChange={(event) => handleTimelineFieldChange('end', Number(event.target.value))}
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseTimelineModal}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReleasesPage;