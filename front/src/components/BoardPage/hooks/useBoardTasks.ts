import { useState, useEffect, useCallback } from 'react';
import { BoardTaskItem } from '../types';
import { BOARD_TASKS, BOARD_COLUMNS } from '../boardData';
import {
  getProjectTasks,
  KanbanTaskItem,
  createTask,
  updateTask,
  deleteTask,
  autoAssignTask,
  buscarOCrearEtiquetas,
  asociarEtiquetasATarea,
  apiRequest,
} from '../../../services/api';
import { resolveColumnIdByStatus, prepareTaskUpdates, normalizeLabels } from '../utils/taskHelpers';

/**
 * Extrae el ID numérico real de un ID que puede ser "KB-303" o "303"
 */
function getNumericTaskId(taskId: string): string {
  if (taskId.startsWith('KB-')) {
    return taskId.replace('KB-', '');
  }
  return taskId;
}

export function useBoardTasks(
  projectId?: string,
  onTaskDeleted?: (taskId: string) => void,
  onTasksLoaded?: (tasksData: Record<string, KanbanTaskItem[]>) => void
) {
  const [boardTasks, setBoardTasks] = useState<Record<string, BoardTaskItem[]>>(BOARD_TASKS);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskCounter, setTaskCounter] = useState(() =>
    Object.values(BOARD_TASKS).reduce((accumulator, list) => accumulator + list.length, 0)
  );

  // Cargar tareas del proyecto cuando cambia el proyecto
  useEffect(() => {
    if (!projectId) {
      setBoardTasks(BOARD_TASKS);
      return;
    }

    const loadTasks = async () => {
      setIsLoadingTasks(true);
      try {
        // El backend ya devuelve los datos completamente formateados
        const tasksData = await getProjectTasks(projectId);
        
        // Convertir KanbanTaskItem[] a BoardTaskItem[] (son compatibles, solo necesitamos casting)
        const convertedTasks = tasksData as Record<string, BoardTaskItem[]>;

        setBoardTasks(convertedTasks);
        setTaskCounter(Object.values(convertedTasks).reduce((acc, list) => acc + list.length, 0));

        // Notificar que las tareas se cargaron para inicializar etiquetas
        onTasksLoaded?.(tasksData);
      } catch (error) {
        console.error('Error cargando tareas:', error);
        setBoardTasks(BOARD_TASKS);
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks();
  }, [projectId]);

  const findTaskById = useCallback(
    (taskId: string, columnHint?: string) => {
      if (columnHint && boardTasks[columnHint]) {
        const hintedTask = boardTasks[columnHint].find((task) => task.id === taskId);
        if (hintedTask) {
          return { task: hintedTask, columnId: columnHint };
        }
      }

      for (const column of Object.keys(boardTasks)) {
        const result = boardTasks[column].find((task) => task.id === taskId);
        if (result) {
          return { task: result, columnId: column };
        }
      }

      return null;
    },
    [boardTasks]
  );

  const addTask = async (projectId: string): Promise<BoardTaskItem | null> => {
    try {
      const newTask = await createTask({
        title: 'Nueva tarea',
        description: 'Describe el objetivo y asigna responsables.',
        priority: 'Baja',
        projectId,
      });

      // Recargar tareas para obtener el formato correcto del backend (KanbanTaskItem)
      // Esto es necesario porque el backend formatea las tareas específicamente para Kanban
      const tasksData = await getProjectTasks(projectId);
      const convertedTasks = tasksData as Record<string, BoardTaskItem[]>;
      setBoardTasks(convertedTasks);
      
      // Buscar la tarea recién creada
      const columnId = resolveColumnIdByStatus(newTask.status as any) ?? 'pending';
      const taskItem = convertedTasks[columnId]?.find(t => t.id === newTask.id);
      
      return taskItem || null;
    } catch (error: any) {
      console.error('Error creando tarea:', error);
      let errorMessage = error.message || 'Error al crear la tarea. Por favor, intenta de nuevo.';
      if (error.details && Array.isArray(error.details) && error.details.length > 0) {
        const detailsMessages = error.details.map((d: any) => `${d.field}: ${d.message}`).join('\n');
        errorMessage = `Error de validación:\n${detailsMessages}`;
      }
      alert(errorMessage);
      return null;
    }
  };

  const deleteTaskById = async (
    taskId: string,
    columnId: string,
    onCleanup?: (taskKey: string) => void
  ) => {
    if (!projectId) {
      return;
    }

    const numericTaskId = getNumericTaskId(taskId);

    try {
      await deleteTask(numericTaskId);

      setBoardTasks((prev) => {
        const columnTasks = [...(prev[columnId] ?? [])];
        const filtered = columnTasks.filter((task) => task.id !== taskId);
        return {
          ...prev,
          [columnId]: filtered,
        };
      });

      const taskKey = `${taskId}-${columnId}`;
      onCleanup?.(taskKey);

      if (onTaskDeleted) {
        onTaskDeleted(taskId);
      }

      // Ya actualizamos el estado local arriba, no necesitamos recargar todo
      // Solo recargar si hay inconsistencias (opcional, para debugging)
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      alert('Error al eliminar la tarea. Por favor, intenta de nuevo.');
    }
  };

  const saveTaskChanges = async (
    taskDraft: BoardTaskItem,
    selectedTask: BoardTaskItem,
    selectedTaskColumn: string,
    projectId: string,
    currentLabels: string[],
    onLabelsChange?: (oldKey: string, newKey: string) => void
  ): Promise<{ updatedTask: BoardTaskItem; targetColumnId: string } | null> => {
    try {
      const numericId = getNumericTaskId(selectedTask.id);

      if (!numericId || isNaN(Number(numericId))) {
        console.error('ID de tarea inválido:', selectedTask.id);
        alert('Error: ID de tarea inválido');
        return null;
      }

      // Obtener etiquetas originales del backend antes de comparar
      let previousLabels: string[] = [];
      try {
        const taskResponse = await apiRequest<{ tarea: any }>(`/api/tareas/${numericId}`);
        const tarea = taskResponse.tarea || taskResponse;
        previousLabels = tarea.etiquetas?.map((e: any) => e.nombre || e.etiqueta?.nombre || e) || [];
      } catch (error) {
        console.error('Error al obtener etiquetas originales:', error);
        // Si falla, asumir que no hay etiquetas anteriores
        previousLabels = [];
      }

      const normalizedCurrent = normalizeLabels(currentLabels);
      const normalizedPrevious = normalizeLabels(previousLabels);

      // Usar comparación más robusta (igual que en el backend)
      const labelsChanged = 
        JSON.stringify(normalizedCurrent) !== JSON.stringify(normalizedPrevious);

      // Guardar etiquetas si cambiaron (antes de actualizar otros campos)
      if (labelsChanged) {
        try {
          const etiquetaIds = await buscarOCrearEtiquetas(currentLabels);
          await asociarEtiquetasATarea(numericId, etiquetaIds);
        } catch (error) {
          console.error('Error al guardar las etiquetas:', error);
        }
      }

      const updates = prepareTaskUpdates(taskDraft, selectedTask, projectId);

      // Si no hay cambios en otros campos ni en etiquetas, retornar sin hacer nada
      if (Object.keys(updates).length === 0 && !labelsChanged) {
        return null;
      }

      // Actualizar otros campos de la tarea si hay cambios
      if (Object.keys(updates).length > 0) {
        await updateTask(numericId, updates);
      }

      // Recargar tareas del backend para obtener el formato correcto (KanbanTaskItem)
      // Esto es necesario porque el backend formatea las tareas específicamente para Kanban
      // Lo hacemos siempre que haya cambios (en etiquetas o en otros campos)
      const tasksData = await getProjectTasks(projectId);
      const convertedTasks = tasksData as Record<string, BoardTaskItem[]>;
      
      // Buscar la tarea actualizada
      const updatedTask = Object.values(convertedTasks)
        .flat()
        .find(t => t.id === selectedTask.id);
      
      if (!updatedTask) {
        return null;
      }
      
      const targetColumnId = resolveColumnIdByStatus(updatedTask.status) ?? selectedTaskColumn;

      // Actualizar el estado local con los datos del backend
      setBoardTasks(convertedTasks);

      if (selectedTaskColumn !== targetColumnId && onLabelsChange) {
        const oldKey = `${selectedTask.id}-${selectedTaskColumn}`;
        const newKey = `${updatedTask.id}-${targetColumnId}`;
        onLabelsChange(oldKey, newKey);
      }

      return { updatedTask, targetColumnId };
    } catch (error: any) {
      console.error('Error al guardar los cambios de la tarea:', error);
      let errorMessage = 'Error al guardar los cambios. Por favor, intenta de nuevo.';
      if (error.details && Array.isArray(error.details) && error.details.length > 0) {
        const validationErrors = error.details.map((detail: any) => 
          `${detail.field}: ${detail.message}`
        ).join('\n');
        errorMessage = `Error de validación:\n${validationErrors}`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      alert(errorMessage);
      return null;
    }
  };

  const assignTaskToCurrentUser = async (
    task: BoardTaskItem,
    columnId: string
  ): Promise<BoardTaskItem | null> => {
    try {
      const numericId = getNumericTaskId(task.id);

      if (!numericId || isNaN(Number(numericId))) {
        console.error('ID de tarea inválido:', task.id);
        alert('Error: ID de tarea inválido');
        return null;
      }

      await autoAssignTask(numericId);
      
      // Recargar tareas del backend para obtener el formato correcto (KanbanTaskItem)
      if (!projectId) return null;
      const tasksData = await getProjectTasks(projectId);
      const convertedTasks = tasksData as Record<string, BoardTaskItem[]>;
      
      // Buscar la tarea actualizada
      const updatedTask = Object.values(convertedTasks)
        .flat()
        .find(t => t.id === task.id);
      
      if (!updatedTask) return null;

      // Actualizar el estado local con los datos del backend
      setBoardTasks(convertedTasks);

      return updatedTask;
    } catch (error) {
      console.error('Error al autoasignar la tarea:', error);
      alert('Error al asignar la tarea. Por favor, intenta de nuevo.');
      return null;
    }
  };

  const moveTaskToColumn = (
    taskId: string,
    sourceColumnId: string,
    targetColumnId: string,
    onDataMigration?: (oldKey: string, newKey: string) => void
  ) => {
    setBoardTasks((prev) => {
      if (!prev[sourceColumnId]) {
        return prev;
      }

      const sourceTasks = [...prev[sourceColumnId]];
      const taskIndex = sourceTasks.findIndex((item) => item.id === taskId);
      if (taskIndex === -1) {
        return prev;
      }

      const [movedTask] = sourceTasks.splice(taskIndex, 1);

      if (sourceColumnId === targetColumnId) {
        return {
          ...prev,
          [sourceColumnId]: [...sourceTasks, movedTask],
        };
      }

      const targetTasks = [...(prev[targetColumnId] ?? [])];
      const nextStatus = BOARD_COLUMNS.find((col) => col.id === targetColumnId)?.title ?? movedTask.status;
      targetTasks.push({ ...movedTask, status: nextStatus as typeof movedTask.status });

      if (onDataMigration) {
        const oldKey = `${taskId}-${sourceColumnId}`;
        const newKey = `${taskId}-${targetColumnId}`;
        onDataMigration(oldKey, newKey);
      }

      return {
        ...prev,
        [sourceColumnId]: sourceTasks,
        [targetColumnId]: targetTasks,
      };
    });
  };

  return {
    boardTasks,
    isLoadingTasks,
    taskCounter,
    findTaskById,
    addTask,
    deleteTaskById,
    saveTaskChanges,
    assignTaskToCurrentUser,
    moveTaskToColumn,
    setBoardTasks,
  };
}

