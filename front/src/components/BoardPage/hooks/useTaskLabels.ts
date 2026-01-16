import { useState, useEffect, useMemo } from 'react';
import { BoardTaskItem } from '../types';
import { apiRequest } from '../../../services/api';
import { getNumericTaskId } from '../utils/taskHelpers';

export function useTaskLabels(
  selectedTask: BoardTaskItem | null,
  selectedTaskColumn: string | null,
  projectId?: string
) {
  const [labelsMap, setLabelsMap] = useState<Record<string, string[]>>({});
  const [newLabel, setNewLabel] = useState('');

  const taskKey = useMemo(() => {
    if (!selectedTask || !selectedTaskColumn) {
      return null;
    }
    return `${selectedTask.id}-${selectedTaskColumn}`;
  }, [selectedTask, selectedTaskColumn]);

  const activeLabels = useMemo(() => {
    if (!taskKey) {
      return [] as string[];
    }
    return labelsMap[taskKey] ?? [];
  }, [labelsMap, taskKey]);

  const trimmedNewLabel = newLabel.trim();
  const isNewLabelDuplicate = useMemo(
    () => trimmedNewLabel !== '' && activeLabels.some((item) => item.toLowerCase() === trimmedNewLabel.toLowerCase()),
    [activeLabels, trimmedNewLabel]
  );

  // Cargar etiquetas cuando se selecciona una tarea
  useEffect(() => {
    if (!selectedTask || !selectedTaskColumn || !projectId) {
      return;
    }

    const taskKey = `${selectedTask.id}-${selectedTaskColumn}`;

    // Solo cargar si no están ya cargadas
    const currentLabels = labelsMap[taskKey];
    if (currentLabels && currentLabels.length > 0) {
      return; // Ya están cargadas
    }

    const loadTaskLabels = async () => {
      try {
        const numericId = getNumericTaskId(selectedTask.id);

        if (!numericId || isNaN(Number(numericId))) {
          console.warn('ID de tarea inválido:', selectedTask.id);
          return;
        }

        const taskResponse = await apiRequest<{ tarea: any }>(`/api/tareas/${numericId}`);
        const tarea = taskResponse.tarea || taskResponse;
        const etiquetas = tarea.etiquetas?.map((e: any) => e.nombre || e) || [];

        setLabelsMap((prev) => {
          if (prev[taskKey] && prev[taskKey].length > 0) {
            return prev;
          }
          return {
            ...prev,
            [taskKey]: etiquetas,
          };
        });
      } catch (error: any) {
        if (error.message && !error.message.includes('no encontrado') && !error.message.includes('404')) {
          console.error('Error cargando etiquetas de la tarea:', error);
        }
      }
    };

    loadTaskLabels();
  }, [selectedTask?.id, selectedTaskColumn, projectId]);

  const toggleLabel = (label: string) => {
    if (!taskKey) return;

    const normalized = label.trim();
    if (normalized === '') return;

    setLabelsMap((prev) => {
      const currentList = prev[taskKey] ?? [];
      const exists = currentList.some((item) => item.toLowerCase() === normalized.toLowerCase());
      let nextList: string[];

      if (exists) {
        nextList = currentList.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
      } else {
        nextList = [...currentList, label];
      }

      if (nextList.length === 0) {
        const { [taskKey]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [taskKey]: nextList,
      };
    });
  };

  const addCustomLabel = () => {
    if (!taskKey) return;
    const value = newLabel.trim();
    if (value === '') return;

    setLabelsMap((prev) => {
      const currentList = prev[taskKey] ?? [];
      const exists = currentList.some((item) => item.toLowerCase() === value.toLowerCase());
      if (exists) {
        return prev;
      }
      return {
        ...prev,
        [taskKey]: [...currentList, value],
      };
    });

    setNewLabel('');
  };

  const removeLabelFromTask = (taskId: string, columnId: string) => {
    const key = `${taskId}-${columnId}`;
    setLabelsMap((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const migrateLabels = (oldKey: string, newKey: string) => {
    setLabelsMap((prev) => {
      if (!prev[oldKey]) {
        return prev;
      }
      const { [oldKey]: moved, ...rest } = prev;
      return moved ? { ...rest, [newKey]: moved } : rest;
    });
  };

  const initializeLabelsFromTasks = (tasksData: Record<string, any[]>) => {
    const labelsMapNuevo: Record<string, string[]> = {};
    for (const [columnId, tasks] of Object.entries(tasksData)) {
      tasks.forEach((task: any) => {
        const taskKey = `${task.id}-${columnId}`;
        const etiquetas = task.labels || [];
        if (etiquetas.length > 0) {
          labelsMapNuevo[taskKey] = etiquetas;
        }
      });
    }
    if (Object.keys(labelsMapNuevo).length > 0) {
      setLabelsMap((prev) => ({
        ...prev,
        ...labelsMapNuevo,
      }));
    }
  };

  return {
    labelsMap,
    newLabel,
    setNewLabel,
    activeLabels,
    trimmedNewLabel,
    isNewLabelDuplicate,
    toggleLabel,
    addCustomLabel,
    removeLabelFromTask,
    migrateLabels,
    initializeLabelsFromTasks,
    setLabelsMap,
  };
}
