/**
 * Controlador para gestión de issues: crear, obtener, actualizar issues.
 */
import { Request, Response } from 'express';
import { handleError, sendNotFoundError, sendValidationError } from '../utils/error-handler';
import { validateAndParseId } from '../utils/crud-helpers';
import { requireAuthenticatedUser } from '../utils/response-helpers';
import { prisma } from '../utils/prisma';
import { ROLES } from '../utils/constants';
import { crearNotificacionIssueReportado } from '../utils/notificacion-helpers';

/**
 * Mapea el estado del frontend al estado del backend
 */
const mapearEstadoFrontendABackend = (estado: string): 'Abierto' | 'En_revision' | 'Asignado' | 'Resuelto' => {
  const estadoMap: Record<string, 'Abierto' | 'En_revision' | 'Asignado' | 'Resuelto'> = {
    'Abierto': 'Abierto',
    'En revisión': 'En_revision',
    'En_revision': 'En_revision',
    'Asignado': 'Asignado',
    'Resuelto': 'Resuelto',
  };
  return estadoMap[estado] || 'Abierto';
};

/**
 * Mapea el estado del backend al estado del frontend
 */
const mapearEstadoBackendAFrontend = (estado: string): 'Abierto' | 'En revisión' | 'Asignado' | 'Resuelto' => {
  const estadoMap: Record<string, 'Abierto' | 'En revisión' | 'Asignado' | 'Resuelto'> = {
    'Abierto': 'Abierto',
    'En_revision': 'En revisión',
    'Asignado': 'Asignado',
    'Resuelto': 'Resuelto',
  };
  return estadoMap[estado] || 'Abierto';
};

/**
 * Obtener todos los issues de un proyecto
 * GET /api/issues?proyectoId=123
 */
export const obtenerIssues = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const proyectoIdParam = req.query.proyectoId as string | undefined;
    
    if (!proyectoIdParam) {
      res.status(400).json({ error: 'proyectoId es requerido' });
      return;
    }

    const proyectoId = parseInt(proyectoIdParam);
    if (isNaN(proyectoId)) {
      res.status(400).json({ error: 'proyectoId debe ser un número válido' });
      return;
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoId },
      select: { id: true, nombre: true },
    });

    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    if (usuario.rol !== ROLES.ADMINISTRADOR) {
      const tieneTareas = await prisma.tarea.findFirst({
        where: {
          proyectoId,
          usuarioId: userId,
        },
        select: { id: true },
      });

      const esGestor = await prisma.proyecto.findFirst({
        where: {
          id: proyectoId,
          gestorId: userId,
        },
        select: { id: true },
      });

      if (!tieneTareas && !esGestor) {
        res.status(403).json({ error: 'No tienes permisos para ver los issues de este proyecto' });
        return;
      }
    }

    const issues = await prisma.issue.findMany({
      where: { proyectoId },
      include: {
        reportadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        asignadoA: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mapear issues al formato del frontend
    const issuesMapeados = issues.map((issue) => ({
      id: issue.id.toString(),
      title: issue.titulo,
      description: issue.descripcion || '',
      category: issue.categoria,
      status: mapearEstadoBackendAFrontend(issue.estado),
      priority: issue.prioridad as 'Alta' | 'Media' | 'Baja',
      reporter: issue.reportadoPor.nombreCompleto,
      reporterId: issue.reportadoPorId.toString(),
      createdAt: issue.createdAt.toISOString().split('T')[0],
      assignee: issue.asignadoA?.nombreCompleto,
      assigneeId: issue.asignadoAId?.toString(),
      projectId: issue.proyectoId.toString(),
    }));

    res.json({ issues: issuesMapeados });
  } catch (error) {
    handleError(res, error, 'Error al obtener los issues');
  }
};

/**
 * Crear un nuevo issue
 * POST /api/issues
 */
export const crearIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const titulo = req.body.titulo || req.body.title;
    const descripcion = req.body.descripcion || req.body.description;
    const proyectoId = req.body.proyectoId || req.body.projectId;
    const categoria = req.body.categoria || req.body.category;
    const prioridad = req.body.prioridad || req.body.priority;

    if (!titulo || !titulo.trim()) {
      sendValidationError(res, 'El título es requerido');
      return;
    }

    if (!proyectoId) {
      sendValidationError(res, 'El proyectoId es requerido');
      return;
    }

    const proyectoIdNum = parseInt(proyectoId.toString());
    if (isNaN(proyectoIdNum)) {
      sendValidationError(res, 'proyectoId debe ser un número válido');
      return;
    }

    const proyecto = await prisma.proyecto.findUnique({
      where: { id: proyectoIdNum },
      include: {
        gestor: {
          select: {
            id: true,
            nombreCompleto: true,
          },
        },
      },
    });

    if (!proyecto) {
      sendNotFoundError(res, 'Proyecto');
      return;
    }

    const categoriasValidas = ['Bug', 'Mejora', 'Idea', 'Pregunta'];
    const categoriaFinal = categoriasValidas.includes(categoria) ? categoria : 'Bug';

    const prioridadesValidas = ['Alta', 'Media', 'Baja'];
    const prioridadFinal = prioridadesValidas.includes(prioridad) ? prioridad : 'Media';

    // Crear el issue
    const issue = await prisma.issue.create({
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        categoria: categoriaFinal as 'Bug' | 'Mejora' | 'Idea' | 'Pregunta',
        estado: 'Abierto',
        prioridad: prioridadFinal,
        proyectoId: proyectoIdNum,
        reportadoPorId: userId,
      },
      include: {
        reportadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    // Obtener información del usuario que reportó
    const usuarioReportador = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { nombreCompleto: true },
    });

    const administradores = await prisma.usuario.findMany({
      where: { rol: ROLES.ADMINISTRADOR },
      select: { id: true },
    });

    const notificacionesAdmin = administradores.map((admin) =>
      crearNotificacionIssueReportado(
        admin.id,
        issue.id,
        issue.titulo,
        proyectoIdNum,
        usuarioReportador?.nombreCompleto
      )
    );

    // Solo los administradores reciben notificaciones de issues
    await Promise.all(notificacionesAdmin);

    // Mapear al formato del frontend
    const issueMapeado = {
      id: issue.id.toString(),
      title: issue.titulo,
      description: issue.descripcion || '',
      category: issue.categoria,
      status: mapearEstadoBackendAFrontend(issue.estado),
      priority: issue.prioridad as 'Alta' | 'Media' | 'Baja',
      reporter: issue.reportadoPor.nombreCompleto,
      reporterId: issue.reportadoPorId.toString(),
      createdAt: issue.createdAt.toISOString().split('T')[0],
      assignee: undefined,
      assigneeId: undefined,
      projectId: issue.proyectoId.toString(),
    };

    res.status(201).json({
      message: 'Issue creado exitosamente',
      issue: issueMapeado,
    });
  } catch (error) {
    handleError(res, error, 'Error al crear el issue');
  }
};

/**
 * Actualizar el estado de un issue
 * PATCH /api/issues/:id/estado
 */
export const actualizarEstadoIssue = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const issueId = validateAndParseId(req, res, 'id', 'Issue');
    if (!issueId) return;

    const { estado } = req.body;

    if (!estado) {
      sendValidationError(res, 'El estado es requerido');
      return;
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        proyecto: {
          select: {
            id: true,
            gestorId: true,
          },
        },
      },
    });

    if (!issue) {
      sendNotFoundError(res, 'Issue');
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: true },
    });

    if (!usuario) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const esAdmin = usuario.rol === ROLES.ADMINISTRADOR;

    // Solo los administradores pueden cambiar el estado de los issues
    if (!esAdmin) {
      res.status(403).json({ error: 'Solo los administradores pueden cambiar el estado de los issues' });
      return;
    }

    const estadoBackend = mapearEstadoFrontendABackend(estado);

    const issueActualizado = await prisma.issue.update({
      where: { id: issueId },
      data: { estado: estadoBackend },
      include: {
        reportadoPor: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        asignadoA: {
          select: {
            id: true,
            nombreCompleto: true,
            email: true,
          },
        },
        proyecto: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    // Mapear al formato del frontend
    const issueMapeado = {
      id: issueActualizado.id.toString(),
      title: issueActualizado.titulo,
      description: issueActualizado.descripcion || '',
      category: issueActualizado.categoria,
      status: mapearEstadoBackendAFrontend(issueActualizado.estado),
      priority: issueActualizado.prioridad as 'Alta' | 'Media' | 'Baja',
      reporter: issueActualizado.reportadoPor.nombreCompleto,
      reporterId: issueActualizado.reportadoPorId.toString(),
      createdAt: issueActualizado.createdAt.toISOString().split('T')[0],
      assignee: issueActualizado.asignadoA?.nombreCompleto,
      assigneeId: issueActualizado.asignadoAId?.toString(),
      projectId: issueActualizado.proyectoId.toString(),
    };

    res.json({
      message: 'Estado del issue actualizado exitosamente',
      issue: issueMapeado,
    });
  } catch (error) {
    handleError(res, error, 'Error al actualizar el estado del issue');
  }
};

