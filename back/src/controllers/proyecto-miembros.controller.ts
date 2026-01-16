/**
 * Controlador para gestión de miembros del proyecto: obtener, agregar y remover miembros.
 * Los miembros incluyen: creador, gestor y usuarios con tareas asignadas en el proyecto.
 * Nota: Los miembros no requieren tareas para ser miembros del proyecto.
 */
import { Request, Response } from 'express';
import { handleError, sendNotFoundError } from '../utils/error-handler';
import { validateAndParseId } from '../utils/crud-helpers';
import { prisma } from '../utils/prisma';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { verificarPermisosProyecto } from '../utils/permission-helpers';
import { ROLES } from '../utils/constants';
import {
  obtenerProyectoBasico,
  eliminarTareasPlaceholder,
  desasignarTareasUsuario,
  actualizarGestorProyecto,
  obtenerNombreUsuario,
  calcularTiempoRelativo,
  generarIniciales,
  determinarRolEnProyecto,
  obtenerIdsMiembros,
  obtenerUltimaActividadPorUsuario,
  validarYParsearUsuarioId,
  validarUsuarioExiste,
  transferirGestorACreador,
  registrarCambioGestor,
  agregarMiembroExplicito,
  removerMiembroExplicito,
} from '../utils/proyecto-miembros-helpers';

/**
 * Obtiene todos los miembros de un proyecto
 */
export const obtenerMiembrosProyecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
    if (!proyectoId) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const proyecto = await obtenerProyectoBasico(proyectoId);
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const miembrosIds = await obtenerIdsMiembros(proyectoId);
    const ultimaActividadPorUsuario = await obtenerUltimaActividadPorUsuario(proyectoId, miembrosIds);

    const miembros = await prisma.usuario.findMany({
      where: { id: { in: Array.from(miembrosIds) } },
      select: {
        id: true,
        nombreCompleto: true,
        email: true,
        rol: true,
        updatedAt: true,
        fotoPerfil: true,
      },
    });

    const miembrosFormateados = miembros.map((miembro) => {
      const esCreador = miembro.id === proyecto.creadoPorId;
      const esGestor = miembro.id === proyecto.gestorId;
      const rolEnProyecto = determinarRolEnProyecto(miembro.rol, esCreador, esGestor);
      const ultimaActividad = ultimaActividadPorUsuario.get(miembro.id);
      const lastActivity = ultimaActividad ? calcularTiempoRelativo(ultimaActividad) : 'Nunca';

      return {
        id: miembro.id.toString(),
        name: miembro.nombreCompleto,
        email: miembro.email,
        initials: generarIniciales(miembro.nombreCompleto),
        role: rolEnProyecto,
        lastActivity,
        esCreador,
        esGestor,
        fotoPerfil: miembro.fotoPerfil,
      };
    });

    res.json({
      miembros: miembrosFormateados,
      proyecto: {
        id: proyecto.id,
        nombre: proyecto.nombre,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al obtener los miembros del proyecto');
  }
};


export const agregarMiembroProyecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
    if (!proyectoId) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const permisos = await verificarPermisosProyecto(userId, proyectoId);
    if (!permisos) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    if (!permisos.permisos.esAdmin && !permisos.permisos.esGestor && !permisos.permisos.esCreador) {
      res.status(403).json({
        error: 'No tienes permisos para agregar miembros a este proyecto',
      });
      return;
    }

    const { usuarioId, rol } = req.body;
    const usuarioIdNum = validarYParsearUsuarioId(res, usuarioId);
    if (!usuarioIdNum) return;

    if (!(await validarUsuarioExiste(res, usuarioIdNum))) return;

    const proyecto = await obtenerProyectoBasico(proyectoId);
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const nombreAñadidoPor = await obtenerNombreUsuario(userId);
    const { crearNotificacionAñadidoAProyecto } = await import('../utils/notificacion-helpers');

    if (rol === 'project-manager' || rol === 'administrator') {
      const nuevoGestorNombre = await obtenerNombreUsuario(usuarioIdNum);
      await actualizarGestorProyecto(proyectoId, usuarioIdNum, nuevoGestorNombre || undefined);

      // También agregar como miembro explícito (aunque ya aparecerá como gestor)
      await agregarMiembroExplicito(proyectoId, usuarioIdNum);

      await crearNotificacionAñadidoAProyecto(
        usuarioIdNum,
        proyectoId,
        proyecto.nombre,
        nombreAñadidoPor || undefined
      );

      res.json({
        message: 'Miembro agregado al proyecto como gestor',
        miembro: { id: usuarioIdNum.toString() },
      });
      return;
    }

    // Agregar como miembro explícito del proyecto en la tabla proyecto_miembros
    // Esto asegura que el usuario aparezca en la lista de miembros
    await agregarMiembroExplicito(proyectoId, usuarioIdNum);

    await crearNotificacionAñadidoAProyecto(
      usuarioIdNum,
      proyectoId,
      proyecto.nombre,
      nombreAñadidoPor || undefined
    );

    res.status(201).json({
      message: 'Miembro agregado al proyecto exitosamente',
      miembro: { id: usuarioIdNum.toString() },
    });
  } catch (error) {
    handleError(res, error, 'Error al agregar miembro al proyecto');
  }
};

/**
 * Remueve un miembro del proyecto
 * Desasigna todas sus tareas o cambia el gestor si es necesario
 */
export const removerMiembroProyecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
    if (!proyectoId) return;

    const usuarioIdNum = validarYParsearUsuarioId(res, req.params.usuarioId);
    if (!usuarioIdNum) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const permisos = await verificarPermisosProyecto(userId, proyectoId);
    if (!permisos) {
      res.status(404).json({ error: 'Proyecto no encontrado' });
      return;
    }

    if (!permisos.permisos.esAdmin && !permisos.permisos.esGestor) {
      res.status(403).json({
        error: 'No tienes permisos para remover miembros de este proyecto',
      });
      return;
    }

    const proyecto = await obtenerProyectoBasico(proyectoId);
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const usuarioARemover = await prisma.usuario.findUnique({
      where: { id: usuarioIdNum },
      select: { id: true, rol: true, nombreCompleto: true },
    });

    if (!usuarioARemover) {
      sendNotFoundError(res, 'Usuario');
      return;
    }

    if (usuarioARemover.rol === ROLES.ADMINISTRADOR && !permisos.permisos.esAdmin) {
      res.status(403).json({
        error: 'No se pueden remover administradores del proyecto. Solo los administradores pueden hacerlo.',
      });
      return;
    }

    if (proyecto.creadoPorId === usuarioIdNum) {
      res.status(400).json({
        error: 'No se puede remover al creador del proyecto',
      });
      return;
    }

    if (proyecto.gestorId === usuarioIdNum) {
      await transferirGestorACreador(proyectoId, proyecto.creadoPorId);
    }

    // Remover de miembros explícitos
    await removerMiembroExplicito(proyectoId, usuarioIdNum);
    
    // Limpiar tareas placeholder si existen (para compatibilidad con datos antiguos)
    await eliminarTareasPlaceholder(proyectoId, usuarioIdNum);
    await desasignarTareasUsuario(proyectoId, usuarioIdNum);

    res.json({
      message: 'Miembro removido del proyecto exitosamente',
    });
  } catch (error) {
    handleError(res, error, 'Error al remover miembro del proyecto');
  }
};

/**
 * Permite que un usuario salga del proyecto por sí mismo
 * Desasigna todas sus tareas y lo remueve como miembro
 * Si es el gestor y no es el creador, transfiere la gestión al creador
 */
export const salirDelProyecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
    if (!proyectoId) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const proyecto = await obtenerProyectoBasico(proyectoId);
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    if (proyecto.gestorId === userId && proyecto.creadoPorId !== userId) {
      await transferirGestorACreador(proyectoId, proyecto.creadoPorId);
    }

    // Remover de miembros explícitos
    await removerMiembroExplicito(proyectoId, userId);
    
    // Limpiar tareas placeholder si existen (para compatibilidad con datos antiguos)
    await eliminarTareasPlaceholder(proyectoId, userId);
    await desasignarTareasUsuario(proyectoId, userId);

    res.json({
      message: 'Has salido del proyecto exitosamente',
    });
  } catch (error) {
    handleError(res, error, 'Error al salir del proyecto');
  }
};

/**
 * Cambia el rol de un miembro en el proyecto
 * Nota: Los roles son globales del usuario, pero podemos cambiar si es gestor del proyecto
 * Si se relega al gestor actual a empleado, se puede especificar un nuevo gestor
 */
export const cambiarRolMiembro = async (req: Request, res: Response): Promise<void> => {
  try {
    const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
    if (!proyectoId) return;

    const usuarioIdNum = validarYParsearUsuarioId(res, req.params.usuarioId);
    if (!usuarioIdNum) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });

    if (!usuario || usuario.rol !== ROLES.ADMINISTRADOR) {
      res.status(403).json({
        error: 'Solo los administradores pueden cambiar roles en el proyecto',
      });
      return;
    }

    const proyecto = await obtenerProyectoBasico(proyectoId);
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const { rol, nuevoGestorId } = req.body;
    if (!rol || !['administrator', 'project-manager', 'employee'].includes(rol)) {
      res.status(400).json({
        error: 'Rol inválido. Debe ser: administrator, project-manager o employee',
      });
      return;
    }

    if (!(await validarUsuarioExiste(res, usuarioIdNum))) return;

    // Asegurar que el usuario siempre permanezca como miembro explícito del proyecto
    // independientemente del cambio de rol
    await agregarMiembroExplicito(proyectoId, usuarioIdNum);

    if (rol === 'project-manager' || rol === 'administrator') {
      const gestorAnteriorId = proyecto.gestorId;
      const nuevoGestorNombre = await obtenerNombreUsuario(usuarioIdNum);
      await actualizarGestorProyecto(proyectoId, usuarioIdNum, nuevoGestorNombre || undefined);

      if (gestorAnteriorId !== usuarioIdNum) {
        await registrarCambioGestor(proyectoId, userId, gestorAnteriorId, usuarioIdNum);
      }
    } else if (rol === 'employee' && proyecto.gestorId === usuarioIdNum) {
      let nuevoGestorIdFinal: number;
      let nuevoGestorNombre: string;

      if (nuevoGestorId) {
        const nuevoGestorIdNum = validarYParsearUsuarioId(res, nuevoGestorId);
        if (!nuevoGestorIdNum) return;
        if (!(await validarUsuarioExiste(res, nuevoGestorIdNum))) return;
        nuevoGestorIdFinal = nuevoGestorIdNum;
        nuevoGestorNombre = (await obtenerNombreUsuario(nuevoGestorIdFinal)) || 'Sin responsable';
      } else {
        // Si no se especifica nuevo gestor, usar el creador como fallback
        // (no es crítico que no haya gestor específico, pero el esquema requiere uno)
        nuevoGestorIdFinal = proyecto.creadoPorId;
        nuevoGestorNombre = (await obtenerNombreUsuario(proyecto.creadoPorId)) || 'Sin responsable';
      }

      await actualizarGestorProyecto(proyectoId, nuevoGestorIdFinal, nuevoGestorNombre);
      await registrarCambioGestor(proyectoId, userId, usuarioIdNum, nuevoGestorIdFinal);
    }

    res.json({
      message: 'Rol del miembro actualizado exitosamente',
      miembro: { id: usuarioIdNum.toString(), rol },
    });
  } catch (error) {
    handleError(res, error, 'Error al cambiar el rol del miembro');
  }
};

/**
 * Cambia el gestor del proyecto directamente
 * Solo los administradores pueden usar este endpoint
 */
export const cambiarGestorProyecto = async (req: Request, res: Response): Promise<void> => {
  try {
    const proyectoId = validateAndParseId(req, res, 'id', 'Proyecto');
    if (!proyectoId) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });

    if (!usuario || usuario.rol !== ROLES.ADMINISTRADOR) {
      res.status(403).json({
        error: 'Solo los administradores pueden cambiar el gestor del proyecto',
      });
      return;
    }

    const proyecto = await obtenerProyectoBasico(proyectoId);
    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const nuevoGestorIdNum = validarYParsearUsuarioId(res, req.body.nuevoGestorId);
    if (!nuevoGestorIdNum) return;

    if (!(await validarUsuarioExiste(res, nuevoGestorIdNum))) return;

    if (proyecto.gestorId === nuevoGestorIdNum) {
      res.json({
        message: 'El usuario ya es el gestor del proyecto',
        proyecto: { id: proyecto.id, gestorId: proyecto.gestorId },
      });
      return;
    }

    const nuevoGestorNombre = await obtenerNombreUsuario(nuevoGestorIdNum);
    await actualizarGestorProyecto(proyectoId, nuevoGestorIdNum, nuevoGestorNombre || undefined);
    await registrarCambioGestor(proyectoId, userId, proyecto.gestorId, nuevoGestorIdNum);

    res.json({
      message: 'Gestor del proyecto actualizado exitosamente',
      proyecto: {
        id: proyecto.id,
        gestorId: nuevoGestorIdNum,
        responsable: nuevoGestorNombre || 'Sin responsable',
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al cambiar el gestor del proyecto');
  }
};

