/**
 * Controlador para gestión de sprints: CRUD completo.
 */
import { Request, Response } from 'express';
import { sendNotFoundError } from '../utils/error-handler';
import { validateAndParseId, getResourceBeforeUpdate, filterUndefined, detectChanges } from '../utils/crud-helpers';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, construirActividadesDeCambios, registrarActividades } from '../utils/actividad-helpers';
import { requireAuthHandler, requireResource, sendCreated, sendUpdated, sendDeleted } from '../utils/controller-helpers';
import { ENTIDADES } from '../utils/constants';
import { verificarProyectoExiste } from '../utils/prisma-helpers';
import { obtenerNombreProyecto } from '../utils/release-helpers';
import { requireAuthenticatedUser } from '../utils/response-helpers';

export interface CrearSprintInput {
  nombre: string;
  descripcion?: string | null;
  fecha_inicio: string | Date;
  fecha_fin: string | Date;
  estado?: 'Pendiente' | 'En_progreso' | 'Completado';
  proyectoId: number;
}

export interface ActualizarSprintInput {
  nombre?: string;
  descripcion?: string | null;
  fecha_inicio?: string | Date;
  fecha_fin?: string | Date;
  estado?: 'Pendiente' | 'En_progreso' | 'Completado';
  proyectoId?: number;
}

const sprintIncludeBasico = {
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
} as const;

export const crearSprint = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const datos: CrearSprintInput = req.body;
  const userId = requireAuthenticatedUser(req, res)!;

  if (!(await verificarProyectoExiste(datos.proyectoId))) {
    sendNotFoundError(res, 'Proyecto');
    return;
  }

  const nombreProyecto = await obtenerNombreProyecto(datos.proyectoId);
  const estadoBackend = datos.estado ?? 'Pendiente';
  
  const sprint = await prisma.sprint.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      fecha_inicio: datos.fecha_inicio,
      fecha_fin: datos.fecha_fin,
      estado: estadoBackend,
      proyectoId: datos.proyectoId,
    },
    include: sprintIncludeBasico,
  });

  registrarActividadSimple('crear', ENTIDADES.SPRINT, sprint.id, userId, 
    `Sprint "${sprint.nombre}" creado en proyecto "${nombreProyecto || datos.proyectoId}"`);
  
  sendCreated(res, { sprint }, 'Sprint creado exitosamente');
});

export const actualizarSprint = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const sprintId = validateAndParseId(req, res, 'id', 'Sprint');
  if (!sprintId) return;

  const sprintAnterior = await getResourceBeforeUpdate<{ id: number; proyectoId: number; nombre: string }>(
    req,
    res,
    prisma.sprint,
    'id',
    'Sprint'
  );
  if (!sprintAnterior) return;

  const datos: ActualizarSprintInput = req.body;
  
  if (datos.proyectoId && datos.proyectoId !== sprintAnterior.proyectoId) {
    if (!(await verificarProyectoExiste(datos.proyectoId))) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }
  }

  const datosActualizacion = filterUndefined(datos);
  
  const sprint = await prisma.sprint.update({
    where: { id: sprintId },
    data: datosActualizacion,
    include: sprintIncludeBasico,
  });

  const cambios = detectChanges(sprintAnterior, datosActualizacion);
  if (cambios.length > 0) {
    const actividades = construirActividadesDeCambios(
      cambios,
      ENTIDADES.SPRINT,
      sprintId,
      userId,
      `sprint "${sprint.nombre}"`
    );
    registrarActividades(actividades);
  }

  sendUpdated(res, { sprint }, 'Sprint actualizado exitosamente');
});

export const eliminarSprint = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const sprintId = validateAndParseId(req, res, 'id', 'Sprint');
  if (!sprintId) return;

  const sprint = await requireResource(
    () => prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, nombre: true },
    }),
    res,
    'Sprint'
  );
  if (!sprint) return;

  await prisma.sprint.delete({ where: { id: sprintId } });
  registrarActividadSimple('eliminar', ENTIDADES.SPRINT, sprintId, userId, 
    `Sprint "${sprint.nombre}" eliminado`);
  
  sendDeleted(res, 'Sprint eliminado exitosamente');
});

