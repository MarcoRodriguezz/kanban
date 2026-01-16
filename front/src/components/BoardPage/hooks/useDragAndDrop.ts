import { useState } from 'react';
import { moveTask } from '../../../services/api';

export function useDragAndDrop(
  onMoveTask: (taskId: string, sourceColumnId: string, targetColumnId: string, onDataMigration?: (oldKey: string, newKey: string) => void) => void,
  onDataMigration?: (oldKey: string, newKey: string) => void
) {
  const [draggedTask, setDraggedTask] = useState<{ columnId: string; taskId: string } | null>(null);

  const handleDragStart = (columnId: string, taskId: string) => {
    setDraggedTask({ columnId, taskId });
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDrop = (targetColumnId: string) => {
    if (!draggedTask) {
      return;
    }

    const { columnId, taskId } = draggedTask;

    // Mover la tarea localmente
    onMoveTask(taskId, columnId, targetColumnId, onDataMigration);

    // Si cambió de columna, actualizar en el backend usando directamente el columnId
    if (columnId !== targetColumnId) {
      moveTask(taskId, targetColumnId).catch((error) => {
        console.error('Error actualizando estado de tarea:', error);
      });
    }

    setDraggedTask(null);
  };

  return {
    draggedTask,
    handleDragStart,
    handleDragEnd,
    handleDrop,
  };
}