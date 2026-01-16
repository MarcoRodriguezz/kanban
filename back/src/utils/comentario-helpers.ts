/**
 * Funciones helper para el controlador de comentarios.
 * Centraliza la lógica de construcción de filtros y validaciones.
 */
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { BuscarComentariosQuery } from '../validations/comentario.validation';
import { buildIdFilter, getAndValidateResource } from './crud-helpers';
import { ROLES } from './constants';
import { comentarioInclude } from './prisma-helpers';

/**
 * Construir filtros de búsqueda para comentarios
 */
export const construirFiltrosComentario = (
  query: BuscarComentariosQuery
): Prisma.ComentarioWhereInput => {
  const where: Prisma.ComentarioWhereInput = {};
  
  const tareaId = buildIdFilter(query.tareaId);
  if (tareaId) {
    where.tareaId = tareaId;
  }

  return where;
};

/**
 * Verificar si un usuario es el autor de un comentario
 */
export const esAutorComentario = (
  comentarioUsuarioId: number | null,
  userId: number
): boolean => {
  return comentarioUsuarioId === userId;
};

/**
 * Verificar si un usuario puede eliminar un comentario
 * Solo el autor o un administrador pueden eliminarlo
 */
export const puedeEliminarComentario = (
  comentarioUsuarioId: number | null,
  userId: number,
  userRol?: string
): boolean => {
  const esAutor = esAutorComentario(comentarioUsuarioId, userId);
  const esAdmin = userRol === ROLES.ADMINISTRADOR;
  return esAutor || esAdmin;
};

/**
 * Obtiene un comentario por ID y valida su existencia
 * Retorna null si no existe o envía error y retorna null
 */
export const obtenerComentarioYValidar = async (
  comentarioId: number,
  res: Response,
  select?: any
): Promise<any | null> => {
  return getAndValidateResource(
    prisma.comentario,
    comentarioId,
    res,
    'Comentario',
    select || {
      id: true,
      usuarioId: true,
      tareaId: true,
      contenido: true,
    }
  );
};


/**
 * Consulta comentarios con paginación
 */
export const consultarComentariosConPaginacion = async (
  where: Prisma.ComentarioWhereInput,
  skip: number,
  take: number,
  include: any = comentarioInclude
): Promise<[any[], number]> => {
  return Promise.all([
    prisma.comentario.findMany({
      where,
      skip,
      take,
      include,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.comentario.count({ where }),
  ]);
};
