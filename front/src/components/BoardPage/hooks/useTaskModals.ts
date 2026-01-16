import { useState } from 'react';

export function useTaskModals() {
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ taskId: string; columnId: string } | null>(null);

  const openAttachmentsModal = () => {
    setShowAttachModal(true);
    setShowCommentsModal(false);
    setShowLabelsModal(false);
  };

  const openCommentsModal = () => {
    setShowCommentsModal(true);
    setShowAttachModal(false);
    setShowLabelsModal(false);
  };

  const openLabelsModal = () => {
    setShowLabelsModal(true);
    setShowAttachModal(false);
    setShowCommentsModal(false);
  };

  const closeAllModals = () => {
    setShowAttachModal(false);
    setShowCommentsModal(false);
    setShowLabelsModal(false);
  };

  const requestDeleteTask = (taskId: string, columnId: string) => {
    setTaskToDelete({ taskId, columnId });
    setShowDeleteConfirm(true);
  };

  const cancelDeleteTask = () => {
    setShowDeleteConfirm(false);
    setTaskToDelete(null);
  };

  return {
    showAttachModal,
    showCommentsModal,
    showLabelsModal,
    showLogoutConfirm,
    showDeleteConfirm,
    taskToDelete,
    setShowAttachModal,
    setShowCommentsModal,
    setShowLabelsModal,
    setShowLogoutConfirm,
    openAttachmentsModal,
    openCommentsModal,
    openLabelsModal,
    closeAllModals,
    requestDeleteTask,
    cancelDeleteTask,
  };
}
