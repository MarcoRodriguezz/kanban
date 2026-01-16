import { useState, useEffect, useMemo } from 'react';
import { BoardTaskItem } from '../types';
import { formatBytes } from '../utils/taskFormatters';
import { getTaskAttachments, uploadTaskFile, deleteTaskFile, Attachment } from '../../../services/api';
import { getNumericTaskId } from '../utils/taskHelpers';

export function useTaskAttachments(
  selectedTask: BoardTaskItem | null,
  selectedTaskColumn: string | null
) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Cargar archivos del backend cuando se selecciona una tarea
  useEffect(() => {
    if (!selectedTask) {
      setAttachments([]);
      return;
    }

    const loadAttachments = async () => {
      setIsLoadingAttachments(true);
      try {
        const numericId = getNumericTaskId(selectedTask.id);
        if (!numericId || isNaN(Number(numericId))) {
          console.warn('ID de tarea inválido para cargar archivos:', selectedTask.id);
          return;
        }
        const loadedAttachments = await getTaskAttachments(numericId);
        setAttachments(loadedAttachments);
      } catch (error: any) {
        if (error.message && !error.message.includes('no encontrado') && !error.message.includes('404')) {
          console.error('Error cargando archivos:', error);
        }
        setAttachments([]);
      } finally {
        setIsLoadingAttachments(false);
      }
    };

    loadAttachments();
  }, [selectedTask?.id]);

  const currentAttachments = useMemo(() => {
    return attachments.map(a => ({ name: a.name, size: a.size }));
  }, [attachments]);

  const uploadFiles = async (files: FileList) => {
    if (!selectedTask || files.length === 0) {
      return;
    }

    setIsUploading(true);
    try {
      const numericId = getNumericTaskId(selectedTask.id);
      if (!numericId || isNaN(Number(numericId))) {
        console.error('ID de tarea inválido:', selectedTask.id);
        return;
      }

      // Subir archivos uno por uno
      const uploadPromises = Array.from(files).map(file => uploadTaskFile(numericId, file));
      const uploadedFiles = await Promise.all(uploadPromises);
      
      // Actualizar la lista de archivos
      setAttachments((prev) => [...uploadedFiles, ...prev]);
    } catch (error: any) {
      console.error('Error subiendo archivos:', error);
      const errorMessage = error.message || 'Error al subir los archivos. Por favor, intenta de nuevo.';
      if (error.tamañoActualMB !== undefined) {
        alert(`${errorMessage}\nTamaño actual: ${error.tamañoActualMB}MB\nLímite: ${error.límiteMB}MB`);
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = async (taskId: string, columnId: string, index: number) => {
    const attachmentToDelete = attachments[index];
    if (!attachmentToDelete) {
      return;
    }

    try {
      await deleteTaskFile(attachmentToDelete.id);
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error eliminando archivo:', error);
      alert('Error al eliminar el archivo. Por favor, intenta de nuevo.');
    }
  };

  // Estas funciones ya no son necesarias porque el backend maneja todo
  // pero las mantenemos por compatibilidad con el código existente
  const removeAttachmentsFromTask = () => {
    // No hacer nada - el backend maneja la eliminación cuando se elimina la tarea
  };

  const migrateAttachments = () => {
    // No hacer nada - el backend maneja automáticamente cuando cambia el estado de la tarea
    // Los archivos están asociados a la tarea, no a la columna
  };

  return {
    attachments,
    currentAttachments,
    isLoadingAttachments,
    isUploading,
    uploadFiles,
    removeAttachment,
    removeAttachmentsFromTask,
    migrateAttachments,
    formatBytes,
  };
}