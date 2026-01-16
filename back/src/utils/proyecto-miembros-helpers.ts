/**
 * Funciones helper para operaciones de miembros del proyecto.
 * Centraliza la lógica común para reducir código duplicado.
 */
import { Response } from 'express';
import { prisma } from './prisma';
import { sendNotFoundError } from './error-handler';
import { verificarUsuarioExiste } from './prisma-helpers';
import { ROLES } from './constants';
import { registrarActividadActualizacion } from './actividad-helpers';
import { ENTIDADES } from './constants';

/**
 * Select común para obtener información básica de un proyecto
 */
export const proyectoSelectBasico = {
  id: true,
  nombre: true,
  creadoPorId: true,
  gestorId: true,
} as const;

/**
 * Condiciones para filtrar tareas placeholder
 */
export const filtroTareasPlaceholder = {
  OR: [
    { titulo: { contains: 'Miembro del proyecto' } },
    { titulo: { contains: 'Bienvenido al proyecto' } },
    { descripcion: { contains: 'Tarea para mantener al usuario como miembro del proyecto' } },
    { descripcion: { contains: 'Tarea de bienvenida para agregar al usuario al proyecto' } },
  ],
};

/**
 * Valida y parsea un usuarioId desde parámetros o body
 */
export const validarYParsearUsuarioId = (
  res: Response,
  usuarioId: string | number | undefined
): number | null => {
  if (!usuarioId) {
    res.status(400).json({ error: 'usuarioId es requerido' });
    return null;
  }

  const usuarioIdNum = parseInt(usuarioId.toString());
  if (isNaN(usuarioIdNum)) {
    res.status(400).json({ error: 'usuarioId debe ser un número válido' });
    return null;
  }

  return usuarioIdNum;
};

/**
 * Obtiene información básica de un proyecto
 */
export const obtenerProyectoBasico = async (proyectoId: number) => {
  return await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: proyectoSelectBasico,
  });
};

/**
 * Agrega un usuario como miembro explícito del proyecto en la tabla proyecto_miembros
 */
export const agregarMiembroExplicito = async (
  proyectoId: number,
  usuarioId: number
): Promise<void> => {
  try {
    // Verificar si ya es miembro
    const yaEsMiembro = await prisma.proyectoMiembro.findUnique({
      where: {
        proyectoId_usuarioId: {
          proyectoId,
          usuarioId,
        },
      },
    });

    // Si ya es miembro, no hacer nada
    if (yaEsMiembro) {
      return;
    }

    // Agregar como miembro
    await prisma.proyectoMiembro.create({
      data: {
        proyectoId,
        usuarioId,
      },
    });
  } catch (error: any) {
    // Si el error es que ya existe (duplicado), ignorarlo
    if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
      return;
    }
    // Para otros errores, relanzar
    throw error;
  }
};

/**
 * Remueve un usuario de los miembros explícitos del proyecto
 */
export const removerMiembroExplicito = async (
  proyectoId: number,
  usuarioId: number
): Promise<void> => {
  await prisma.proyectoMiembro.deleteMany({
    where: {
      proyectoId,
      usuarioId,
    },
  });
};

/**
 * Elimina tareas placeholder de un usuario en un proyecto
 */
export const eliminarTareasPlaceholder = async (
  proyectoId: number,
  usuarioId: number
): Promise<void> => {
  await prisma.tarea.deleteMany({
    where: {
      proyectoId,
      usuarioId,
      ...filtroTareasPlaceholder,
    },
  });
};

/**
 * Desasigna todas las tareas de un usuario en un proyecto
 */
export const desasignarTareasUsuario = async (
  proyectoId: number,
  usuarioId: number
): Promise<void> => {
  await prisma.tarea.updateMany({
    where: {
      proyectoId,
      usuarioId,
    },
    data: {
      usuarioId: null,
      asignado_a: 'Sin asignar',
    },
  });
};

/**
 * Actualiza el gestor del proyecto y el campo responsable
 */
export const actualizarGestorProyecto = async (
  proyectoId: number,
  nuevoGestorId: number,
  nombreResponsable?: string
): Promise<void> => {
  const nombre = nombreResponsable || 'Sin responsable';
  
  await prisma.proyecto.update({
    where: { id: proyectoId },
    data: {
      gestorId: nuevoGestorId,
      responsable: nombre,
    },
  });
};

/**
 * Obtiene el nombre completo de un usuario
 */
export const obtenerNombreUsuario = async (usuarioId: number): Promise<string | null> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nombreCompleto: true },
  });
  return usuario?.nombreCompleto || null;
};

/**
 * Calcula el tiempo relativo desde una fecha hasta ahora
 */
export const calcularTiempoRelativo = (fecha: Date): string => {
  const ahora = new Date();
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Hace instantes';
  } else if (diffMins < 60) {
    return `Hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
  } else if (diffHours < 24) {
    return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  } else {
    return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  }
};

/**
 * Genera las iniciales de un nombre completo
 */
export const generarIniciales = (nombreCompleto: string): string => {
  return (
    nombreCompleto
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'U'
  );
};

/**
 * Determina el rol en el proyecto basado en el rol global y posición en el proyecto
 */
export const determinarRolEnProyecto = (
  rolGlobal: string,
  esCreador: boolean,
  esGestor: boolean
): 'administrator' | 'project-manager' | 'employee' => {
  if (rolGlobal === ROLES.ADMINISTRADOR) {
    return 'administrator';
  } else if (esCreador || esGestor) {
    return 'project-manager';
  }
  return 'employee';
};

/**
 * Obtiene los IDs de miembros del proyecto (creador, gestor, miembros explícitos, usuarios con tareas)
 */
export const obtenerIdsMiembros = async (proyectoId: number): Promise<Set<number>> => {
  const proyecto = await obtenerProyectoBasico(proyectoId);
  if (!proyecto) return new Set();

  // Obtener miembros explícitos de la tabla proyecto_miembros
  const miembrosExplicitos = await prisma.proyectoMiembro.findMany({
    where: { proyectoId },
    select: { usuarioId: true },
  });
  const usuarioIdsMiembros = miembrosExplicitos.map((m) => m.usuarioId);

  // Obtener usuarios con tareas reales (excluyendo placeholders)
  const tareasReales = await prisma.tarea.findMany({
    where: {
      proyectoId,
      usuarioId: { not: null },
      NOT: filtroTareasPlaceholder,
    },
    select: { usuarioId: true },
    distinct: ['usuarioId'],
  });

  const usuarioIdsConTareasReales = tareasReales
    .map((t) => t.usuarioId)
    .filter((id): id is number => id !== null);

  return new Set<number>([
    proyecto.creadoPorId,
    proyecto.gestorId,
    ...usuarioIdsMiembros,
    ...usuarioIdsConTareasReales,
  ]);
};

/**
 * Obtiene la última actividad de cada usuario en el proyecto
 */
export const obtenerUltimaActividadPorUsuario = async (
  proyectoId: number,
  miembrosIds: Set<number>
): Promise<Map<number, Date>> => {
  const tareasDelProyecto = await prisma.tarea.findMany({
    where: { proyectoId },
    select: { id: true },
  });
  const tareaIds = tareasDelProyecto.map((t) => t.id);

  const [comentarios, archivos] = await Promise.all([
    tareaIds.length > 0
      ? prisma.comentario.findMany({
          where: { tareaId: { in: tareaIds } },
          select: { id: true },
        })
      : [],
    tareaIds.length > 0
      ? prisma.archivo.findMany({
          where: { tareaId: { in: tareaIds } },
          select: { id: true },
        })
      : [],
  ]);

  const comentarioIds = comentarios.map((c) => c.id);
  const archivoIds = archivos.map((a) => a.id);

  const actividades = await prisma.logActividad.findMany({
    where: {
      usuarioId: { in: Array.from(miembrosIds) },
      OR: [
        { entidad: 'Proyecto', entidadId: proyectoId },
        ...(tareaIds.length > 0 ? [{ entidad: 'Tarea', entidadId: { in: tareaIds } }] : []),
        ...(comentarioIds.length > 0
          ? [{ entidad: 'Comentario', entidadId: { in: comentarioIds } }]
          : []),
        ...(archivoIds.length > 0 ? [{ entidad: 'Archivo', entidadId: { in: archivoIds } }] : []),
      ],
    },
    select: {
      usuarioId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const ultimaActividadPorUsuario = new Map<number, Date>();
  actividades.forEach((act) => {
    const current = ultimaActividadPorUsuario.get(act.usuarioId);
    if (!current || act.createdAt > current) {
      ultimaActividadPorUsuario.set(act.usuarioId, act.createdAt);
    }
  });

  return ultimaActividadPorUsuario;
};

/**
 * Valida que un usuario existe, retorna null si no existe
 */
export const validarUsuarioExiste = async (
  res: Response,
  usuarioId: number
): Promise<boolean> => {
  const existe = await verificarUsuarioExiste(usuarioId);
  if (!existe) {
    sendNotFoundError(res, 'Usuario');
  }
  return existe;
};

/**
 * Transfiere la gestión del proyecto al creador si el gestor actual es removido
 */
export const transferirGestorACreador = async (
  proyectoId: number,
  creadorId: number
): Promise<void> => {
  const creador = await obtenerNombreUsuario(creadorId);
  await actualizarGestorProyecto(proyectoId, creadorId, creador || undefined);
};

/**
 * Registra el cambio de gestor en el log de actividades
 */
export const registrarCambioGestor = async (
  proyectoId: number,
  userId: number,
  gestorAnteriorId: number,
  nuevoGestorId: number
): Promise<void> => {
  const [gestorAnterior, nuevoGestor] = await Promise.all([
    obtenerNombreUsuario(gestorAnteriorId),
    obtenerNombreUsuario(nuevoGestorId),
  ]);

  registrarActividadActualizacion(
    ENTIDADES.PROYECTO,
    proyectoId,
    userId,
    `Gestor del proyecto cambiado de "${gestorAnterior || 'Desconocido'}" a "${nuevoGestor || 'Desconocido'}"`,
    'gestorId',
    gestorAnterior || 'Desconocido',
    nuevoGestor || 'Desconocido'
  );
};

