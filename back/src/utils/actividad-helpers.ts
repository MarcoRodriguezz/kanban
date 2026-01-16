/**
 * Utilidades específicas para operaciones con actividades de auditoría.
 * Funciones auxiliares para verificar permisos, construir filtros y obtener información de entidades.
 * Incluye sistema de registro de actividades y construcción de actividades de auditoría.
 */
import { Request, Response } from 'express';
import { prisma } from './prisma';
import { ROLES, ENTIDADES, ACCIONES_AUDITORIA } from './constants';
import { requireAuthenticatedUser } from './response-helpers';
import { logger } from './logger';
import { detectChanges } from './crud-helpers';

export const MAX_ACTIVIDADES_POR_ENTIDAD = 100;
export const actividadIncludeUsuario = {
  usuario: {
    select: {
      id: true,
      nombreCompleto: true,
      email: true,
    },
  },
} as const;


const extraerIds = <T extends { id: number }>(items: T[]): number[] => {
  return items.map(item => item.id);
};

const manejarErrorSilencioso = (promise: Promise<any>): void => {
  promise.catch(() => {
    // Error ya manejado en la función que llama
  });
};

export const obtenerProyectosDelGestor = async (userId: number): Promise<number[]> => {
  const proyectos = await prisma.proyecto.findMany({
    where: { gestorId: userId },
    select: { id: true },
  });
  return extraerIds(proyectos);
};

export const verificarPermisosActividad = async (
  req: Request,
  res: Response
): Promise<{ userId: number; rol: string; esAdmin: boolean; esGestor: boolean } | null> => {
  const userId = requireAuthenticatedUser(req, res);
  if (!userId) return null;
  const rol = req.user?.rol || '';
  const esAdmin = rol === ROLES.ADMINISTRADOR;
  
  // Verificar si es gestor de algún proyecto (no basado en rol global)
  const proyectosDelGestor = await obtenerProyectosDelGestor(userId);
  const esGestor = proyectosDelGestor.length > 0;

  if (!esAdmin && !esGestor) {
    res.status(403).json({
      error: 'Solo administradores y gestores de proyecto pueden consultar los logs de actividad',
    });
    return null;
  }
  return { userId, rol, esAdmin, esGestor };
};


export const obtenerProyectoIdDeEntidad = async (
  entidad: string,
  entidadId: number
): Promise<{ proyectoId: number | null; error?: string }> => {
  if (entidad === ENTIDADES.PROYECTO) {
    return { proyectoId: entidadId };
  }
  if (entidad === ENTIDADES.TAREA) {
    const tarea = await prisma.tarea.findUnique({
      where: { id: entidadId },
      select: { proyectoId: true },
    });
    if (!tarea) {
      return { proyectoId: null, error: 'Tarea no encontrada' };
    }
    return { proyectoId: tarea.proyectoId };
  }

  // Helper para entidades relacionadas con tarea (comentario y archivo)
  const obtenerProyectoIdDesdeTarea = async (
    modelo: 'comentario' | 'archivo',
    entidadId: number,
    nombreEntidad: string
  ): Promise<{ proyectoId: number | null; error?: string }> => {
    const entidad = modelo === 'comentario'
      ? await prisma.comentario.findUnique({
          where: { id: entidadId },
          select: { tarea: { select: { proyectoId: true } } },
        })
      : await prisma.archivo.findUnique({
          where: { id: entidadId },
          select: { tarea: { select: { proyectoId: true } } },
        });

    if (!entidad) {
      return { proyectoId: null, error: `${nombreEntidad} no encontrado` };
    }
    return { proyectoId: entidad.tarea.proyectoId };
  };
  if (entidad === ENTIDADES.COMENTARIO) {
    return obtenerProyectoIdDesdeTarea('comentario', entidadId, 'Comentario');
  }
  if (entidad === ENTIDADES.ARCHIVO) {
    return obtenerProyectoIdDesdeTarea('archivo', entidadId, 'Archivo');
  }
  return { proyectoId: null, error: `Tipo de entidad no válido: ${entidad}` };
};

/**
 * Helper: Valida y convierte string a Date
 */
const parsearFecha = (fechaString: string): Date | null => {
  const fecha = new Date(fechaString);
  return !isNaN(fecha.getTime()) ? fecha : null;
};

/**
 * @param fechaInicio - Fecha de inicio (opcional)
 * @param fechaFin - Fecha de fin (opcional)
 * @returns Objeto con filtro de fecha para Prisma
 */
export const construirFiltroFecha = (
  fechaInicio?: string | null,
  fechaFin?: string | null
): { createdAt?: { gte?: Date; lte?: Date } } => {
  const filtroFecha: { gte?: Date; lte?: Date } = {};
  if (fechaInicio) {
    const fechaInicioDate = parsearFecha(String(fechaInicio));
    if (fechaInicioDate) {
      filtroFecha.gte = fechaInicioDate;
    }
  }
  if (fechaFin) {
    const fechaFinDate = parsearFecha(String(fechaFin));
    if (fechaFinDate) {
      // Incluir todo el día (hasta las 23:59:59)
      fechaFinDate.setHours(23, 59, 59, 999);
      filtroFecha.lte = fechaFinDate;
    }
  }
  return Object.keys(filtroFecha).length > 0 ? { createdAt: filtroFecha } : {};
};

/**
 * @param where - Filtro WHERE para Prisma
 * @param skip - Número de registros a saltar
 * @param take - Número de registros a tomar
 * @returns Array con [actividades, total]
 */
export const consultarActividadesConPaginacion = async (
  where: any,
  skip: number,
  take: number
): Promise<[any[], number]> => {
  return Promise.all([
    prisma.logActividad.findMany({
      where,
      skip,
      take,
      include: actividadIncludeUsuario,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.logActividad.count({ where }),
  ]);
};

/**
 * Construye el filtro WHERE para actividades según el rol del usuario
 * - Administradores: ven todas las actividades
 * - Gestores: solo ven actividades de sus proyectos
 */
export const construirFiltroActividades = async (
  userId: number,
  esAdmin: boolean,
  esGestor: boolean,
  filtrosAdicionales: any = {}
): Promise<any> => {
  if (esAdmin) {
    return filtrosAdicionales;
  }
  if (esGestor) {
    const proyectosDelGestor = await obtenerProyectosDelGestor(userId);

    if (proyectosDelGestor.length === 0) {
      return { id: -1 };
    }
    // Obtener tareas, comentarios y archivos en paralelo
    const [tareasDeProyectos, comentariosDeTareas, archivosDeTareas] = await Promise.all([
      prisma.tarea.findMany({
        where: { proyectoId: { in: proyectosDelGestor } },
        select: { id: true },
      }),
      // Obtener comentarios directamente por proyectoId usando relación
      prisma.comentario.findMany({
        where: {
          tarea: {
            proyectoId: { in: proyectosDelGestor },
          },
        },
        select: { id: true },
      }),
      // Obtener archivos directamente por proyectoId usando relación
      prisma.archivo.findMany({
        where: {
          tarea: {
            proyectoId: { in: proyectosDelGestor },
          },
        },
        select: { id: true },
      }),
    ]);

    const tareaIds = extraerIds(tareasDeProyectos);
    const comentarioIds = extraerIds(comentariosDeTareas);
    const archivoIds = extraerIds(archivosDeTareas);
    const agregarFiltroSiHayIds = (
      filtros: any[],
      entidad: string,
      ids: number[]
    ): void => {
      if (ids.length > 0) {
        filtros.push({ entidad, entidadId: { in: ids } });
      }
    };

    const filtroProyecto: any[] = [
      { entidad: ENTIDADES.PROYECTO, entidadId: { in: proyectosDelGestor } },
    ];

    agregarFiltroSiHayIds(filtroProyecto, ENTIDADES.TAREA, tareaIds);
    agregarFiltroSiHayIds(filtroProyecto, ENTIDADES.COMENTARIO, comentarioIds);
    agregarFiltroSiHayIds(filtroProyecto, ENTIDADES.ARCHIVO, archivoIds);

    // Combinar filtros adicionales con restricción de proyecto usando AND
    const where: any = {
      ...filtrosAdicionales,
      AND: [{ OR: filtroProyecto }],
    };
    return where;
  }
  // Si no es admin ni gestor
  return { id: -1 };
};

/**
 * Elimina registros de logActividad que tienen más de 30 días de antigüedad
 * @returns Número de registros eliminados
 */
export const limpiarActividadesAntiguas = async (): Promise<number> => {
  try {
    const fechaLimite30Dias = new Date();
    fechaLimite30Dias.setDate(fechaLimite30Dias.getDate() - 30);

    const resultado = await prisma.logActividad.deleteMany({
      where: {
        createdAt: {
          lt: fechaLimite30Dias,
        },
      },
    });

    if (resultado.count > 0) {
      logger.info(`Limpieza de actividades: ${resultado.count} registros eliminados`, {
        fechaLimite: fechaLimite30Dias.toISOString(),
      });
    }
    return resultado.count;
  } catch (error) {
    logger.error('Error al limpiar actividades antiguas', error);
    throw error;
  }
};

// Throttle para limpieza automática
let ultimaLimpieza: number = 0;
const INTERVALO_LIMPIEZA_MS = 24 * 60 * 60 * 1000; // 24 horas (1 día)
/**
 * Limpia actividades antiguas con throttle (máximo una vez al día)
 */
const limpiarActividadesConThrottle = async (): Promise<void> => {
  const ahora = Date.now();
  const tiempoDesdeUltimaLimpieza = ahora - ultimaLimpieza;
  if (tiempoDesdeUltimaLimpieza < INTERVALO_LIMPIEZA_MS) {
    return;
  }
  ultimaLimpieza = ahora;
  limpiarActividadesAntiguas().catch((error) => {
    logger.error('Error en limpieza automática con throttle', error);
  });
};

/**
 * Sistema de registro de actividades para auditoría.
 * Registra acciones de usuarios (crear, actualizar, eliminar) de forma asíncrona sin bloquear las respuestas HTTP.
 * Automáticamente mantiene solo los últimos 30 días de actividades.
 */
export interface ActividadInput {
  accion: 'crear' | 'actualizar' | 'eliminar' | 'cambiar_estado' | string;
  entidad: 'Tarea' | 'Proyecto' | 'Comentario' | 'Archivo' | string;
  entidadId: number;
  campo?: string;
  valorAnterior?: string;
  valorNuevo?: string;
  descripcion?: string;
  usuarioId: number;
}

/**
 * Convierte ActividadInput a formato de Prisma
 */
const convertirAPrismaData = (actividad: ActividadInput) => ({
  accion: actividad.accion,
  entidad: actividad.entidad,
  entidadId: actividad.entidadId,
  campo: actividad.campo ?? null,
  valorAnterior: actividad.valorAnterior ?? null,
  valorNuevo: actividad.valorNuevo ?? null,
  descripcion: actividad.descripcion ?? null,
  usuarioId: actividad.usuarioId,
});

/**
 * Registra una actividad en la base de datos
 * No bloquea el flujo principal si hay errores
 * Automáticamente limpia actividades más antiguas de 30 días (con throttle)
 */
const guardarActividades = async (actividades: ActividadInput[]): Promise<void> => {
  if (actividades.length === 0) return;

  try {
    const datosPrisma = actividades.map(convertirAPrismaData);
    
    // Guardar las nuevas actividades
    await prisma.logActividad.createMany({
      data: datosPrisma,
      skipDuplicates: true,
    });
    
    manejarErrorSilencioso(limpiarActividadesConThrottle());
  } catch (error) {
    logger.error('Error al guardar actividades', error, {
      cantidad: actividades.length,
    });
    console.error('[guardarActividades] Error:', error);
  }
};

/**
 * Registra una actividad de forma asíncrona (fire-and-forget)
 * No bloquea la respuesta HTTP
 */
export const registrarActividad = (actividad: ActividadInput): void => {
  manejarErrorSilencioso(guardarActividades([actividad]));
};

/**
 * Registra múltiples actividades de forma optimizada
 * Usa createMany para mejor rendimiento y no bloquea la respuesta HTTP
 */
export const registrarActividades = (actividades: ActividadInput[]): void => {
  if (actividades.length === 0) return;
  
  manejarErrorSilencioso(guardarActividades(actividades));
};

/**
 * Helper genérico para registrar actividades simples (crear/eliminar)
 * Reduce boilerplate sin crear helpers específicos por entidad
 */
export const registrarActividadSimple = (
  accion: 'crear' | 'eliminar',
  entidad: string,
  entidadId: number,
  userId: number,
  descripcion: string
): void => {
  registrarActividades([{
    accion: ACCIONES_AUDITORIA[accion.toUpperCase() as keyof typeof ACCIONES_AUDITORIA],
    entidad,
    entidadId,
    usuarioId: userId,
    descripcion,
  }]);
};

/**
 * Helper genérico para registrar actividades de actualización con campos
 */
export const registrarActividadActualizacion = (
  entidad: string,
  entidadId: number,
  userId: number,
  descripcion: string,
  campo?: string,
  valorAnterior?: string,
  valorNuevo?: string,
  accion: string = ACCIONES_AUDITORIA.ACTUALIZAR
): void => {
  registrarActividades([{
    accion,
    entidad,
    entidadId,
    campo,
    valorAnterior,
    valorNuevo,
    usuarioId: userId,
    descripcion,
  }]);
};

/**
 * Construye actividades de auditoría a partir de cambios detectados
 */
export const construirActividadesDeCambios = (
  cambios: Array<{ campo: string; valorAnterior: any; valorNuevo: any }>,
  entidad: string,
  entidadId: number,
  userId: number,
  nombreEntidad: string,
  accionPorCampo?: (campo: string) => string
): ActividadInput[] => {
  return cambios.map(cambio => ({
    accion: accionPorCampo 
      ? accionPorCampo(cambio.campo) 
      : ACCIONES_AUDITORIA.ACTUALIZAR,
    entidad,
    entidadId,
    campo: cambio.campo,
    valorAnterior: String(cambio.valorAnterior ?? ''),
    valorNuevo: String(cambio.valorNuevo ?? ''),
    usuarioId: userId,
    descripcion: `Campo "${cambio.campo}" actualizado en ${nombreEntidad}`,
  }));
};

/**
 * Construye actividades de cambios comparando objeto anterior con datos de actualización
 */
export const construirActividadesDesdeObjetos = <T extends Record<string, any>>(
  objetoAnterior: T,
  datosActualizacion: Partial<T>,
  entidad: string,
  entidadId: number,
  userId: number,
  nombreEntidad: string,
  accionPorCampo?: (campo: string) => string
): ActividadInput[] => {
  const cambios = detectChanges(objetoAnterior, datosActualizacion);
  return construirActividadesDeCambios(
    cambios,
    entidad,
    entidadId,
    userId,
    nombreEntidad,
    accionPorCampo
  );
};

/**
 * Procesa actividades para el formato del backlog
 * Convierte acciones, campos y valores al formato esperado por el frontend
 */
export interface ActividadProcesada {
  id: number;
  accion: string;
  entidad: string;
  entidadId: number;
  campo: string | null;
  valorAnterior: string | null;
  valorNuevo: string | null;
  descripcion: string | null;
  usuarioId: number;
  createdAt: Date;
  usuario: {
    id: number;
    nombreCompleto: string;
    email: string;
  } | null;
  // Campos procesados para el backlog
  backlogAction?: string;
  from?: string;
  to?: string;
  taskTitle?: string;
}

/**
 * Mapea acciones a tipos de backlog
 */
const mapearAccionBacklog = (
  accion: string,
  entidad: string,
  campo: string | null
): string | null => {
  if (entidad === 'Tarea') {
    if (accion === 'crear') return 'create-task';
    if (accion === 'cambiar_estado' || campo === 'estado') return 'update-status';
    if (accion === 'actualizar') {
      if (campo === 'usuarioId' || campo === 'asignado_a') return 'assign-task';
      if (campo === 'estado') return 'update-status';
      if (campo === 'etiquetas') return 'add-label';
      return 'edit-task';
    }
    if (accion === 'eliminar') return 'delete-task';
  }
  if (entidad === 'Comentario' && accion === 'crear') return 'comment';
  if (entidad === 'Etiqueta' && accion === 'crear') return 'add-label';
  if (entidad === 'Proyecto') return null;
  return null;
};

/**
 * Formatea estados para el backlog
 */
const formatearEstado = (valor: string): string => {
  const estados: Record<string, string> = {
    'Pendiente': 'Pendiente',
    'En_progreso': 'En progreso',
    'En_revision': 'En revisión',
    'Completado': 'Completado',
  };
  return estados[valor] || valor;
};

/**
 * Extrae información de cambio de estado desde la descripción
 */
const extraerCambioEstado = (descripcion: string): { taskTitle?: string; from?: string; to?: string } => {
  const match = descripcion.match(/Estado de tarea "([^"]+)" cambiado de "([^"]+)" a "([^"]+)"/);
  if (match) {
    return {
      taskTitle: match[1],
      from: formatearEstado(match[2]),
      to: formatearEstado(match[3]),
    };
  }
  return {};
};

/**
 * Extrae información de asignación desde la descripción
 */
const extraerAsignacion = (descripcion: string): { from?: string; to?: string } => {
  const reasignacionMatch = descripcion.match(/reasignada de ([^"]+) a ([^"]+)/);
  if (reasignacionMatch) {
    return { from: reasignacionMatch[1], to: reasignacionMatch[2] };
  }
  
  const asignacionMatch = descripcion.match(/asignada a ([^"]+)/);
  if (asignacionMatch) {
    return { to: asignacionMatch[1] };
  }
  
  const desasignacionMatch = descripcion.match(/desasignada de ([^"]+)/);
  if (desasignacionMatch) {
    return { from: desasignacionMatch[1] };
  }
  
  return {};
};

/**
 * Extrae título de tarea desde la descripción
 */
const extraerTituloTarea = (descripcion: string): string | undefined => {
  // Buscar título en formato: Tarea "título" eliminada o Tarea "título" creada
  const match = descripcion.match(/Tarea "([^"]+)"/);
  return match ? match[1] : undefined;
};

export const procesarActividadesParaBacklog = async (
  actividades: any[]
): Promise<ActividadProcesada[]> => {

  // Procesar cada actividad
  const actividadesProcesadas = await Promise.all(
    actividades.map(async (actividad: any) => {
      const backlogAction = mapearAccionBacklog(
        actividad.accion,
        actividad.entidad,
        actividad.campo
      );

      // Si no hay acción válida para el backlog, retornar null (se filtrará después)
      if (!backlogAction) {
        return null;
      }

      let from: string | undefined = undefined;
      let to: string | undefined = undefined;
      let taskTitle: string | undefined = undefined;

      // Procesar valores según el tipo de acción
      if (backlogAction === 'update-status') {
        if (actividad.valorAnterior) {
          from = formatearEstado(actividad.valorAnterior);
        }
        if (actividad.valorNuevo) {
          to = formatearEstado(actividad.valorNuevo);
        }
        if (!from && !to && actividad.descripcion) {
          const cambioEstado = extraerCambioEstado(actividad.descripcion);
          taskTitle = cambioEstado.taskTitle;
          from = cambioEstado.from;
          to = cambioEstado.to;
        }
      } else if (backlogAction === 'assign-task') {
        if (actividad.valorAnterior && actividad.valorAnterior !== 'null' && actividad.valorAnterior !== 'Sin asignar') {
          from = actividad.valorAnterior;
        }
        if (actividad.valorNuevo && actividad.valorNuevo !== 'null' && actividad.valorNuevo !== 'Sin asignar') {
          to = actividad.valorNuevo;
        }
        if (!from && !to && actividad.descripcion) {
          const asignacion = extraerAsignacion(actividad.descripcion);
          from = asignacion.from;
          to = asignacion.to;
        }
      } else if (backlogAction === 'create-task' || backlogAction === 'delete-task') {
        taskTitle = actividad.descripcion ? extraerTituloTarea(actividad.descripcion) : undefined;
      } else if (backlogAction === 'add-label') {
        if (actividad.descripcion) {
          const match = actividad.descripcion.match(/Etiqueta "([^"]+)" agregada/);
          if (match) {
            to = match[1];
          }
        }
      } else if (backlogAction === 'edit-task') {
        if (actividad.descripcion && actividad.entidad === 'Tarea') {
          const match = actividad.descripcion.match(/tarea "([^"]+)"/i);
          if (match) {
            taskTitle = match[1];
          }
        }
      } else if (backlogAction === 'add-label' && actividad.campo === 'etiquetas') {
        // Para actualización de etiquetas en tareas, extraer información de la descripción
        if (actividad.descripcion) {
          // Intentar extraer el título de la tarea
          const tituloMatch = actividad.descripcion.match(/tarea "([^"]+)"/i);
          if (tituloMatch) {
            taskTitle = tituloMatch[1];
          }
          // Intentar extraer información sobre etiquetas agregadas/eliminadas
          const agregadaMatch = actividad.descripcion.match(/Etiqueta "([^"]+)" agregada/);
          if (agregadaMatch) {
            to = agregadaMatch[1];
          }
          const eliminadaMatch = actividad.descripcion.match(/Etiqueta "([^"]+)" (?:desasociada|eliminada)/);
          if (eliminadaMatch) {
            from = eliminadaMatch[1];
          }
          // Si dice "Etiquetas actualizadas", intentar obtener las etiquetas actuales
          if (actividad.descripcion.includes('Etiquetas actualizadas')) {
            // Obtener las etiquetas actuales de la tarea si es posible
            try {
              const tarea = await prisma.tarea.findUnique({
                where: { id: actividad.entidadId },
                select: {
                  titulo: true,
                  etiquetas: {
                    select: {
                      etiqueta: {
                        select: {
                          nombre: true,
                        },
                      },
                    },
                  },
                },
              });
              if (tarea) {
                taskTitle = tarea.titulo;
                const nombresEtiquetas = tarea.etiquetas.map(te => te.etiqueta.nombre);
                if (nombresEtiquetas.length > 0) {
                  to = nombresEtiquetas.join(', ');
                }
              }
            } catch (error) {
              // Si la tarea ya fue eliminada o hay un error, continuar sin las etiquetas
              console.error('Error al obtener etiquetas de tarea:', error);
            }
          }
        }
      }

      return {
        ...actividad,
        backlogAction,
        from,
        to,
        taskTitle,
      };
    })
  );

  // Filtrar actividades nulas (las que no tienen acción válida para el backlog)
  return actividadesProcesadas.filter((act): act is ActividadProcesada => act !== null);
};

