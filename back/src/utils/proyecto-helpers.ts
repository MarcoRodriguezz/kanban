/**
 * Funciones helper para el controlador de proyectos.
 * Centraliza la lógica de construcción de filtros, includes y actividades.
 */
import { Prisma } from '@prisma/client';
import { BuscarProyectosQuery, ActualizarProyectoInput } from '../validations/proyecto.validation';
import { buildIdFilter, buildExactFilter } from './crud-helpers';
import { ENTIDADES } from './constants';
import { construirActividadesDesdeObjetos, ActividadInput } from './actividad-helpers';

/**
 * Include básico para proyectos (usado en listados)
 */
export const proyectoIncludeBasico = {
  creadoPor: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
    },
  },
  gestor: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
    },
  },
  _count: {
    select: {
      tareas: true,
    },
  },
} as const satisfies Prisma.ProyectoInclude;

/**
 * Include completo para proyecto individual (con tareas y roles)
 */
export const proyectoIncludeCompleto = {
  creadoPor: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
      rol: true,
    },
  },
  gestor: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
      rol: true,
    },
  },
  tareas: {
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      fecha_creacion: true,
      fecha_limite: true,
    },
    orderBy: { createdAt: 'desc' as const },
    take: 10, // Solo las últimas 10 tareas
  },
  _count: {
    select: {
      tareas: true,
    },
  },
} as const satisfies Prisma.ProyectoInclude;

/**
 * Construir filtros de búsqueda para proyectos
 */
export const construirFiltrosProyecto = (
  query: BuscarProyectosQuery
): Prisma.ProyectoWhereInput => {
  const where: Prisma.ProyectoWhereInput = {};
  
  const gestorId = buildIdFilter(query.gestor);
  if (gestorId) {
    where.gestorId = gestorId;
  }
  
  const responsable = buildExactFilter(query.responsable);
  if (responsable) {
    where.responsable = responsable;
  }

  return where;
};

/**
 * Construir actividades de cambios para proyectos
 */
export const construirActividadesCambiosProyecto = (
  proyectoAnterior: { id: number; nombre: string; [key: string]: any },
  datosActualizacion: ActualizarProyectoInput,
  proyectoId: number,
  userId: number,
  nombreProyecto: string
): ActividadInput[] => {
  return construirActividadesDesdeObjetos(
    proyectoAnterior,
    datosActualizacion,
    ENTIDADES.PROYECTO,
    proyectoId,
    userId,
    `proyecto "${nombreProyecto}"`
  );
};

