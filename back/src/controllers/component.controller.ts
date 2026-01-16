/**
 * Controlador para gestión de componentes: crear, actualizar, eliminar y buscar componentes.
 */
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  CrearComponenteInput,
  ActualizarComponenteInput,
  BuscarComponentesQuery,
} from '../validations/component.validation';
import { handleError, sendValidationError, sendNotFoundError } from '../utils/error-handler';
import { parseId } from '../utils/validation';
import { prisma } from '../utils/prisma';
import { registrarActividadSimple, registrarActividadActualizacion } from '../utils/actividad-helpers';
import { ENTIDADES } from '../utils/constants';
import {
  getPaginationParams,
  getSkip,
  buildPaginationResponse,
  requireAuthenticatedUser,
} from '../utils/response-helpers';
import {
  construirFiltrosComponente,
  parseTags,
  stringifyTags,
} from '../utils/component-helpers';
import { verificarProyectoExiste } from '../utils/prisma-helpers';
import { validateAndParseId } from '../utils/crud-helpers';


export const buscarComponentes = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as BuscarComponentesQuery;
    const { pagina, limite } = getPaginationParams(req);
    const skip = getSkip(pagina, limite);

    const where = construirFiltrosComponente(query);

    const [componentes, total] = await Promise.all([
      prisma.componente.findMany({
        where,
        skip,
        take: limite,
        include: {
          proyecto: {
            select: {
              id: true,
              nombre: true,
            },
          },
          creadoPor: {
            select: {
              id: true,
              nombreCompleto: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.componente.count({ where }),
    ]);

    const componentesConTags = componentes.map((comp) => ({
      ...comp,
      tags: parseTags(comp.tags),
    }));

    res.json({
      componentes: componentesConTags,
      paginacion: buildPaginationResponse(total, pagina, limite),
      filtros: {
        proyectoId: query.proyectoId || null,
        categoria: query.categoria || null,
        busqueda: query.busqueda || null,
      },
    });
  } catch (error) {
    handleError(res, error, 'Error al buscar los componentes');
  }
};


export const servirImagenComponente = async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename;
    
    if (!filename) {
      res.status(400).json({ error: 'Nombre de archivo requerido' });
      return;
    }

    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Imagen no encontrada', filename, filePath });
      return;
    }

    // Agregar headers CORS ANTES de enviar la respuesta
    // IMPORTANTE: Estos headers deben establecerse ANTES de sendFile
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
    
    // Determinar tipo MIME
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    }
    
    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error al servir la imagen:', error);
    handleError(res, error, 'Error al servir la imagen');
  }
};

/**
 * Exporta un componente
 * GET /api/componentes/:id/exportar?formato=png&incluirMetadatos=true
 */
export const exportarComponente = async (req: Request, res: Response): Promise<void> => {
  try {
    const componenteId = validateAndParseId(req, res, 'id', 'Componente');
    if (!componenteId) return;

    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const { formato = 'png', incluirMetadatos = 'false' } = req.query;
    const incluirMeta = incluirMetadatos === 'true';

    const componente = await prisma.componente.findUnique({
      where: { id: componenteId },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        categoria: true,
        preview: true,
        tags: true,
      },
    });

    if (!componente) {
      sendNotFoundError(res, 'Componente');
      return;
    }

    // Si se solicitan metadatos, devolver JSON
    if (incluirMeta) {
      res.json({
        componente: {
          id: componente.id.toString(),
          nombre: componente.nombre,
          descripcion: componente.descripcion,
          categoria: componente.categoria,
          tags: componente.tags ? JSON.parse(componente.tags) : [],
          preview: componente.preview,
          formato: formato.toString(),
        },
      });
    } else {
      res.json({
        url: componente.preview,
        nombre: componente.nombre,
        formato: formato.toString(),
      });
    }
  } catch (error) {
    handleError(res, error, 'Error al exportar componente');
  }
};


export const obtenerComponentePorId = async (req: Request, res: Response): Promise<void> => {
  try {
    const componenteId = parseId(req.params.id);

    if (!componenteId) {
      sendValidationError(res, 'ID de componente inválido');
      return;
    }

    const componente = await prisma.componente.findUnique({
      where: { id: componenteId },
      include: {
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!componente) {
      sendNotFoundError(res, 'Componente');
      return;
    }

    const componenteConTags = {
      ...componente,
      tags: parseTags(componente.tags),
    };

    res.json({ componente: componenteConTags });
  } catch (error) {
    handleError(res, error, 'Error al obtener el componente');
  }
};


export const crearComponente = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    // Si hay archivo, los datos vienen en req.body como FormData
    // Si no hay archivo, los datos vienen como JSON
    let datos: CrearComponenteInput;
    
    if (req.file) {
      if (!req.body.nombre || !req.body.nombre.trim()) {
        sendValidationError(res, 'El nombre del componente es requerido');
        return;
      }
      if (!req.body.categoria || !['logos', 'iconos', 'ilustraciones', 'fondos'].includes(req.body.categoria)) {
        sendValidationError(res, 'La categoría debe ser: logos, iconos, ilustraciones o fondos');
        return;
      }
      
      datos = {
        nombre: req.body.nombre.trim(),
        descripcion: req.body.descripcion?.trim() || null,
        categoria: req.body.categoria as 'logos' | 'iconos' | 'ilustraciones' | 'fondos',
        preview: `/uploads/${req.file.filename}`, // Usar el archivo subido
        tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
        proyectoId: req.body.proyectoId ? parseInt(req.body.proyectoId) : null,
      };
    } else {
      // Datos vienen como JSON
      datos = req.body;
    }

    if (datos.proyectoId) {
      if (!(await verificarProyectoExiste(datos.proyectoId))) {
        sendNotFoundError(res, 'Proyecto');
        return;
      }
    }

    if (!datos.preview) {
      sendValidationError(res, 'La URL de vista previa es requerida');
      return;
    }

    const componente = await prisma.componente.create({
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion || null,
        categoria: datos.categoria,
        preview: datos.preview,
        tags: stringifyTags(datos.tags),
        proyectoId: datos.proyectoId || null,
        creadoPorId: userId,
      },
      include: {
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
      },
    });

    registrarActividadSimple(
      'crear',
      ENTIDADES.COMPONENTE,
      componente.id,
      userId,
      `Componente "${componente.nombre}" creado`
    );

    const componenteConTags = {
      ...componente,
      tags: parseTags(componente.tags),
    };

    res.status(201).json({
      message: 'Componente creado exitosamente',
      componente: componenteConTags,
    });
  } catch (error) {
    handleError(res, error, 'Error al crear el componente');
  }
};

/**
 * Actualizar un componente existente
 */
export const actualizarComponente = async (req: Request, res: Response): Promise<void> => {
  try {
    const componenteId = parseId(req.params.id);
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    if (!componenteId) {
      sendValidationError(res, 'ID de componente inválido');
      return;
    }

    const componenteExistente = await prisma.componente.findUnique({
      where: { id: componenteId },
    });

    if (!componenteExistente) {
      sendNotFoundError(res, 'Componente');
      return;
    }

    // Si hay archivo, los datos vienen en req.body como FormData
    // Si no hay archivo, los datos vienen como JSON
    let datos: ActualizarComponenteInput;
    
    if (req.file) {
      datos = {
        nombre: req.body.nombre || undefined,
        descripcion: req.body.descripcion !== undefined ? (req.body.descripcion || null) : undefined,
        categoria: req.body.categoria as 'logos' | 'iconos' | 'ilustraciones' | 'fondos' | undefined,
        preview: `/uploads/${req.file.filename}`, // Usar el archivo subido
        tags: req.body.tags ? JSON.parse(req.body.tags) : undefined,
        proyectoId: req.body.proyectoId !== undefined ? (req.body.proyectoId ? parseInt(req.body.proyectoId) : null) : undefined,
      };
    } else {
      datos = req.body;
    }
    if (datos.proyectoId !== undefined && datos.proyectoId !== null) {
      if (!(await verificarProyectoExiste(datos.proyectoId))) {
        sendNotFoundError(res, 'Proyecto');
        return;
      }
    }

    const datosActualizacion: any = {};
    if (datos.nombre !== undefined) datosActualizacion.nombre = datos.nombre;
    if (datos.descripcion !== undefined) datosActualizacion.descripcion = datos.descripcion || null;
    if (datos.categoria !== undefined) datosActualizacion.categoria = datos.categoria;
    if (datos.preview !== undefined) datosActualizacion.preview = datos.preview;
    if (datos.tags !== undefined) datosActualizacion.tags = stringifyTags(datos.tags);
    if (datos.proyectoId !== undefined) datosActualizacion.proyectoId = datos.proyectoId || null;

    const componente = await prisma.componente.update({
      where: { id: componenteId },
      data: datosActualizacion,
      include: {
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
        creadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
      },
    });

    registrarActividadActualizacion(
      ENTIDADES.COMPONENTE,
      componenteId,
      userId,
      `Componente "${componente.nombre}" actualizado`
    );

    const componenteConTags = {
      ...componente,
      tags: parseTags(componente.tags),
    };

    res.json({
      message: 'Componente actualizado exitosamente',
      componente: componenteConTags,
    });
  } catch (error) {
    handleError(res, error, 'Error al actualizar el componente');
  }
};


export const eliminarComponente = async (req: Request, res: Response): Promise<void> => {
  try {
    const componenteId = parseId(req.params.id);
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    if (!componenteId) {
      sendValidationError(res, 'ID de componente inválido');
      return;
    }

    const componente = await prisma.componente.findUnique({
      where: { id: componenteId },
    });

    if (!componente) {
      sendNotFoundError(res, 'Componente');
      return;
    }

    await prisma.componente.delete({ where: { id: componenteId } });

    registrarActividadSimple(
      'eliminar',
      ENTIDADES.COMPONENTE,
      componenteId,
      userId,
      `Componente "${componente.nombre}" eliminado`
    );

    res.json({ message: 'Componente eliminado exitosamente' });
  } catch (error) {
    handleError(res, error, 'Error al eliminar el componente');
  }
};

