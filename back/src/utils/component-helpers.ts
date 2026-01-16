/**
 * Utilidades específicas para operaciones con componentes.
 * Funciones auxiliares para construcción de filtros y validaciones.
 */
import { Prisma } from '@prisma/client';
import { BuscarComponentesQuery } from '../validations/component.validation';
import { buildIdFilter, buildExactFilter } from './crud-helpers';

/**
 * Construye los filtros de Prisma para buscar componentes
 */
export const construirFiltrosComponente = (query: BuscarComponentesQuery): Prisma.ComponenteWhereInput => {
  const filtros: Prisma.ComponenteWhereInput = {};

  // Filtro por proyecto
  if (query.proyectoId) {
    filtros.proyectoId = buildIdFilter(query.proyectoId);
  }

  // Filtro por categoría
  if (query.categoria) {
    filtros.categoria = buildExactFilter(query.categoria);
  }

  // Búsqueda por nombre o descripción
  if (query.busqueda && query.busqueda.trim()) {
    const busqueda = query.busqueda.trim();
    filtros.OR = [
      { nombre: { contains: busqueda } },
      { descripcion: { contains: busqueda } },
    ];
  }

  return filtros;
};

/**
 * Parsea los tags de string JSON a array
 */
export const parseTags = (tags: string | null | undefined): string[] => {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Convierte un array de tags a string JSON
 */
export const stringifyTags = (tags: string[] | null | undefined): string | null => {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return null;
  return JSON.stringify(tags);
};

