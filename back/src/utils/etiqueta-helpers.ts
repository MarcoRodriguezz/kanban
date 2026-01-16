/**
 * Utilidades específicas para operaciones con etiquetas.
 * Funciones auxiliares para validación de nombres, permisos y asociación con tareas.
 */
import { Response } from 'express';
import { prisma } from './prisma';
import { verificarPermisosTarea } from './permission-helpers';
import { ENTIDADES } from './constants';
import { ActividadInput, construirActividadesDesdeObjetos } from './actividad-helpers';
import { buildTextFilter, getAndValidateResource } from './crud-helpers';
import { sendNotFoundError } from './error-handler';

/**
 * Verifica si ya existe una etiqueta con el nombre dado
 */
export const existeEtiquetaConNombre = async (nombre: string): Promise<boolean> => {
  const etiqueta = await prisma.etiqueta.findUnique({
    where: { nombre },
    select: { id: true },
  });
  return !!etiqueta;
};

/**
 * Include común para etiquetas con conteo de tareas
 */
export const etiquetaIncludeConConteo = {
  _count: {
    select: {
      tareas: true,
    },
  },
} as const;

/**
 * Construye filtros WHERE para búsqueda de etiquetas
 */
export const construirFiltrosEtiqueta = (nombre?: string): any => {
  const where: any = {};
  const nombreFilter = buildTextFilter(nombre);
  if (nombreFilter) {
    where.nombre = nombreFilter;
  }
  return where;
};

/**
 * Verifica permisos para editar etiquetas de una tarea
 */
export const verificarPermisosEdicionEtiquetas = async (
  userId: number,
  tareaId: number
): Promise<{ tienePermiso: boolean; tarea?: any } | null> => {
  const resultadoPermisos = await verificarPermisosTarea(userId, tareaId);
  if (!resultadoPermisos) {
    return null;
  }

  const { permisos } = resultadoPermisos;
  const tienePermiso = permisos.esAdmin || permisos.esCreador || permisos.esGestor;

  return {
    tienePermiso,
    tarea: resultadoPermisos.tarea,
  };
};

/**
 * Verifica que todas las etiquetas existen
 */
export const verificarEtiquetasExisten = async (
  etiquetaIds: number[]
): Promise<{ todasExisten: boolean; etiquetasEncontradas: number[] }> => {
  const etiquetas = await prisma.etiqueta.findMany({
    where: { id: { in: etiquetaIds } },
    select: { id: true },
  });

  const etiquetasEncontradas = etiquetas.map((e) => e.id);
  const todasExisten = etiquetasEncontradas.length === etiquetaIds.length;

  return { todasExisten, etiquetasEncontradas };
};

/**
 * Obtiene las etiquetas asociadas a una tarea
 */
export const obtenerEtiquetasDeTarea = async (tareaId: number) => {
  const tareaEtiquetas = await prisma.tareaEtiqueta.findMany({
    where: { tareaId },
    include: {
      etiqueta: true,
    },
  });

  return tareaEtiquetas.map((te) => te.etiqueta);
};

/**
 * Construye actividades de cambios para actualización de etiqueta
 */
export const construirActividadesCambiosEtiqueta = (
  etiquetaAnterior: any,
  datosActualizacion: any,
  etiquetaId: number,
  userId: number,
  nombreEtiqueta: string
): ActividadInput[] => {
  return construirActividadesDesdeObjetos(
    etiquetaAnterior,
    datosActualizacion,
    ENTIDADES.ETIQUETA,
    etiquetaId,
    userId,
    `etiqueta "${nombreEtiqueta}"`
  );
};

/**
 * Obtiene una etiqueta por ID y valida su existencia
 * Retorna null si no existe o envía error y retorna null
 */
export const obtenerEtiquetaYValidar = async (
  etiquetaId: number,
  res: Response,
  select?: any
): Promise<any | null> => {
  return getAndValidateResource(
    prisma.etiqueta,
    etiquetaId,
    res,
    'Etiqueta',
    select || {
      id: true,
      nombre: true,
      color: true,
    }
  );
};

/**
 * Valida que el nombre de etiqueta no esté duplicado
 * Retorna true si hay conflicto, false si está disponible
 */
export const validarNombreEtiquetaDuplicado = async (
  nombre: string,
  etiquetaIdExcluir?: number
): Promise<boolean> => {
  const where: any = { nombre };
  if (etiquetaIdExcluir) {
    where.id = { not: etiquetaIdExcluir };
  }
  
  const existe = await prisma.etiqueta.findFirst({
    where,
    select: { id: true },
  });
  
  return !!existe;
};

/**
 * Verifica permisos de edición de etiquetas y envía error si no tiene permisos
 * Retorna el resultado de permisos o null si no tiene permisos/envía error
 */
export const verificarPermisosEdicionEtiquetasConError = async (
  userId: number,
  tareaId: number,
  res: Response
): Promise<{ tienePermiso: boolean; tarea?: any } | null> => {
  const resultadoPermisos = await verificarPermisosEdicionEtiquetas(userId, tareaId);
  
  if (!resultadoPermisos) {
    sendNotFoundError(res, 'Tarea');
    return null;
  }

  if (!resultadoPermisos.tienePermiso) {
    res.status(403).json({
      error: 'No tienes permisos para modificar las etiquetas de esta tarea',
    });
    return null;
  }

  return resultadoPermisos;
};


/**
 * Consulta etiquetas con paginación
 */
export const consultarEtiquetasConPaginacion = async (
  where: any,
  skip: number,
  take: number
): Promise<[any[], number]> => {
  return Promise.all([
    prisma.etiqueta.findMany({
      where,
      skip,
      take,
      include: etiquetaIncludeConConteo,
      orderBy: { nombre: 'asc' },
    }),
    prisma.etiqueta.count({ where }),
  ]);
};

