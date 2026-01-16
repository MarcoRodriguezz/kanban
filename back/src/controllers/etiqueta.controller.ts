/**
 * Controlador para gestión de etiquetas: crear, actualizar, eliminar y asociar etiquetas a tareas.
 * Maneja permisos de edición y mantiene registro de actividades para auditoría.
 */
import { Request, Response } from 'express';
import {
  CrearEtiquetaInput,
  ActualizarEtiquetaInput,
  AsociarEtiquetasInput,
  BuscarEtiquetasQuery,
} from '../validations/etiqueta.validation';
import { handleError, sendValidationError, sendNotFoundError } from '../utils/error-handler';
import { parseId } from '../utils/validation';
import { validateAndParseId, validateAndParseIds } from '../utils/crud-helpers';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, registrarActividadActualizacion, registrarActividades } from '../utils/actividad-helpers';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import { ENTIDADES } from '../utils/constants';
import { verificarTareaExiste } from '../utils/prisma-helpers';
import { filterUndefined } from '../utils/crud-helpers';
import {
  etiquetaIncludeConConteo,
  construirFiltrosEtiqueta,
  verificarPermisosEdicionEtiquetasConError,
  verificarEtiquetasExisten,
  obtenerEtiquetasDeTarea,
  construirActividadesCambiosEtiqueta,
  obtenerEtiquetaYValidar,
  validarNombreEtiquetaDuplicado,
  consultarEtiquetasConPaginacion,
} from '../utils/etiqueta-helpers';


export const buscarEtiquetas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre } = req.query as unknown as BuscarEtiquetasQuery;
    const { pagina, limite } = getPaginationParams(req);
    const skip = getSkip(pagina, limite);
    const where = construirFiltrosEtiqueta(nombre);
    const [etiquetas, total] = await consultarEtiquetasConPaginacion(where, skip, limite);

    res.json({
      etiquetas,
      paginacion: buildPaginationResponse(total, pagina, limite),
      filtros: {
        nombre: nombre || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al buscar las etiquetas');
  }
};


export const obtenerTodasLasEtiquetas = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const etiquetas = await prisma.etiqueta.findMany({
      include: etiquetaIncludeConConteo,
      orderBy: { nombre: 'asc' },
    });
    res.json({ etiquetas });
  } catch (error) {
    handleError(res, error, 'Error al obtener las etiquetas');
  }
};


export const obtenerEtiquetaPorId = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const etiquetaId = validateAndParseId(req, res, 'id', 'Etiqueta');
    if (!etiquetaId) return;

    const etiqueta = await prisma.etiqueta.findUnique({
      where: { id: etiquetaId },
      include: etiquetaIncludeConConteo,
    });
    if (!etiqueta) {
      sendNotFoundError(res, 'Etiqueta');
      return;
    }
    res.json({ etiqueta });
  } catch (error) {
    handleError(res, error, 'Error al obtener la etiqueta');
  }
};


export const obtenerEtiquetasPorTarea = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tareaId = parseId(req.params.tareaId);

    if (!tareaId) {
      sendValidationError(res, 'ID de tarea inválido');
      return;
    }
    if (!(await verificarTareaExiste(tareaId))) {
      sendNotFoundError(res, 'Tarea');
      return;
    }
    const etiquetas = await obtenerEtiquetasDeTarea(tareaId);
    res.json({ etiquetas });
  } catch (error) {
    handleError(res, error, 'Error al obtener las etiquetas de la tarea');
  }
};


export const crearEtiqueta = async (req: Request, res: Response): Promise<void> => {
  try {
    const datos: CrearEtiquetaInput = req.body;
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    if (await validarNombreEtiquetaDuplicado(datos.nombre)) {
      res.status(409).json({
        error: 'Ya existe una etiqueta con ese nombre',
      });
      return;
    }

    const etiqueta = await prisma.etiqueta.create({
      data: {
        nombre: datos.nombre,
        color: datos.color ?? null,
      },
    });

    registrarActividadSimple('crear', ENTIDADES.ETIQUETA, etiqueta.id, userId, 
      `Etiqueta "${etiqueta.nombre}" creada`);
    res.status(201).json({
      message: 'Etiqueta creada exitosamente',
      etiqueta,
    });
  } catch (error) {
    handleError(res, error, 'Error al crear la etiqueta');
  }
};



export const actualizarEtiqueta = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const etiquetaId = parseId(req.params.id);
    const datos: ActualizarEtiquetaInput = req.body;
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;
    if (!etiquetaId) {
      sendValidationError(res, 'ID de etiqueta inválido');
      return;
    }
    const etiquetaAnterior = await obtenerEtiquetaYValidar(etiquetaId, res);
    if (!etiquetaAnterior) {
      return;
    }

    if (datos.nombre && datos.nombre !== etiquetaAnterior.nombre) {
      if (await validarNombreEtiquetaDuplicado(datos.nombre, etiquetaId)) {
        res.status(409).json({
          error: 'Ya existe una etiqueta con ese nombre',
        });
        return;
      }
    }

    const datosActualizacion = filterUndefined(datos);
    const etiqueta = await prisma.etiqueta.update({
      where: { id: etiquetaId },
      data: datosActualizacion,
    });

    const actividades = construirActividadesCambiosEtiqueta(
      etiquetaAnterior,
      datosActualizacion,
      etiquetaId,
      userId,
      etiqueta.nombre
    );

    if (actividades.length > 0) {
      registrarActividades(actividades);
    }
    res.json({
      message: 'Etiqueta actualizada exitosamente',
      etiqueta,
    });
  } catch (error) {
    handleError(res, error, 'Error al actualizar la etiqueta');
  }
};


export const eliminarEtiqueta = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const etiquetaId = validateAndParseId(req, res, 'id', 'Etiqueta');
    if (!etiquetaId) return;

    const etiqueta = await obtenerEtiquetaYValidar(etiquetaId, res, {
      id: true,
      nombre: true,
    });
    if (!etiqueta) {
      return;
    }

    await prisma.etiqueta.delete({ where: { id: etiquetaId } });
    registrarActividadSimple('eliminar', ENTIDADES.ETIQUETA, etiquetaId, userId, 
      `Etiqueta "${etiqueta.nombre}" eliminada`);
    res.json({ message: 'Etiqueta eliminada exitosamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar la etiqueta');
  }
};


export const asociarEtiquetasATarea = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tareaId = parseId(req.params.tareaId);
    const datos: AsociarEtiquetasInput = req.body;
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;
    if (!tareaId) {
      sendValidationError(res, 'ID de tarea inválido');
      return;
    }
    const resultadoPermisos = await verificarPermisosEdicionEtiquetasConError(userId, tareaId, res);
    if (!resultadoPermisos) {
      return;
    }
    
    // Obtener etiquetas actuales antes de hacer cambios
    const etiquetasAnteriores = await obtenerEtiquetasDeTarea(tareaId);
    const etiquetasAnterioresIds = etiquetasAnteriores.map(e => e.id).sort((a, b) => a - b);
    
    // Normalizar etiquetas nuevas (puede ser undefined, null, o array vacío)
    const etiquetasNuevasIds = (datos.etiquetaIds || []).sort((a, b) => a - b);
    
    // Comparar si hay cambios reales usando una comparación más robusta
    const hayCambios = 
      etiquetasAnterioresIds.length !== etiquetasNuevasIds.length ||
      JSON.stringify(etiquetasAnterioresIds) !== JSON.stringify(etiquetasNuevasIds);
    
    // Si no hay cambios, retornar inmediatamente sin hacer nada
    if (!hayCambios) {
      const etiquetas = await obtenerEtiquetasDeTarea(tareaId);
      res.json({
        message: 'Etiquetas asociadas exitosamente',
        etiquetas,
      });
      return;
    }
    
    // Validar que las etiquetas existen antes de hacer cambios
    if (datos.etiquetaIds && datos.etiquetaIds.length > 0) {
      const { todasExisten } = await verificarEtiquetasExisten(datos.etiquetaIds);
      if (!todasExisten) {
        res.status(400).json({
          error: 'Una o más etiquetas no existen',
        });
        return;
      }
    }

    // Solo hacer cambios si realmente hay diferencias (ya verificamos arriba)
    await prisma.tareaEtiqueta.deleteMany({
      where: { tareaId },
    });
    
    if (datos.etiquetaIds && datos.etiquetaIds.length > 0) {
      await prisma.tareaEtiqueta.createMany({
        data: datos.etiquetaIds.map((etiquetaId) => ({
          tareaId,
          etiquetaId,
        })),
      });
    }

    // Registrar actividad solo si hubo cambios reales
    registrarActividadActualizacion(ENTIDADES.TAREA, tareaId, userId, 
      `Etiquetas actualizadas en tarea "${resultadoPermisos.tarea?.titulo || ''}"`, 
      'etiquetas');
    
    const etiquetas = await obtenerEtiquetasDeTarea(tareaId);
    res.json({
      message: 'Etiquetas asociadas exitosamente',
      etiquetas,
    });
  } catch (error) {
    handleError(res, error, 'Error al asociar las etiquetas');
  }
};


export const desasociarEtiquetaDeTarea = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const ids = validateAndParseIds(req, res, [
      { paramName: 'tareaId', resourceName: 'Tarea' },
      { paramName: 'etiquetaId', resourceName: 'Etiqueta' }
    ]);
    if (!ids) return;
    
    const tareaId = ids.tareaId;
    const etiquetaId = ids.etiquetaId;
    const resultadoPermisos = await verificarPermisosEdicionEtiquetasConError(userId, tareaId, res);
    if (!resultadoPermisos) {
      return;
    }
    
    // Verificar que la etiqueta está realmente asociada a la tarea antes de eliminarla
    const tareaEtiqueta = await prisma.tareaEtiqueta.findUnique({
      where: {
        tareaId_etiquetaId: {
          tareaId,
          etiquetaId,
        },
      },
    });
    
    if (!tareaEtiqueta) {
      res.status(404).json({
        error: 'La etiqueta no está asociada a esta tarea',
      });
      return;
    }
    
    await prisma.tareaEtiqueta.delete({
      where: {
        tareaId_etiquetaId: {
          tareaId,
          etiquetaId,
        },
      },
    });

    // Solo registrar actividad si realmente se eliminó la asociación
    registrarActividadActualizacion(ENTIDADES.TAREA, tareaId, userId, 
      `Etiqueta desasociada de tarea "${resultadoPermisos.tarea?.titulo || ''}"`, 
      'etiquetas');
    res.json({ message: 'Etiqueta desasociada exitosamente' });
  } catch (error) {
    if ((error as any).code === 'P2025') {
      res.status(404).json({
        error: 'La etiqueta no está asociada a esta tarea',
      });
      return;
    }
    handleError(res, error, 'Error al desasociar la etiqueta');
  }
};

