/**
 * Utilidades específicas para operaciones con tareas: agrupación por estado, filtros y construcción de actividades.
 * Funciones auxiliares para transformar y procesar datos de tareas en el sistema Kanban.
 */
import { ESTADOS_TAREA_ARRAY, ESTADOS_TAREA, ACCIONES_AUDITORIA, ENTIDADES } from './constants';
import { Prisma } from '@prisma/client';
import { ActividadInput } from './actividad-helpers';
import { prisma } from './prisma';
import { verificarProyectoExiste, verificarUsuarioExiste } from './prisma-helpers';
import { buildIdFilter } from './crud-helpers';

/**
 * Mapea estados del backend a IDs de columna del frontend
 */
export const mapearEstadoAColumnaId = (estado: string): string => {
  const estadoMap: Record<string, string> = {
    [ESTADOS_TAREA.PENDIENTE]: 'pending',
    [ESTADOS_TAREA.EN_PROGRESO]: 'in-progress',
    [ESTADOS_TAREA.EN_REVISION]: 'review',
    [ESTADOS_TAREA.COMPLETADO]: 'done',
  };
  return estadoMap[estado] || estado.toLowerCase().replace('_', '-');
};

/**
 * Mapea IDs de columna del frontend a estados del backend
 */
export const mapearColumnaIdAEstado = (columnId: string): string => {
  const columnMap: Record<string, string> = {
    'pending': ESTADOS_TAREA.PENDIENTE,
    'in-progress': ESTADOS_TAREA.EN_PROGRESO,
    'review': ESTADOS_TAREA.EN_REVISION,
    'done': ESTADOS_TAREA.COMPLETADO,
  };
  return columnMap[columnId] || columnId;
};

export const agruparTareasPorEstado = <T extends { estado: string }>(
  tareas: T[]
): Record<string, T[]> => {
  return ESTADOS_TAREA_ARRAY.reduce((acc, estado) => {
    acc[estado] = tareas.filter(t => t.estado === estado);
    return acc;
  }, {} as Record<string, T[]>);
};

/**
 * Agrupa tareas por estado y devuelve con IDs de columna del frontend
 */
export const agruparTareasPorColumna = <T extends { estado: string }>(
  tareas: T[]
): Record<string, T[]> => {
  const tareasPorEstado = agruparTareasPorEstado(tareas);
  const resultado: Record<string, T[]> = {};
  
  for (const [estado, tareasEstado] of Object.entries(tareasPorEstado)) {
    const columnId = mapearEstadoAColumnaId(estado);
    resultado[columnId] = tareasEstado;
  }
  
  // Asegurar que todas las columnas existan (incluso si están vacías)
  ['pending', 'in-progress', 'review', 'done'].forEach(columnId => {
    if (!resultado[columnId]) {
      resultado[columnId] = [];
    }
  });
  
  return resultado;
};


export const calcularConteosPorEstado = (
  tareasPorEstado: Record<string, any[]>
) => {
  return {
    [ESTADOS_TAREA.PENDIENTE]: tareasPorEstado[ESTADOS_TAREA.PENDIENTE]?.length || 0,
    [ESTADOS_TAREA.EN_PROGRESO]: tareasPorEstado[ESTADOS_TAREA.EN_PROGRESO]?.length || 0,
    [ESTADOS_TAREA.EN_REVISION]: tareasPorEstado[ESTADOS_TAREA.EN_REVISION]?.length || 0,
    [ESTADOS_TAREA.COMPLETADO]: tareasPorEstado[ESTADOS_TAREA.COMPLETADO]?.length || 0,
  };
};


export const construirFiltrosTarea = (query: {
  estado?: string | string[];
  prioridad?: string | string[];
  proyecto?: string | string[];
  responsable?: string | string[];
  usuarioId?: number | null;
}): Prisma.TareaWhereInput => {
  const filtros: Prisma.TareaWhereInput = {
    // Excluir tareas placeholder que se crearon para mantener usuarios como miembros del proyecto
    NOT: [
      {
        titulo: {
          contains: 'Miembro del proyecto',
        },
      },
      {
        titulo: {
          contains: 'Bienvenido al proyecto',
        },
      },
      {
        descripcion: {
          contains: 'Tarea para mantener al usuario como miembro del proyecto',
        },
      },
      {
        descripcion: {
          contains: 'Tarea de bienvenida para agregar al usuario al proyecto',
        },
      },
    ],
  };

  if (query.usuarioId !== undefined) {
    if (query.usuarioId === null) {
      // Filtrar tareas sin asignar
      filtros.usuarioId = null;
    } else {
      filtros.usuarioId = query.usuarioId;
    }
  }

  if (query.estado && typeof query.estado === 'string') {
    filtros.estado = query.estado as any;
  }

  if (query.prioridad && typeof query.prioridad === 'string') {
    filtros.prioridad = query.prioridad;
  }

  const proyectoId = buildIdFilter(
    typeof query.proyecto === 'string' 
      ? query.proyecto 
      : Array.isArray(query.proyecto)
      ? query.proyecto[0]
      : query.proyecto
  );
  if (proyectoId) {
    filtros.proyectoId = proyectoId;
  }

  const responsableId = buildIdFilter(
    typeof query.responsable === 'string'
      ? query.responsable
      : Array.isArray(query.responsable)
      ? query.responsable[0]
      : query.responsable
  );
  if (responsableId) {
    filtros.usuarioId = responsableId;
  }

  return filtros;
};

/**
 * Obtiene el nombre completo de un usuario por su ID
 */
export const obtenerNombreUsuario = async (usuarioId: number): Promise<string | null> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { nombreCompleto: true },
  });
  return usuario?.nombreCompleto || null;
};

/**
 * Obtiene el ID de un usuario por su nombre completo dentro de un proyecto
 * Solo permite asignar a usuarios que son miembros del proyecto (creador, gestor, miembros explícitos, o con tareas asignadas)
 */
export const obtenerUsuarioIdPorNombre = async (
  nombreCompleto: string,
  proyectoId: number
): Promise<number | null> => {
  if (nombreCompleto === 'Sin asignar' || !nombreCompleto.trim()) {
    return null;
  }

  const usuario = await prisma.usuario.findFirst({
    where: {
      nombreCompleto: nombreCompleto,
    },
    select: {
      id: true,
    },
  });

  if (!usuario) {
    return null;
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: {
      creadoPorId: true,
      gestorId: true,
    },
  });

  if (!proyecto) {
    return null;
  }

  // Verificar si es creador o gestor del proyecto
  if (usuario.id === proyecto.creadoPorId || usuario.id === proyecto.gestorId) {
    return usuario.id;
  }

  // Verificar si es miembro explícito del proyecto (tabla proyecto_miembros)
  const esMiembroExplicito = await prisma.proyectoMiembro.findUnique({
    where: {
      proyectoId_usuarioId: {
        proyectoId: proyectoId,
        usuarioId: usuario.id,
      },
    },
    select: {
      usuarioId: true,
    },
  });

  if (esMiembroExplicito) {
    return usuario.id;
  }

  // Verificar si tiene tareas reales asignadas (excluyendo placeholders)
  const tieneTareas = await prisma.tarea.findFirst({
    where: {
      proyectoId: proyectoId,
      usuarioId: usuario.id,
      NOT: [
        {
          titulo: {
            contains: 'Miembro del proyecto',
          },
        },
        {
          titulo: {
            contains: 'Bienvenido al proyecto',
          },
        },
        {
          descripcion: {
            contains: 'Tarea para mantener al usuario como miembro del proyecto',
          },
        },
        {
          descripcion: {
            contains: 'Tarea de bienvenida para agregar al usuario al proyecto',
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (tieneTareas) {
    return usuario.id;
  }

  return null;
};

/**
 * Valida que proyecto y usuario existen (si se proporcionan)
 */
export const validarProyectoYUsuario = async (
  proyectoId?: number,
  usuarioId?: number | null
): Promise<{ proyectoValido: boolean; usuarioValido: boolean }> => {
  const [proyectoValido, usuarioValido] = await Promise.all([
    proyectoId ? verificarProyectoExiste(proyectoId) : Promise.resolve(true),
    usuarioId ? verificarUsuarioExiste(usuarioId) : Promise.resolve(true),
  ]);

  return { proyectoValido, usuarioValido };
};

/**
 * Prepara los datos de actualización de una tarea, manejando la asignación automáticamente
 * Puede recibir usuarioId o asignado_a. Si viene asignado_a, busca el usuarioId correspondiente.
 */
export const prepararDatosActualizacionTarea = async (
  datosActualizacion: any,
  tareaAnterior: { usuarioId: number | null; asignado_a: string; proyectoId: number }
): Promise<any> => {
  const datos = { ...datosActualizacion };

  // Si viene asignado_a (nuevo enfoque: frontend envía el nombre)
  if ('asignado_a' in datos && datos.asignado_a !== undefined) {
    const asignadoCambio = datos.asignado_a !== tareaAnterior.asignado_a;
    
    if (asignadoCambio) {
      if (datos.asignado_a === 'Sin asignar' || !datos.asignado_a.trim()) {
        datos.usuarioId = null;
        datos.asignado_a = 'Sin asignar';
      } else {
        const usuarioId = await obtenerUsuarioIdPorNombre(
          datos.asignado_a,
          tareaAnterior.proyectoId
        );
        
        if (usuarioId !== null) {
          datos.usuarioId = usuarioId;
          const nombreCompleto = await obtenerNombreUsuario(usuarioId);
          if (nombreCompleto) {
            datos.asignado_a = nombreCompleto;
          }
        } else {
          throw new Error(`No se encontró el usuario "${datos.asignado_a}" en el proyecto`);
        }
      }
    } else {
      delete datos.usuarioId;
      delete datos.asignado_a;
    }
  }
  else if ('usuarioId' in datos) {
    const usuarioIdCambio = datos.usuarioId !== tareaAnterior.usuarioId;
    
    if (usuarioIdCambio) {
      if (datos.usuarioId === null || datos.usuarioId === undefined) {
        datos.usuarioId = null;
        datos.asignado_a = 'Sin asignar';
      } else {
        const nombreUsuario = await obtenerNombreUsuario(datos.usuarioId);
        if (nombreUsuario) {
          datos.asignado_a = nombreUsuario;
        }
      }
    } else {
      delete datos.asignado_a;
    }
  }

  return datos;
};

/**
 * Crea la actividad de registro para asignación/desasignación de tarea
 */
export const crearActividadAsignacion = (
  tareaId: number,
  tituloTarea: string,
  usuarioId: number,
  valorAnterior: number | null,
  valorNuevo: number | null,
  esAutoasignacion: boolean = false
): ActividadInput => {
  return {
    accion: ACCIONES_AUDITORIA.ACTUALIZAR,
    entidad: ENTIDADES.TAREA,
    entidadId: tareaId,
    campo: 'usuarioId',
    valorAnterior: valorAnterior !== null ? String(valorAnterior) : 'null',
    valorNuevo: valorNuevo !== null ? String(valorNuevo) : 'null',
    usuarioId,
    descripcion: esAutoasignacion
      ? `Tarea "${tituloTarea}" autoasignada`
      : valorNuevo === null
      ? `Tarea "${tituloTarea}" desasignada`
      : `Tarea "${tituloTarea}" asignada`,
  };
};

/**
 * Verifica si una operación es solo autoasignación
 */
export const esSoloAutoasignacion = (
  datosActualizacion: any,
  userId: number,
  puedeAutoasignarse: (userId: number, targetUserId: number) => boolean
): boolean => {
  return (
    datosActualizacion.usuarioId !== undefined &&
    datosActualizacion.usuarioId !== null &&
    typeof datosActualizacion.usuarioId === 'number' &&
    Object.keys(datosActualizacion).length === 1 &&
    puedeAutoasignarse(userId, datosActualizacion.usuarioId)
  );
};

