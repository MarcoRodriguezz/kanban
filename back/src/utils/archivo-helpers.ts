/**
 * Utilidades específicas para operaciones con archivos adjuntos.
 * Funciones auxiliares para validación de permisos, límites de tamaño y manejo de archivos físicos.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { SERVER_CONSTANTS } from './constants';
import { logger } from './logger';
import { verificarPermisosTarea } from './permission-helpers';
import { buildIdFilter, buildExactFilter } from './crud-helpers';

/**
 * Verifica si un usuario tiene permisos para modificar archivos de una tarea
 */
export const verificarPermisosArchivo = async (
  userId: number,
  tareaId: number
): Promise<{ tienePermiso: boolean; tarea?: any } | null> => {
  const resultadoPermisos = await verificarPermisosTarea(userId, tareaId);
  if (!resultadoPermisos || !resultadoPermisos.tarea) {
    return null;
  }

  const { permisos } = resultadoPermisos;
  const tienePermiso =
    permisos.esAdmin ||
    permisos.esCreador ||
    permisos.esAsignado ||
    permisos.esGestor;

  return {
    tienePermiso,
    tarea: resultadoPermisos.tarea,
  };
};

/**
 * Verifica si el tamaño total de archivos de una tarea excede el límite permitido
 * Retorna el tamaño total actual y si excede el límite
 */
export const verificarLímiteTamañoArchivos = async (
  tareaId: number,
  nuevoTamaño: number
): Promise<{
  excedeLímite: boolean;
  tamañoTotalActual: number;
  tamañoTotalNuevo: number;
  mensaje?: string;
}> => {
  const archivosExistentes = await prisma.archivo.findMany({
    where: { tareaId },
    select: { tamaño: true },
  });

  const tamañoTotalExistente = archivosExistentes.reduce(
    (sum, archivo) => sum + (archivo.tamaño || 0),
    0
  );
  const tamañoTotalNuevo = tamañoTotalExistente + nuevoTamaño;

  const excedeLímite = tamañoTotalNuevo > SERVER_CONSTANTS.MAX_TOTAL_SIZE_PER_TASK_BYTES;

  if (excedeLímite) {
    const tamañoTotalMB = (tamañoTotalExistente / (1024 * 1024)).toFixed(2);
    const límiteMB = SERVER_CONSTANTS.MAX_TOTAL_SIZE_PER_TASK_MB;

    return {
      excedeLímite: true,
      tamañoTotalActual: tamañoTotalExistente,
      tamañoTotalNuevo,
      mensaje: `El tamaño total de archivos por tarea no puede exceder ${límiteMB}MB. Tamaño actual: ${tamañoTotalMB}MB`,
    };
  }

  return {
    excedeLímite: false,
    tamañoTotalActual: tamañoTotalExistente,
    tamañoTotalNuevo,
  };
};

/**
 * Elimina un archivo físico del sistema de archivos
 * Maneja errores silenciosamente (no lanza excepciones)
 */
export const eliminarArchivoFísico = (filename: string): void => {
  if (!filename) return;

  const filePath = path.join(process.cwd(), 'uploads', filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      logger.error('Error al eliminar archivo físico', err, { filePath });
    }
  });
};

/**
 * Extrae el nombre del archivo de una URL
 */
export const extraerNombreArchivoDeUrl = (url: string): string | null => {
  const filename = url.split('/').pop();
  return filename || null;
};

/**
 * Construye los filtros WHERE para búsqueda de archivos
 */
export const construirFiltrosArchivo = (query: {
  tareaId?: string | number;
  tipo?: string;
}): any => {
  const where: any = {};
  
  const tareaId = buildIdFilter(query.tareaId);
  if (tareaId) {
    where.tareaId = tareaId;
  }
  
  const tipo = buildExactFilter(query.tipo);
  if (tipo) {
    where.tipo = tipo;
  }
  
  return where;
};

/**
 * Obtiene un archivo y verifica permisos del usuario
 * Retorna null si no existe o no tiene permisos
 */
export const obtenerArchivoConPermisos = async (
  archivoId: number,
  userId: number,
  select?: any
): Promise<{
  archivo: any;
  resultadoPermisos: { tienePermiso: boolean; tarea?: any };
} | null> => {
  const archivo = await prisma.archivo.findUnique({
    where: { id: archivoId },
    select: select || {
      id: true,
      nombre: true,
      url: true,
      tareaId: true,
    },
  });

  if (!archivo) {
    return null;
  }

  const resultadoPermisos = await verificarPermisosArchivo(userId, archivo.tareaId);
  if (!resultadoPermisos || !resultadoPermisos.tienePermiso) {
    return null;
  }

  return { archivo, resultadoPermisos };
};

/**
 * Valida y prepara la creación de un archivo
 * Retorna error si hay problemas, o los datos necesarios para crear
 */
export const validarCreacionArchivo = async (
  userId: number,
  tareaId: number,
  tamañoArchivo: number,
  filename: string
): Promise<{
  válido: boolean;
  error?: {
    status: number;
    mensaje: string;
    tamañoActualMB?: number;
    límiteMB?: number;
  };
  resultadoPermisos?: { tienePermiso: boolean; tarea?: any };
}> => {
  const resultadoPermisos = await verificarPermisosArchivo(userId, tareaId);
  if (!resultadoPermisos) {
    eliminarArchivoFísico(filename);
    return {
      válido: false,
      error: { status: 404, mensaje: 'Tarea no encontrada' },
    };
  }

  if (!resultadoPermisos.tienePermiso) {
    eliminarArchivoFísico(filename);
    return {
      válido: false,
      error: {
        status: 403,
        mensaje: 'No tienes permisos para agregar archivos a esta tarea',
      },
    };
  }

  const verificaciónTamaño = await verificarLímiteTamañoArchivos(tareaId, tamañoArchivo);
  if (verificaciónTamaño.excedeLímite) {
    eliminarArchivoFísico(filename);
    const tamañoTotalMB = (verificaciónTamaño.tamañoTotalActual / (1024 * 1024)).toFixed(2);
    const límiteMB = SERVER_CONSTANTS.MAX_TOTAL_SIZE_PER_TASK_MB;

    return {
      válido: false,
      error: {
        status: 400,
        mensaje: verificaciónTamaño.mensaje || 'Límite de tamaño excedido',
        tamañoActualMB: parseFloat(tamañoTotalMB),
        límiteMB,
      },
    };
  }

  return { válido: true, resultadoPermisos };
};

