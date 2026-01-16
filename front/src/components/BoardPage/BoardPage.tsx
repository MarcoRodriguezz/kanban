import React, { useState, useEffect, useMemo } from 'react';
import Sidebar, { SidebarProject, DEFAULT_PROJECTS } from '../Sidebar/Sidebar';
import Header, { HeaderProps } from '../Header/Header';
import BoardFilters from './BoardFilters';
import BoardColumn from './BoardColumn';
import TaskDetailOverlay from './TaskDetailOverlay';
import AttachmentModal from './AttachmentModal';
import CommentsModal from './CommentsModal';
import LabelsModal from './LabelsModal';
import DeleteTaskModal from './DeleteTaskModal';
import LogoutConfirmModal from './LogoutConfirmModal';
import { BOARD_COLUMNS } from './boardData';
import { BoardTaskItem } from './types';
import { KanbanTaskItem } from '../../services/api';
import { useBoardTasks } from './hooks/useBoardTasks';
import { useTaskModals } from './hooks/useTaskModals';
import { useProjectMembers } from './hooks/useProjectMembers';
import { useTaskFilters } from './hooks/useTaskFilters';
import { useTaskLabels } from './hooks/useTaskLabels';
import { useTaskComments } from './hooks/useTaskComments';
import { useTaskAttachments } from './hooks/useTaskAttachments';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { getInitials } from './utils/taskFormatters';
import { resolveColumnIdByStatus } from './utils/taskHelpers';
type BoardPageProps = {
  project?: SidebarProject | null;
  projects?: SidebarProject[];
  selectedId: string;
  onSelect: (projectId: string) => void;
  onBack?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  initialTaskRef?: { taskId: string; columnId?: string } | null;
  onInitialTaskHandled?: () => void;
  currentUser?: {
    name: string;
    initials: string;
    id?: string;
    rol?: string;
  };
  headerNotifications?: HeaderProps['notifications'];
};
const BoardPage: React.FC<BoardPageProps> = ({
  project,
  projects = DEFAULT_PROJECTS,
  selectedId,
  onSelect,
  onBack,
  onProfileClick,
  onLogout,
  initialTaskRef,
  onInitialTaskHandled,
  currentUser: currentUserProp,
  headerNotifications,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BoardTaskItem | null>(null);
  const [selectedTaskColumn, setSelectedTaskColumn] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<BoardTaskItem | null>(null);
  const [isEditingTask, setIsEditingTask] = useState(false);
  // Hooks
  const { projectMembers, projectManagerId } = useProjectMembers(project?.id);
  const {
    priorityFilter,
    assigneeFilter,
    setPriorityFilter,
    setAssigneeFilter,
    resetFilters,
    filterTasks,
    isFiltering,
  } = useTaskFilters();
  const {
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
  } = useTaskModals();
  const {
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
  } = useTaskLabels(selectedTask, selectedTaskColumn, project?.id);
  const {
    commentDraft,
    setCommentDraft,
    currentComments,
    addComment,
    deleteComment,
    removeCommentsFromTask,
    migrateComments,
  } = useTaskComments(selectedTask, selectedTaskColumn);
  const {
    currentAttachments,
    uploadFiles,
    removeAttachment,
    removeAttachmentsFromTask,
    migrateAttachments,
    formatBytes,
  } = useTaskAttachments(selectedTask, selectedTaskColumn);
  
  // La migración de datos ya no es necesaria - el backend maneja todo automáticamente
  // cuando cambia el estado de una tarea. Los comentarios y attachments están asociados
  // a la tarea, no a la columna.
  const handleDataMigration = (oldKey: string, newKey: string) => {
    // Solo migrar labels que aún usan el sistema de claves local
    migrateLabels(oldKey, newKey);
  };
  const {
    boardTasks,
    findTaskById,
    addTask,
    deleteTaskById,
    saveTaskChanges,
    assignTaskToCurrentUser,
    moveTaskToColumn,
  } = useBoardTasks(
    project?.id,
    (taskId: string) => {
      if (selectedTask?.id === taskId) {
        handleCloseTask();
      }
    },
    (tasksData: Record<string, KanbanTaskItem[]>) => {
      initializeLabelsFromTasks(tasksData);
    }
  );
  const { handleDragStart, handleDragEnd, handleDrop } = useDragAndDrop(
    moveTaskToColumn,
    handleDataMigration
  );
  const currentUser = useMemo(
    () => currentUserProp ?? { name: 'María Sánchez', initials: 'MS' },
    [currentUserProp]
  );
  const selectedMemberId = useMemo(() => {
    if (!taskDraft) {
      return 'custom';
    }
    if (taskDraft.owner === 'Sin asignar') {
      return 'na';
    }
    const member = projectMembers.find((pm) => pm.name === taskDraft.owner);
    return member?.id ?? 'custom';
  }, [taskDraft, projectMembers]);
  const isTaskDraftDirty = useMemo(() => {
    if (!taskDraft || !selectedTask) {
      return false;
    }
    return (
      taskDraft.title !== selectedTask.title ||
      taskDraft.description !== selectedTask.description ||
      taskDraft.status !== selectedTask.status ||
      taskDraft.priority !== selectedTask.priority ||
      taskDraft.owner !== selectedTask.owner ||
      taskDraft.due !== selectedTask.due ||
      taskDraft.createdAt !== selectedTask.createdAt ||
      taskDraft.updatedAt !== selectedTask.updatedAt
    );
  }, [selectedTask, taskDraft]);
  // Manejar initialTaskRef
  useEffect(() => {
    if (!initialTaskRef) {
      return;
    }
    const found = findTaskById(initialTaskRef.taskId, initialTaskRef.columnId);
    if (found) {
      setSelectedTask(found.task);
      setSelectedTaskColumn(found.columnId);
      setTaskDraft({ ...found.task });
      setIsEditingTask(false);
      closeAllModals();
      setNewLabel('');
    }
    onInitialTaskHandled?.();
  }, [findTaskById, initialTaskRef, onInitialTaskHandled, closeAllModals, setNewLabel]);
  const handleAddTask = async () => {
    if (!project?.id) {
      alert('No se pudo identificar el proyecto. Por favor, recarga la página.');
      return;
    }
    const taskItem = await addTask(project.id);
    if (taskItem) {
      const columnId = resolveColumnIdByStatus(taskItem.status) ?? 'pending';
      setSelectedTask(taskItem);
      setSelectedTaskColumn(columnId);
      setTaskDraft({ ...taskItem });
      setIsEditingTask(true);
    }
  };
  const handleOpenTask = (columnId: string, taskId: string) => {
    const task = boardTasks[columnId]?.find((item: BoardTaskItem) => item.id === taskId);
    if (!task) {
      return;
    }
    setSelectedTask(task);
    setSelectedTaskColumn(columnId);
    setTaskDraft({ ...task });
    setIsEditingTask(false);
  };
  const handleCloseTask = () => {
    setSelectedTask(null);
    setSelectedTaskColumn(null);
    setTaskDraft(null);
    setIsEditingTask(false);
    closeAllModals();
    setNewLabel('');
  };
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    const { taskId, columnId } = taskToDelete;
    await deleteTaskById(taskId, columnId, (taskKey: string) => {
      removeCommentsFromTask();
      removeAttachmentsFromTask();
      removeLabelFromTask(taskId, columnId);
    });
    cancelDeleteTask();
  };
  const handleSaveTaskChanges = async () => {
    if (!taskDraft || !selectedTask || !selectedTaskColumn || !project?.id) {
      return;
    }
    const result = await saveTaskChanges(
      taskDraft,
      selectedTask,
      selectedTaskColumn,
      project.id,
      activeLabels,
      handleDataMigration
    );
    if (result) {
      const { updatedTask, targetColumnId } = result;
      setSelectedTask(updatedTask);
      setSelectedTaskColumn(targetColumnId);
      setTaskDraft({ ...updatedTask });
      setIsEditingTask(false);
    }
  };
  const handleSelectMember = (memberId: string) => {
    if (memberId === 'na' || memberId === 'custom') {
      setTaskDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          owner: 'Sin asignar',
          avatar: 'NA',
          assigneeId: '',
        };
      });
      return;
    }
    const projectMember = projectMembers.find((pm) => pm.id === memberId);
    if (!projectMember) {
      return;
    }
    const initials = getInitials(projectMember.name);
    setTaskDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        owner: projectMember.name,
        avatar: initials,
        assigneeId: projectMember.id,
      };
    });
  };
  const handleResetTaskDraft = () => {
    if (selectedTask) {
      setTaskDraft({ ...selectedTask });
    }
  };
  const handleStartTaskEditing = () => {
    if (!selectedTask) {
      return;
    }
    setTaskDraft({ ...selectedTask });
    setIsEditingTask(true);
  };
  const handleCancelTaskEditing = () => {
    handleResetTaskDraft();
    setIsEditingTask(false);
  };
  const handleAssignToCurrentUser = async () => {
    if (!selectedTask || !selectedTaskColumn) {
      return;
    }
    const updatedTask = await assignTaskToCurrentUser(selectedTask, selectedTaskColumn);
    if (updatedTask) {
      setSelectedTask(updatedTask);
      setTaskDraft({ ...updatedTask });
    }
  };
  const handleTaskDraftChange = <K extends keyof BoardTaskItem>(field: K, value: BoardTaskItem[K]) => {
    setTaskDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        projects={projects}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogoutRequest={() => setShowLogoutConfirm(true)}
        onSelect={onSelect}
        selectedId={selectedId}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header
          title="Board"
          onBack={onBack}
          onProfileClick={onProfileClick}
          notifications={headerNotifications}
        />
        <main className="flex flex-1 flex-col overflow-hidden p-8">
          <section className="flex h-full flex-col gap-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
            <div className="border-b border-slate-200 px-6 py-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                    {project ? project.name : 'Tablero principal'}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <BoardFilters
                    priorityFilter={priorityFilter}
                    assigneeFilter={assigneeFilter}
                    onPriorityChange={setPriorityFilter}
                    onAssigneeChange={setAssigneeFilter}
                    onReset={resetFilters}
                    projectMembers={projectMembers}
                  />
                  <button
                    type="button"
                    onClick={handleAddTask}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
                  >
                    <span className="text-base">+</span>
                    <span>Agregar tarea</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-x-auto">
                <div className="grid h-full min-w-[960px] grid-cols-1 gap-5 px-6 py-6 md:grid-cols-2 xl:grid-cols-4">
                  {BOARD_COLUMNS.map((column) => {
                    const columnAllTasks = boardTasks[column.id] ?? [];
                    const filteredTasks = filterTasks(columnAllTasks);
                    return (
                      <BoardColumn
                        key={column.id}
                        column={column}
                        tasks={filteredTasks}
                        totalCount={columnAllTasks.length}
                        isFiltering={isFiltering}
                        onDrop={handleDrop}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onOpenTask={handleOpenTask}
                        onDeleteTask={requestDeleteTask}
                        currentUser={currentUser ? { id: currentUser.id, rol: currentUser.rol } : undefined}
                        projectManagerId={projectManagerId}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout?.();
        }}
      />
      {selectedTask && selectedTaskColumn && taskDraft && (
        <TaskDetailOverlay
          task={selectedTask}
          taskDraft={taskDraft}
          isEditing={isEditingTask}
          isTaskDraftDirty={isTaskDraftDirty}
          selectedMemberId={selectedMemberId}
          projectMembers={projectMembers}
          currentAttachments={currentAttachments}
          formatBytes={formatBytes}
          onClose={handleCloseTask}
          onStartEdit={handleStartTaskEditing}
          onCancelEdit={handleCancelTaskEditing}
          onSaveTask={handleSaveTaskChanges}
          onResetDraft={handleResetTaskDraft}
          onTaskDraftChange={handleTaskDraftChange}
          onSelectMember={handleSelectMember}
          onAssignToCurrentUser={handleAssignToCurrentUser}
          onOpenAttachments={openAttachmentsModal}
          onOpenComments={openCommentsModal}
          onOpenLabels={openLabelsModal}
          currentUser={currentUser ? { id: currentUser.id, rol: currentUser.rol } : undefined}
          projectManagerId={projectManagerId}
        />
      )}
      {showAttachModal && selectedTask && selectedTaskColumn && (
        <AttachmentModal
          task={selectedTask}
          columnId={selectedTaskColumn}
          attachments={currentAttachments}
          formatBytes={formatBytes}
          onClose={() => setShowAttachModal(false)}
          onUploadFiles={uploadFiles}
          onRemoveAttachment={removeAttachment}
        />
      )}
      {showCommentsModal && selectedTask && selectedTaskColumn && (
        <CommentsModal
          task={selectedTask}
          columnId={selectedTaskColumn}
          comments={currentComments}
          commentDraft={commentDraft}
          onClose={() => setShowCommentsModal(false)}
          onChangeDraft={setCommentDraft}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
        />
      )}
      {showLabelsModal && selectedTask && selectedTaskColumn && (
        <LabelsModal
          task={selectedTask}
          columnId={selectedTaskColumn}
          activeLabels={activeLabels}
          newLabel={newLabel}
          trimmedNewLabel={trimmedNewLabel}
          isNewLabelDuplicate={isNewLabelDuplicate}
          onClose={() => {
            setShowLabelsModal(false);
            setNewLabel('');
          }}
          onToggleLabel={toggleLabel}
          onChangeNewLabel={setNewLabel}
          onAddCustomLabel={addCustomLabel}
        />
      )}
      <DeleteTaskModal
        isOpen={showDeleteConfirm}
        onClose={cancelDeleteTask}
        onConfirm={handleDeleteTask}
      />
    </div>
  );
};
export default BoardPage;

