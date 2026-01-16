/**
 * Utilidades para crear y gestionar notificaciones de usuarios.
 * Funciones auxiliares para crear notificaciones cuando se asignan o actualizan tareas,
 * cuando se añaden usuarios a proyectos, o cuando hay nuevos commits.
 */
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Crea una notificación para un usuario
 */
export const crearNotificacion = async (
  usuarioId: number,
  titulo: string,
  descripcion: string,
  tipo: 'task-assigned' | 'task-updated' | 'project-added' | 'commit' | 'issue-reported',
  tareaId?: number,
  proyectoId?: number,
  issueId?: number
): Promise<void> => {
  try {
    await prisma.notificacion.create({
      data: {
        usuarioId,
        titulo,
        descripcion,
        tipo,
        tareaId: tareaId ?? null,
        proyectoId: proyectoId ?? null,
        issueId: issueId ?? null,
        leida: false,
      },
    });
  } catch (error) {
    logger.error('Error al crear notificación', error, {
      usuarioId,
      titulo,
      tipo,
      tareaId,
      proyectoId,
    });
  }
};

/**
 * Crea una notificación cuando se asigna una tarea a un usuario
 */
export const crearNotificacionAsignacionTarea = async (
  usuarioId: number,
  tareaId: number,
  tituloTarea: string,
  proyectoId: number,
  asignadoPor?: string
): Promise<void> => {
  const titulo = `Tarea asignada: ${tituloTarea}`;
  const descripcion = asignadoPor
    ? `${asignadoPor} te asignó la tarea "${tituloTarea}".`
    : `Te asignaron la tarea "${tituloTarea}".`;
  
  await crearNotificacion(usuarioId, titulo, descripcion, 'task-assigned', tareaId, proyectoId);
};

/**
 * Crea una notificación cuando se actualiza una tarea asignada a un usuario
 */
export const crearNotificacionActualizacionTarea = async (
  usuarioId: number,
  tareaId: number,
  tituloTarea: string,
  proyectoId: number,
  cambio?: string
): Promise<void> => {
  const titulo = `Estado actualizado en ${tituloTarea}`;
  const descripcion = cambio
    ? `La tarea "${tituloTarea}" cambió: ${cambio}.`
    : `La tarea "${tituloTarea}" fue actualizada.`;
  
  await crearNotificacion(usuarioId, titulo, descripcion, 'task-updated', tareaId, proyectoId);
};

/**
 * Crea una notificación cuando se añade un usuario a un proyecto
 */
export const crearNotificacionAñadidoAProyecto = async (
  usuarioId: number,
  proyectoId: number,
  nombreProyecto: string,
  añadidoPor?: string
): Promise<void> => {
  const titulo = `Añadido al proyecto: ${nombreProyecto}`;
  const descripcion = añadidoPor
    ? `${añadidoPor} te añadió al proyecto "${nombreProyecto}".`
    : `Te añadieron al proyecto "${nombreProyecto}".`;
  
  await crearNotificacion(usuarioId, titulo, descripcion, 'project-added', undefined, proyectoId);
};

/**
 * Crea una notificación cuando hay un nuevo commit en un proyecto
 */
export const crearNotificacionCommit = async (
  usuarioId: number,
  proyectoId: number,
  nombreProyecto: string,
  mensajeCommit: string,
  autorCommit?: string,
  repositorio?: string
): Promise<void> => {
  const titulo = `Nuevo commit en ${nombreProyecto}`;
  const descripcion = autorCommit
    ? `${autorCommit} hizo commit en ${repositorio || nombreProyecto}: ${mensajeCommit}`
    : `Nuevo commit en ${repositorio || nombreProyecto}: ${mensajeCommit}`;
  
  await crearNotificacion(usuarioId, titulo, descripcion, 'commit', undefined, proyectoId);
};

/**
 * Crea una notificación cuando se reporta un issue
 */
export const crearNotificacionIssueReportado = async (
  usuarioId: number,
  issueId: number,
  tituloIssue: string,
  proyectoId: number,
  reportadoPor?: string
): Promise<void> => {
  const titulo = `Nuevo issue reportado: ${tituloIssue}`;
  const descripcion = reportadoPor
    ? `${reportadoPor} reportó un nuevo issue: "${tituloIssue}".`
    : `Se reportó un nuevo issue: "${tituloIssue}".`;
  
  await crearNotificacion(usuarioId, titulo, descripcion, 'issue-reported', undefined, proyectoId, issueId);
};

