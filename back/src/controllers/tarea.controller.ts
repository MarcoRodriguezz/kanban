/**
 * Controlador principal para CRUD de tareas: crear, obtener, actualizar, eliminar y buscar.
 * Maneja permisos de edición y registro de actividades para auditoría.
 */
import { Request, Response } from 'express';
import { CrearTareaInput, ActualizarTareaInput } from '../validations/tarea.validation';
import { tareaInclude, tareaIncludeCompleto } from '../utils/prisma-helpers';
import { sendNotFoundError } from '../utils/error-handler';
import { validateAndParseId } from '../utils/crud-helpers';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, registrarActividades } from '../utils/actividad-helpers';
import {
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import { asyncHandler, requireAuthHandler, requireResource, sendSuccess, sendCreated, sendUpdated, sendDeleted } from '../utils/controller-helpers';
import { ESTADOS_TAREA, ENTIDADES, ACCIONES_AUDITORIA } from '../utils/constants';
import { puedeEditarTarea, verificarPermisosTarea } from '../utils/permission-helpers';
import {
  validarProyectoYUsuario,
  prepararDatosActualizacionTarea,
  obtenerNombreUsuario,
} from '../utils/tarea-helpers';
import { detectChanges, filterUndefined } from '../utils/crud-helpers';
import { crearNotificacionAsignacionTarea, crearNotificacionActualizacionTarea } from '../utils/notificacion-helpers';


export const obtenerTareaPorId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const tareaId = validateAndParseId(req, res, 'id', 'Tarea');
  if (!tareaId) return;

  const tarea = await requireResource(
    () => prisma.tarea.findUnique({
      where: { id: tareaId },
      include: tareaIncludeCompleto,
    }),
    res,
    'Tarea'
  );
  if (!tarea) return;

  sendSuccess(res, { tarea });
});

export const verificarPermisosEdicion = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const tareaId = validateAndParseId(req, res, 'id', 'Tarea');
  if (!tareaId) return;

  const resultado = await verificarPermisosTarea(userId, tareaId);
  if (!resultado) {
    sendNotFoundError(res, 'Tarea');
    return;
  }

  const { permisos } = resultado;
  const puedeEditar = permisos.esAdmin || permisos.esCreador || permisos.esGestor;
  
  sendSuccess(res, { puedeEditar });
});


export const crearTarea = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const datos: CrearTareaInput = req.body;
  const userId = requireAuthenticatedUser(req, res)!;
    const { proyectoValido, usuarioValido } = await validarProyectoYUsuario(
      datos.proyectoId,
      datos.usuarioId
    );
    if (!proyectoValido) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }
    if (datos.usuarioId && !usuarioValido) {
      sendNotFoundError(res, 'Usuario');
      return;
    }
    const usuarioIdFinal = datos.usuarioId ?? null;
    
    let asignadoAFinal = 'Sin asignar';
    if (usuarioIdFinal) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioIdFinal },
        select: { nombreCompleto: true },
      });
      asignadoAFinal = usuario?.nombreCompleto || 'Usuario';
    }
    
    const tarea = await prisma.tarea.create({
      data: {
        titulo: datos.titulo,
        descripcion: datos.descripcion ?? null,
        estado: datos.estado ?? ESTADOS_TAREA.PENDIENTE,
        prioridad: datos.prioridad,
        asignado_a: asignadoAFinal,
        proyectoId: datos.proyectoId,
        usuarioId: usuarioIdFinal,
        creadoPorId: userId,
        fecha_limite: datos.fecha_limite ?? null,
      },
      include: tareaInclude,
    });
    registrarActividadSimple('crear', ENTIDADES.TAREA, tarea.id, userId, 
      `Tarea "${tarea.titulo}" creada`);
    
    // Enviar notificación si la tarea fue asignada a un usuario (solo si no es autoasignación)
    // No enviar notificación si el usuario se asigna la tarea a sí mismo
    const usuarioIdFinalNum = usuarioIdFinal ? Number(usuarioIdFinal) : null;
    const userIdCreacionNum = Number(userId);
    const esAutoasignacionCreacion = usuarioIdFinalNum !== null && usuarioIdFinalNum === userIdCreacionNum;
    
    if (usuarioIdFinalNum && !esAutoasignacionCreacion) {
      const nombreAsignador = await obtenerNombreUsuario(userId);
      crearNotificacionAsignacionTarea(
        usuarioIdFinalNum,
        tarea.id,
        tarea.titulo,
        datos.proyectoId,
        nombreAsignador || undefined
      ).catch(error => {
        // Log error pero no fallar la operación
        console.error('Error al crear notificación de asignación:', error);
      });
    }
    
    sendCreated(res, { tarea }, 'Tarea creada exitosamente');
});



export const actualizarTarea = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const tareaId = validateAndParseId(req, res, 'id', 'Tarea');
  if (!tareaId) return;
  const datos: ActualizarTareaInput = req.body;
  const tareaAnterior = await prisma.tarea.findUnique({
    where: { id: tareaId },
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      descripcion: true,
      proyectoId: true,
      usuarioId: true,
      fecha_limite: true,
      asignado_a: true,
    },
  });
  if (!tareaAnterior) {
    sendNotFoundError(res, 'Tarea');
    return;
  }

  const tienePermisos = await puedeEditarTarea(userId, tareaId);
  if (!tienePermisos) {
    res.status(403).json({
      error: 'No tienes permisos para editar esta tarea. Solo el creador, administrador o gestor del proyecto pueden editar tareas.',
    });
    return;
  }
  const datosActualizacion = filterUndefined(datos);
  const { proyectoValido, usuarioValido } = await validarProyectoYUsuario(
    datosActualizacion.proyectoId,
    datosActualizacion.usuarioId
  );
  if (!proyectoValido) {
    sendNotFoundError(res, 'Proyecto');
    return;
  }
  if (datosActualizacion.usuarioId && !usuarioValido) {
    sendNotFoundError(res, 'Usuario');
    return;
  }
  const datosPreparados = await prepararDatosActualizacionTarea(
    datosActualizacion,
    {
      usuarioId: tareaAnterior.usuarioId,
      asignado_a: tareaAnterior.asignado_a,
      proyectoId: tareaAnterior.proyectoId,
    }
  );
  
  const hayCambioAsignacion = 
    ('usuarioId' in datosActualizacion && datosActualizacion.usuarioId !== tareaAnterior.usuarioId) ||
    ('asignado_a' in datosActualizacion && datosActualizacion.asignado_a !== tareaAnterior.asignado_a);
  
  if (hayCambioAsignacion) {
    delete datosPreparados.estado;
  }
  
  const tarea = await prisma.tarea.update({
    where: { id: tareaId },
    data: datosPreparados,
    include: tareaInclude,
  });
  
  // Crear un objeto de comparación solo con los campos que realmente fueron enviados en la solicitud
  // y que están presentes en datosPreparados (si fueron eliminados, significa que no cambiaron)
  // Esto evita que aparezcan cambios en campos que no se modificaron
  const datosParaComparar: any = {};
  
  // Solo incluir campos que están tanto en datosActualizacion como en datosPreparados
  // Si un campo fue eliminado de datosPreparados por prepararDatosActualizacionTarea,
  // significa que no cambió y no debe incluirse en la comparación
  
  // Campos simples: solo incluir si están en ambos objetos
  if ('titulo' in datosActualizacion && 'titulo' in datosPreparados) {
    datosParaComparar.titulo = datosPreparados.titulo;
  }
  if ('descripcion' in datosActualizacion && 'descripcion' in datosPreparados) {
    datosParaComparar.descripcion = datosPreparados.descripcion;
  }
  if ('estado' in datosActualizacion && 'estado' in datosPreparados) {
    datosParaComparar.estado = datosPreparados.estado;
  }
  if ('prioridad' in datosActualizacion && 'prioridad' in datosPreparados) {
    datosParaComparar.prioridad = datosPreparados.prioridad;
  }
  if (('fecha_limite' in datosActualizacion || 'dueDate' in datosActualizacion) && 'fecha_limite' in datosPreparados) {
    datosParaComparar.fecha_limite = datosPreparados.fecha_limite;
  }
  if ('proyectoId' in datosActualizacion && 'proyectoId' in datosPreparados) {
    datosParaComparar.proyectoId = datosPreparados.proyectoId;
  }
  
  // Manejar asignación: si se envió asignado_a o usuarioId y están en datosPreparados, comparar usuarioId
  if (('asignado_a' in datosActualizacion || 'usuarioId' in datosActualizacion) && 'usuarioId' in datosPreparados) {
    datosParaComparar.usuarioId = datosPreparados.usuarioId;
  }
  
  const cambiosDetectados = detectChanges(tareaAnterior, datosParaComparar);
  if (cambiosDetectados.length > 0) {
    const cambioAsignacion = cambiosDetectados.find(c => c.campo === 'usuarioId');
    const nuevoUsuarioId = cambioAsignacion && cambioAsignacion.valorNuevo 
      ? Number(cambioAsignacion.valorNuevo) 
      : null;
    const usuarioAnteriorId = cambioAsignacion && cambioAsignacion.valorAnterior
      ? Number(cambioAsignacion.valorAnterior)
      : null;
    
    const actividadesProcesadas = await Promise.all(
      cambiosDetectados.map(async (cambio) => {
        if (cambio.campo === 'usuarioId') {
          const nombreAnterior = cambio.valorAnterior 
            ? await obtenerNombreUsuario(Number(cambio.valorAnterior)) || cambio.valorAnterior
            : 'Sin asignar';
          const nombreNuevo = cambio.valorNuevo 
            ? await obtenerNombreUsuario(Number(cambio.valorNuevo)) || cambio.valorNuevo
            : 'Sin asignar';
          
          return {
            ...cambio,
            valorAnterior: nombreAnterior,
            valorNuevo: nombreNuevo,
          };
        }
        return cambio;
      })
    );
    
    const actividades = actividadesProcesadas.map(cambio => {
      let descripcion = `Campo "${cambio.campo}" actualizado en tarea "${tarea.titulo}"`;
      
      if (cambio.campo === 'usuarioId') {
        if (!cambio.valorAnterior || cambio.valorAnterior === 'Sin asignar') {
          descripcion = `Tarea "${tarea.titulo}" asignada a ${cambio.valorNuevo}`;
        } else if (!cambio.valorNuevo || cambio.valorNuevo === 'Sin asignar') {
          descripcion = `Tarea "${tarea.titulo}" desasignada de ${cambio.valorAnterior}`;
        } else {
          descripcion = `Tarea "${tarea.titulo}" reasignada de ${cambio.valorAnterior} a ${cambio.valorNuevo}`;
        }
      }
      
      return {
        accion: cambio.campo === 'estado' 
          ? ACCIONES_AUDITORIA.CAMBIAR_ESTADO 
          : ACCIONES_AUDITORIA.ACTUALIZAR,
        entidad: ENTIDADES.TAREA,
        entidadId: tareaId,
        campo: cambio.campo,
        valorAnterior: String(cambio.valorAnterior ?? ''),
        valorNuevo: String(cambio.valorNuevo ?? ''),
        usuarioId: userId,
        descripcion,
      };
    });
    registrarActividades(actividades);
    
    // Enviar notificación solo si hay cambio de asignación y no es autoasignación
    // No enviar notificación si el usuario se asigna a sí mismo o cambia la asignación a sí mismo
    const nuevoUsuarioIdNum = nuevoUsuarioId ? Number(nuevoUsuarioId) : null;
    const userIdNum = Number(userId);
    const esAutoasignacion = nuevoUsuarioIdNum !== null && nuevoUsuarioIdNum === userIdNum;
    
    if (cambioAsignacion && nuevoUsuarioIdNum && nuevoUsuarioIdNum !== usuarioAnteriorId && !esAutoasignacion) {
      const nombreAsignador = await obtenerNombreUsuario(userId);
      crearNotificacionAsignacionTarea(
        nuevoUsuarioIdNum,
        tareaId,
        tarea.titulo,
        tarea.proyectoId,
        nombreAsignador || undefined
      ).catch(error => {
        console.error('Error al crear notificación de asignación:', error);
      });
    }
    
    const cambioEstado = cambiosDetectados.find(c => c.campo === 'estado');
    const hayCambioEstado = cambioEstado || (tareaAnterior.estado !== tarea.estado);
    
    if (hayCambioEstado && tareaAnterior.usuarioId && tareaAnterior.usuarioId !== userId) {
      const estadoAnterior = String(tareaAnterior.estado ?? '');
      const estadoNuevo = String(tarea.estado ?? '');
      
      if (estadoAnterior !== estadoNuevo) {
        const nombreActualizador = await obtenerNombreUsuario(userId);
        const cambioDescripcion = nombreActualizador
          ? `${nombreActualizador} cambió el estado de "${estadoAnterior}" a "${estadoNuevo}"`
          : `El estado cambió de "${estadoAnterior}" a "${estadoNuevo}"`;
        
        crearNotificacionActualizacionTarea(
          tareaAnterior.usuarioId,
          tareaId,
          tarea.titulo,
          tarea.proyectoId,
          cambioDescripcion
        ).catch(error => {
          console.error('Error al crear notificación de actualización de estado:', error);
        });
      }
    }
  }
  sendUpdated(res, { tarea }, 'Tarea actualizada exitosamente');
});



export const eliminarTarea = requireAuthHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireAuthenticatedUser(req, res)!;
  const tareaId = validateAndParseId(req, res, 'id', 'Tarea');
  if (!tareaId) return;
    
    // Obtener información de la tarea primero para verificar permisos
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      select: {
        id: true,
        titulo: true,
        proyectoId: true,
        creadoPorId: true,
        proyecto: {
          select: {
            gestorId: true,
          },
        },
      },
    });

    if (!tarea) {
      sendNotFoundError(res, 'Tarea');
      return;
    }

    const tienePermisos = await puedeEditarTarea(userId, tareaId);
    if (!tienePermisos) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: userId },
        select: { rol: true },
      });
      
      res.status(403).json({
        error: 'No tienes permisos para eliminar esta tarea. Solo el creador, administrador o gestor del proyecto pueden eliminar tareas.',
        detalles: {
          usuarioId: userId,
          tareaId,
          proyectoId: tarea.proyectoId,
          gestorProyecto: tarea.proyecto.gestorId,
          creadorTarea: tarea.creadoPorId,
          rolUsuario: usuario?.rol,
        },
      });
      return;
    }
    registrarActividadSimple('eliminar', ENTIDADES.TAREA, tareaId, userId, 
      `Tarea "${tarea.titulo}" eliminada`);
    
    await prisma.tarea.delete({ where: { id: tareaId } });

    sendDeleted(res, 'Tarea eliminada exitosamente');
});
