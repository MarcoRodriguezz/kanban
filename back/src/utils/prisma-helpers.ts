/**
 * Configuraciones reutilizables de Prisma: includes optimizados para tareas, comentarios y usuarios.
 * Centraliza las definiciones de select/include para mantener consistencia y reducir código duplicado.
 * Incluye helpers para verificar existencia de entidades.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Configuración de includes para consultas de tareas
 */
export const tareaInclude = {
  usuario: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
    },
  },
  proyecto: {
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      gestorId: true, // Necesario para verificar permisos de gestor
    },
  },
  creadoPor: {
    select: {
      id: true,
      nombreCompleto: true,
    },
  },
  archivos: {
    select: {
      id: true,
      nombre: true,
      url: true,
      tipo: true,
    },
  },
  comentarios: {
    select: {
      id: true,
      contenido: true,
      createdAt: true,
      usuario: {
        select: {
          id: true,
          nombreCompleto: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  etiquetas: {
    include: {
      etiqueta: {
        select: {
          id: true,
          nombre: true,
          color: true,
        },
      },
    },
  },
} satisfies Prisma.TareaInclude;

/**
 * Include extendido para obtener tarea completa (incluye rol del usuario y más detalles)
 */
export const tareaIncludeCompleto = {
  ...tareaInclude,
  usuario: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
      rol: true,
    },
  },
  archivos: {
    select: {
      id: true,
      nombre: true,
      url: true,
      tipo: true,
      tamaño: true,
      createdAt: true,
    },
  },
  comentarios: {
    select: {
      id: true,
      contenido: true,
      createdAt: true,
      updatedAt: true,
      usuario: {
        select: {
          id: true,
          nombreCompleto: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
} satisfies Prisma.TareaInclude;

/**
 * Include común para usuario (básico)
 */
export const usuarioSelectBasico = {
  id: true,
  nombreCompleto: true,
  email: true,
} as const;

/**
 * Include común para usuario (con rol)
 */
export const usuarioSelectConRol = {
  id: true,
  nombreCompleto: true,
  email: true,
  rol: true,
} as const;

/**
 * Include común para comentarios
 */
export const comentarioInclude = {
  usuario: {
    select: usuarioSelectBasico,
  },
} as const;

/**
 * Include común para comentarios con tarea
 */
export const comentarioIncludeConTarea = {
  usuario: {
    select: usuarioSelectBasico,
  },
  tarea: {
    select: {
      id: true,
      titulo: true,
    },
  },
} as const;

/**
 * Helpers para verificar existencia de entidades: proyectos, usuarios y tareas usando findUnique optimizado.
 * Permite verificar múltiples entidades en paralelo para reducir el número de queries a la base de datos.
 */

/**
 * Helper genérico para verificar existencia de una entidad
 */
const verificarEntidadExiste = async (
  model: any,
  id: number
): Promise<boolean> => {
  const entidad = await model.findUnique({
    where: { id },
    select: { id: true },
  });
  return entidad !== null;
};

/**
 * Verifica si un proyecto existe usando findUnique (más eficiente que count)
 */
export const verificarProyectoExiste = async (proyectoId: number): Promise<boolean> => {
  return verificarEntidadExiste(prisma.proyecto, proyectoId);
};

/**
 * Verifica si un usuario existe usando findUnique (más eficiente que count)
 */
export const verificarUsuarioExiste = async (usuarioId: number): Promise<boolean> => {
  return verificarEntidadExiste(prisma.usuario, usuarioId);
};

/**
 * Verifica si una tarea existe usando findUnique (más eficiente que count)
 */
export const verificarTareaExiste = async (tareaId: number): Promise<boolean> => {
  return verificarEntidadExiste(prisma.tarea, tareaId);
};

/**
 * Verifica múltiples entidades en paralelo de forma eficiente
 */
export const verificarEntidadesExisten = async (params: {
  proyectoId?: number;
  usuarioId?: number;
  tareaId?: number;
}): Promise<{
  proyecto: boolean;
  usuario: boolean;
  tarea: boolean;
}> => {
  const [proyecto, usuario, tarea] = await Promise.all([
    params.proyectoId
      ? verificarProyectoExiste(params.proyectoId)
      : Promise.resolve(true),
    params.usuarioId
      ? verificarUsuarioExiste(params.usuarioId)
      : Promise.resolve(true),
    params.tareaId
      ? verificarTareaExiste(params.tareaId)
      : Promise.resolve(true),
  ]);

  return { proyecto, usuario, tarea };
};

