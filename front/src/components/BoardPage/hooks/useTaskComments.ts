import { useState, useEffect, useMemo } from 'react';
import { BoardTaskItem } from '../types';
import { getTaskComments, createComment, deleteComment as deleteCommentApi, Comment } from '../../../services/api';
import { getNumericTaskId } from '../utils/taskHelpers';

export function useTaskComments(
  selectedTask: BoardTaskItem | null,
  selectedTaskColumn: string | null
) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);

  // Cargar comentarios del backend cuando se selecciona una tarea
  useEffect(() => {
    if (!selectedTask) {
      setComments([]);
      return;
    }

    const loadComments = async () => {
      setIsLoadingComments(true);
      try {
        const numericId = getNumericTaskId(selectedTask.id);
        if (!numericId || isNaN(Number(numericId))) {
          console.warn('ID de tarea inválido para cargar comentarios:', selectedTask.id);
          return;
        }
        const loadedComments = await getTaskComments(numericId);
        setComments(loadedComments);
      } catch (error: any) {
        if (error.message && !error.message.includes('no encontrado') && !error.message.includes('404')) {
          console.error('Error cargando comentarios:', error);
        }
        setComments([]);
      } finally {
        setIsLoadingComments(false);
      }
    };

    loadComments();
  }, [selectedTask?.id]);

  // Devolver comentarios completos para mostrar información del usuario
  const currentComments = useMemo(() => {
    return comments.map(c => c.content);
  }, [comments]);
  
  // También exponer los comentarios completos por si se necesitan
  const commentsWithUserInfo = comments;

  const addComment = async () => {
    if (!selectedTask || commentDraft.trim() === '') {
      return;
    }

    try {
      const numericId = getNumericTaskId(selectedTask.id);
      if (!numericId || isNaN(Number(numericId))) {
        console.error('ID de tarea inválido:', selectedTask.id);
        return;
      }

      const newComment = await createComment(numericId, commentDraft.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentDraft('');
    } catch (error) {
      console.error('Error creando comentario:', error);
      alert('Error al crear el comentario. Por favor, intenta de nuevo.');
    }
  };

  const deleteComment = async (taskId: string, columnId: string, index: number) => {
    const commentToDelete = comments[index];
    if (!commentToDelete) {
      return;
    }

    try {
      await deleteCommentApi(commentToDelete.id);
      setComments((prev) => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error('Error eliminando comentario:', error);
      alert('Error al eliminar el comentario. Por favor, intenta de nuevo.');
    }
  };

  // Estas funciones ya no son necesarias porque el backend maneja todo
  // pero las mantenemos por compatibilidad con el código existente
  const removeCommentsFromTask = () => {
    // No hacer nada - el backend maneja la eliminación cuando se elimina la tarea
  };

  const migrateComments = () => {
    // No hacer nada - el backend maneja automáticamente cuando cambia el estado de la tarea
    // Los comentarios están asociados a la tarea, no a la columna
  };

  return {
    comments: commentsWithUserInfo,
    commentDraft,
    setCommentDraft,
    currentComments,
    isLoadingComments,
    addComment,
    deleteComment,
    removeCommentsFromTask,
    migrateComments,
  };
}