/**
 * Funciones helper para el controlador de releases.
 * Centraliza la lógica de construcción de filtros, includes y validaciones.
 */
import { Prisma } from '@prisma/client';
import { BuscarReleasesQuery } from '../validations/release.validation';
import { buildIdFilter, buildExactFilter } from './crud-helpers';
import { tareaInclude } from './prisma-helpers';
import { prisma } from './prisma';

/**
 * Include básico para releases (usado en listados)
 */
export const releaseIncludeBasico = {
  proyecto: {
    select: {
      id: true,
      nombre: true,
    },
  },
  _count: {
    select: {
      tareas: true,
    },
  },
} as const satisfies Prisma.ReleaseInclude;

/**
 * Include completo para release individual (con tareas)
 */
export const releaseIncludeCompleto = {
  proyecto: {
    select: {
      id: true,
      nombre: true,
    },
  },
  tareas: {
    include: {
      tarea: {
        include: tareaInclude,
      },
    },
  },
} as const satisfies Prisma.ReleaseInclude;

/**
 * Construir filtros de búsqueda para releases
 */
export const construirFiltrosRelease = (
  query: BuscarReleasesQuery
): Prisma.ReleaseWhereInput => {
  const where: Prisma.ReleaseWhereInput = {};
  
  const proyectoId = buildIdFilter(query.proyecto);
  if (proyectoId) {
    where.proyectoId = proyectoId;
  }
  
  const estado = buildExactFilter(query.estado);
  if (estado) {
    where.estado = estado as any;
  }

  return where;
};

/**
 * Mapea estado del frontend al backend para releases
 */
export const mapearEstadoFrontendABackendRelease = (
  estadoFrontend?: string
): 'En_progreso' | 'Sin_lanzar' | 'Publicado' => {
  if (!estadoFrontend) return 'Sin_lanzar';
  switch (estadoFrontend) {
    case 'En progreso':
      return 'En_progreso';
    case 'Publicado':
      return 'Publicado';
    case 'Sin lanzar':
    default:
      return 'Sin_lanzar';
  }
};

/**
 * Mapea estado del backend al frontend para releases
 */
export const mapearEstadoBackendAFrontendRelease = (
  estado: string
): 'En progreso' | 'Sin lanzar' | 'Publicado' => {
  switch (estado) {
    case 'En_progreso':
      return 'En progreso';
    case 'Publicado':
      return 'Publicado';
    case 'Sin_lanzar':
    default:
      return 'Sin lanzar';
  }
};

/**
 * Mapea estado para el timeline (release o sprint)
 */
export const mapearEstadoTimeline = (
  estado: string,
  tipo: 'release' | 'sprint'
): 'En progreso' | 'Completado' | 'Pendiente' => {
  if (tipo === 'release') {
    switch (estado) {
      case 'Publicado':
        return 'Completado';
      case 'En_progreso':
        return 'En progreso';
      default:
        return 'Pendiente';
    }
  } else {
    switch (estado) {
      case 'Completado':
        return 'Completado';
      case 'En_progreso':
        return 'En progreso';
      default:
        return 'Pendiente';
    }
  }
};

/**
 * Obtiene releases y sprints de un proyecto
 */
export const obtenerReleasesYSprints = async (proyectoId: number) => {
  return await Promise.all([
    prisma.release.findMany({
      where: { proyectoId },
      orderBy: { fecha_inicio: 'asc' },
    }),
    prisma.sprint.findMany({
      where: { proyectoId },
      orderBy: { fecha_inicio: 'asc' },
    }),
  ]);
};

/**
 * Obtiene releases y sprints con campos mínimos para timeline
 */
export const obtenerReleasesYSprintsParaTimeline = async (proyectoId: number) => {
  return await Promise.all([
    prisma.release.findMany({
      where: { proyectoId },
      select: {
        id: true,
        nombre: true,
        fecha_inicio: true,
        fecha_lanzamiento: true,
        estado: true,
      },
      orderBy: { fecha_inicio: 'asc' },
    }),
    prisma.sprint.findMany({
      where: { proyectoId },
      select: {
        id: true,
        nombre: true,
        fecha_inicio: true,
        fecha_fin: true,
        estado: true,
      },
      orderBy: { fecha_inicio: 'asc' },
    }),
  ]);
};

/**
 * Calcula el rango de fechas (mínima y máxima) a partir de releases y sprints
 */
export const calcularRangoFechas = (
  releases: Array<{ fecha_inicio: Date; fecha_lanzamiento: Date }>,
  sprints: Array<{ fecha_inicio: Date; fecha_fin: Date }>
): { fechaMinima: Date; fechaMaxima: Date } => {
  const todasLasFechas: Date[] = [];
  
  releases.forEach((r) => {
    todasLasFechas.push(new Date(r.fecha_inicio));
    todasLasFechas.push(new Date(r.fecha_lanzamiento));
  });
  
  sprints.forEach((s) => {
    todasLasFechas.push(new Date(s.fecha_inicio));
    todasLasFechas.push(new Date(s.fecha_fin));
  });

  const fechaMinima =
    todasLasFechas.length > 0
      ? new Date(Math.min(...todasLasFechas.map((d) => d.getTime())))
      : new Date();
  const fechaMaxima =
    todasLasFechas.length > 0
      ? new Date(Math.max(...todasLasFechas.map((d) => d.getTime())))
      : new Date();

  return { fechaMinima, fechaMaxima };
};

/**
 * Calcula el número de columnas del timeline basado en semanas
 */
export const calcularNumeroColumnasTimeline = (
  fechaMinima: Date,
  fechaMaxima: Date
): number => {
  const semanasDiferencia = Math.ceil(
    (fechaMaxima.getTime() - fechaMinima.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  // Mínimo 10 semanas, máximo dinámico basado en el rango real + margen
  // Aumentamos el límite máximo para permitir cronogramas más largos
  return Math.max(10, Math.min(52, semanasDiferencia + 4)); // Hasta 1 año (52 semanas)
};

/**
 * Calcula la posición en el timeline basada en una fecha
 */
export const calcularPosicionTimeline = (
  fecha: Date,
  fechaMinima: Date,
  numColumnas: number
): number => {
  const semanasDesdeInicio = Math.floor(
    (fecha.getTime() - fechaMinima.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  return Math.max(1, Math.min(numColumnas, semanasDesdeInicio + 1));
};

/**
 * Calcula el progreso de un release basado en su estado
 */
export const calcularProgresoRelease = (
  estado: string
): Array<{ title: string; value: number; colorClass: string }> => {
  const estadoFrontend = mapearEstadoBackendAFrontendRelease(estado);
  
  if (estadoFrontend === 'Publicado') {
    return [{ title: 'Completado', value: 100, colorClass: 'bg-emerald-500' }];
  }
  
  if (estadoFrontend === 'Sin lanzar') {
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

/**
 * Obtiene el accent color del timeline según tipo y estado
 */
export const obtenerAccentTimeline = (
  type: 'release' | 'sprint',
  status: string
): string => {
  if (type === 'release') {
    // Para releases, usar los estados frontend directamente
    if (status === 'Publicado' || status === 'Completado') return 'bg-emerald-500'; // Verde
    if (status === 'En progreso') return 'bg-blue-500'; // Azul
    if (status === 'Sin lanzar' || status === 'Pendiente') return 'bg-amber-400'; // Amarillo
    return 'bg-amber-400'; // Por defecto amarillo
  }
  // Para sprints, mantener la lógica original
  if (status === 'Completado') return 'bg-sky-500';
  if (status === 'En progreso') return 'bg-sky-500';
  return 'bg-sky-300';
};

/**
 * Formatea una fecha a formato ISO string (YYYY-MM-DD)
 */
export const formatearFechaISO = (fecha: Date): string => {
  return fecha.toISOString().split('T')[0];
};

/**
 * Genera las columnas del timeline basadas en semanas
 * Calcula correctamente los meses y semanas basándose en las fechas reales
 */
export const generarColumnasTimeline = (
  fechaMinima: Date,
  numColumnas: number
): Array<{ id: string; label: string; secondaryLabel: string; date?: string }> => {
  const columnas = [];
  let mesAnterior = -1;
  
  for (let i = 0; i < numColumnas; i++) {
    const fechaColumna = new Date(fechaMinima);
    fechaColumna.setDate(fechaColumna.getDate() + i * 7);
    
    const mesActual = fechaColumna.getMonth();
    const añoActual = fechaColumna.getFullYear();
    
    // Calcular el inicio del mes actual
    const inicioMes = new Date(añoActual, mesActual, 1);
    
    // Calcular el inicio de la semana de la fecha actual (lunes)
    const inicioSemana = new Date(fechaColumna);
    const diaSemana = inicioSemana.getDay();
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1; // Lunes = 0
    inicioSemana.setDate(inicioSemana.getDate() - diasDesdeLunes);
    inicioSemana.setHours(0, 0, 0, 0);
    
    // Calcular qué semana del mes es (contando desde el primer lunes del mes o antes)
    // Si el primer día del mes no es lunes, la primera semana incluye días del mes anterior
    const primerDiaMes = inicioMes.getDay();
    const diasDesdeLunesPrimerDia = primerDiaMes === 0 ? 6 : primerDiaMes - 1;
    const primerLunesMes = new Date(inicioMes);
    primerLunesMes.setDate(primerLunesMes.getDate() - diasDesdeLunesPrimerDia);
    
    // Calcular la diferencia en días desde el primer lunes del mes
    const diasDesdePrimerLunes = Math.floor(
      (inicioSemana.getTime() - primerLunesMes.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const numeroSemanaEnMes = diasDesdePrimerLunes + 1;
    
    // Si cambió el mes, mostrar el label del mes
    const esPrimeraSemanaDelMes = mesActual !== mesAnterior;
    if (esPrimeraSemanaDelMes) {
      mesAnterior = mesActual;
    }
    
    const mesLabel = fechaColumna.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
    
    columnas.push({
      id: `col-${i + 1}`,
      label: esPrimeraSemanaDelMes ? mesLabel : '',
      secondaryLabel: `Sem ${numeroSemanaEnMes}`,
      date: fechaColumna.toISOString(), // Guardar la fecha como ISO string para uso en el frontend
    });
  }
  return columnas;
};

/**
 * Obtiene el nombre del proyecto
 */
export const obtenerNombreProyecto = async (proyectoId: number): Promise<string | null> => {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { nombre: true },
  });
  return proyecto?.nombre || null;
};

