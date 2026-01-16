/**
 * Controlador para gestión de releases: CRUD completo.
 */
import { Request, Response } from 'express';
import {
  BuscarReleasesQuery,
  CrearReleaseInput,
  ActualizarReleaseInput,
} from '../validations/release.validation';
import { sendNotFoundError } from '../utils/error-handler';
import { validateAndParseId, validateAndParseIds, getResourceBeforeUpdate, filterUndefined, detectChanges } from '../utils/crud-helpers';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, registrarActividadActualizacion, registrarActividades } from '../utils/actividad-helpers';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import { asyncHandler, requireAuthHandler, requireResource, sendSuccess, sendCreated, sendUpdated, sendDeleted } from '../utils/controller-helpers';
import { ENTIDADES } from '../utils/constants';
import { getById } from '../utils/crud-helpers';
import {
  releaseIncludeBasico,
  releaseIncludeCompleto,
  construirFiltrosRelease,
  mapearEstadoFrontendABackendRelease,
  mapearEstadoBackendAFrontendRelease,
  mapearEstadoTimeline,
  obtenerReleasesYSprints,
  obtenerReleasesYSprintsParaTimeline,
  calcularRangoFechas,
  calcularNumeroColumnasTimeline,
  calcularPosicionTimeline,
  calcularProgresoRelease,
  obtenerAccentTimeline,
  formatearFechaISO,
  generarColumnasTimeline,
  obtenerNombreProyecto,
} from '../utils/release-helpers';
import { construirActividadesDeCambios } from '../utils/actividad-helpers';
import { verificarProyectoExiste } from '../utils/prisma-helpers';

export const buscarReleases = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const query = req.query as unknown as BuscarReleasesQuery;
  const where = construirFiltrosRelease(query);
  const { pagina, limite } = getPaginationParams(req);
  const skip = getSkip(pagina, limite);
  const [releases, total] = await Promise.all([
    prisma.release.findMany({
      where,
      skip,
      take: limite,
      include: releaseIncludeBasico,
      orderBy: { fecha_lanzamiento: 'asc' },
    }),
    prisma.release.count({ where }),
  ]);

  sendSuccess(res, {
    releases,
    paginacion: buildPaginationResponse(total, pagina, limite),
    filtros: {
      proyecto: query.proyecto || null,
      estado: query.estado || null,
    },
  });
});


export const obtenerReleasePorId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const release = await getById(req, res, prisma.release, releaseIncludeCompleto, 'Release');
  if (release) {
    sendSuccess(res, { release });
  }
});



export const crearRelease = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const datos: CrearReleaseInput = req.body;
  const userId = requireAuthenticatedUser(req, res)!;

  if (!(await verificarProyectoExiste(datos.proyectoId))) {
    sendNotFoundError(res, 'Proyecto');
    return;
  }

  const nombreProyecto = await obtenerNombreProyecto(datos.proyectoId);
  // Obtener estadoFrontend del objeto validado (ahora está en el schema)
  const estadoFrontend = datos.estadoFrontend;
  const estadoBackend = estadoFrontend 
    ? mapearEstadoFrontendABackendRelease(estadoFrontend)
    : datos.estado ?? 'Sin_lanzar';
  
  const release = await prisma.release.create({
    data: {
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      fecha_inicio: datos.fecha_inicio,
      fecha_lanzamiento: datos.fecha_lanzamiento,
      estado: estadoBackend,
      proyectoId: datos.proyectoId,
    },
    include: releaseIncludeBasico,
  });

  registrarActividadSimple('crear', ENTIDADES.RELEASE, release.id, userId, 
    `Release "${release.nombre}" creado en proyecto "${nombreProyecto || datos.proyectoId}"`);
  
  sendCreated(res, { release }, 'Release creado exitosamente');
});


export const actualizarRelease = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const releaseId = validateAndParseId(req, res, 'id', 'Release');
  if (!releaseId) return;

  const releaseAnterior = await getResourceBeforeUpdate<{ id: number; proyectoId: number; nombre: string }>(
    req,
    res,
    prisma.release,
    'id',
    'Release'
  );
  if (!releaseAnterior) return;

  const datos: ActualizarReleaseInput = req.body;
  // Obtener estadoFrontend del objeto validado (ahora está en el schema)
  const estadoFrontend = datos.estadoFrontend;
  
  if (datos.proyectoId && datos.proyectoId !== releaseAnterior.proyectoId) {
    if (!(await verificarProyectoExiste(datos.proyectoId))) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }
  }

  const datosActualizacion = filterUndefined(datos);
  // Procesar estadoFrontend - siempre debe estar presente en actualizaciones
  // Si estadoFrontend está presente, actualizar el estado; de lo contrario, mantener el estado actual
  if (estadoFrontend !== undefined && estadoFrontend !== null) {
    datosActualizacion.estado = mapearEstadoFrontendABackendRelease(estadoFrontend);
  }
  // Eliminar estadoFrontend de datosActualizacion ya que no es un campo de la base de datos
  delete (datosActualizacion as any).estadoFrontend;
  // Si no se proporciona estadoFrontend, el estado no se actualizará y se mantendrá el valor actual
  
  // Excluir proyectoId si no está cambiando (Prisma requiere ReleaseUncheckedUpdateInput si se incluye proyectoId)
  if (datosActualizacion.proyectoId === releaseAnterior.proyectoId) {
    delete datosActualizacion.proyectoId;
  }
  
  const release = await prisma.release.update({
    where: { id: releaseId },
    data: datosActualizacion,
    include: releaseIncludeBasico,
  });

  const cambios = detectChanges(releaseAnterior, datosActualizacion);
  if (cambios.length > 0) {
    const actividades = construirActividadesDeCambios(
      cambios,
      ENTIDADES.RELEASE,
      releaseId,
      userId,
      `release "${release.nombre}"`
    );
    registrarActividades(actividades);
  }

  sendUpdated(res, { release }, 'Release actualizado exitosamente');
});


export const eliminarRelease = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const releaseId = validateAndParseId(req, res, 'id', 'Release');
  if (!releaseId) return;

  const release = await requireResource(
    () => prisma.release.findUnique({
      where: { id: releaseId },
      select: { id: true, nombre: true },
    }),
    res,
    'Release'
  );
  if (!release) return;

  await prisma.release.delete({ where: { id: releaseId } });
  registrarActividadSimple('eliminar', ENTIDADES.RELEASE, releaseId, userId, 
    `Release "${release.nombre}" eliminado`);
  
  sendDeleted(res, 'Release eliminado exitosamente');
});


export const agregarTareaRelease = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const ids = validateAndParseIds(req, res, [
    { paramName: 'id', resourceName: 'Release' },
    { paramName: 'tareaId', resourceName: 'Tarea' }
  ]);
  if (!ids) return;

  const [release, tarea] = await Promise.all([
    prisma.release.findUnique({
      where: { id: ids.id },
      select: { id: true, proyectoId: true, nombre: true },
    }),
    prisma.tarea.findUnique({
      where: { id: ids.tareaId },
      select: { id: true, proyectoId: true, titulo: true },
    }),
  ]);

  if (!release) {
    sendNotFoundError(res, 'Release');
    return;
  }
  if (!tarea) {
    sendNotFoundError(res, 'Tarea');
    return;
  }
  if (release.proyectoId !== tarea.proyectoId) {
    res.status(400).json({
      error: 'La tarea debe pertenecer al mismo proyecto que el release',
    });
    return;
  }

  try {
    await prisma.tareaRelease.create({
      data: { tareaId: ids.tareaId, releaseId: ids.id },
    });

    registrarActividadActualizacion(ENTIDADES.RELEASE, ids.id, userId, 
      `Tarea "${tarea.titulo}" agregada al release "${release.nombre}"`);
    sendSuccess(res, {}, 'Tarea agregada al release exitosamente');
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'La tarea ya está asociada a este release' });
      return;
    }
    throw error;
  }
});

export const quitarTareaRelease = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const ids = validateAndParseIds(req, res, [
    { paramName: 'releaseId', resourceName: 'Release' },
    { paramName: 'tareaId', resourceName: 'Tarea' }
  ]);
  if (!ids) return;
  
  const release = await requireResource(
    () => prisma.release.findUnique({
      where: { id: ids.releaseId },
      select: { id: true, nombre: true },
    }),
    res,
    'Release'
  );
  if (!release) return;

  await prisma.tareaRelease.delete({
    where: {
      tareaId_releaseId: { tareaId: ids.tareaId, releaseId: ids.releaseId },
    },
  });

  registrarActividadActualizacion(ENTIDADES.RELEASE, ids.releaseId, userId, 
    `Tarea removida del release "${release.nombre}"`);

  sendDeleted(res, 'Tarea removida del release exitosamente');
});

/**
 * Obtiene los datos formateados para la página de releases (planeación y cronograma)
 * Incluye releases y sprints con sus posiciones calculadas en el timeline
 */
export const obtenerDatosReleasesPage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const proyectoId = validateAndParseId(req, res, 'proyectoId', 'Proyecto');
  if (!proyectoId) return;

  const [releases, sprints] = await obtenerReleasesYSprints(proyectoId);
  const { fechaMinima, fechaMaxima } = calcularRangoFechas(releases, sprints);
  const numColumnas = calcularNumeroColumnasTimeline(fechaMinima, fechaMaxima);

  const releasesFormateados = releases.map((release) => ({
    id: release.id.toString(),
    version: release.nombre,
    status: mapearEstadoBackendAFrontendRelease(release.estado),
    progress: calcularProgresoRelease(release.estado),
    startDate: formatearFechaISO(release.fecha_inicio),
    releaseDate: formatearFechaISO(release.fecha_lanzamiento),
    description: release.descripcion || '',
  }));

  const timelineItems = [
    ...releases.map((release) => {
      const estadoTimeline = mapearEstadoTimeline(release.estado, 'release');
      const estadoFrontend = mapearEstadoBackendAFrontendRelease(release.estado);
      // Usar el estado frontend directamente para calcular el color del release
      return {
        id: `release-${release.id}`,
        label: release.nombre,
        type: 'release' as const,
        status: estadoTimeline, // Mantener estadoTimeline para compatibilidad con el frontend
        start: calcularPosicionTimeline(new Date(release.fecha_inicio), fechaMinima, numColumnas),
        end: calcularPosicionTimeline(new Date(release.fecha_lanzamiento), fechaMinima, numColumnas),
        accent: obtenerAccentTimeline('release', estadoFrontend), // Usar estadoFrontend para el color
        backendId: release.id.toString(),
        backendType: 'release' as const,
      };
    }),
    ...sprints.map((sprint) => {
      const estadoTimeline = mapearEstadoTimeline(sprint.estado, 'sprint');
      return {
        id: `sprint-${sprint.id}`,
        label: sprint.nombre,
        type: 'sprint' as const,
        status: estadoTimeline,
        start: calcularPosicionTimeline(new Date(sprint.fecha_inicio), fechaMinima, numColumnas),
        end: calcularPosicionTimeline(new Date(sprint.fecha_fin), fechaMinima, numColumnas),
        accent: obtenerAccentTimeline('sprint', estadoTimeline),
        backendId: sprint.id.toString(),
        backendType: 'sprint' as const,
      };
    }),
  ].sort((a, b) => a.start - b.start);

  sendSuccess(res, {
    releases: releasesFormateados,
    timelineItems,
    timelineColumns: generarColumnasTimeline(fechaMinima, numColumnas),
    fechaInicio: fechaMinima.toISOString(),
    fechaFin: fechaMaxima.toISOString(),
  });
});

/**
 * Calcula fechas desde posiciones del timeline
 */
export const calcularFechasDesdeTimeline = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const proyectoId = validateAndParseId(req, res, 'proyectoId', 'Proyecto');
  if (!proyectoId) return;

  const { startColumn, endColumn } = req.body;
  if (typeof startColumn !== 'number' || typeof endColumn !== 'number') {
    res.status(400).json({ error: 'startColumn y endColumn deben ser números' });
    return;
  }

  const [releases, sprints] = await obtenerReleasesYSprints(proyectoId);
  const { fechaMinima } = calcularRangoFechas(releases, sprints);

  const startDate = new Date(fechaMinima);
  startDate.setDate(startDate.getDate() + (startColumn - 1) * 7);
  const endDate = new Date(fechaMinima);
  endDate.setDate(endDate.getDate() + (endColumn - 1) * 7);

  sendSuccess(res, {
    fechaInicio: startDate.toISOString(),
    fechaFin: endDate.toISOString(),
  });
});

/**
 * Obtiene el timeline formateado de releases y sprints para un proyecto
 * GET /api/releases/timeline/:proyectoId
 */
export const obtenerTimeline = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const proyectoId = validateAndParseId(req, res, 'proyectoId', 'Proyecto');
  if (!proyectoId) return;

  const proyecto = await requireResource(
    () => prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, nombre: true },
    }),
    res,
    'Proyecto'
  );
  if (!proyecto) return;

  const [releases, sprints] = await obtenerReleasesYSprintsParaTimeline(proyectoId);

  const timeline = {
    releases: releases.map((r) => ({
      id: r.id.toString(),
      label: r.nombre,
      type: 'release' as const,
      status: r.estado,
      startDate: formatearFechaISO(r.fecha_inicio),
      endDate: formatearFechaISO(r.fecha_lanzamiento),
    })),
    sprints: sprints.map((s) => ({
      id: s.id.toString(),
      label: s.nombre,
      type: 'sprint' as const,
      status: s.estado,
      startDate: formatearFechaISO(s.fecha_inicio),
      endDate: formatearFechaISO(s.fecha_fin),
    })),
  };

  sendSuccess(res, {
    proyecto: {
      id: proyecto.id.toString(),
      nombre: proyecto.nombre,
    },
    timeline,
  });
});
