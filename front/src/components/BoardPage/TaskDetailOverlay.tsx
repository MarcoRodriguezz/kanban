import React from 'react';
import { BoardTaskItem } from './types';
import {
  PRIORITY_BADGE_STYLES,
  PRIORITY_OPTIONS,
  STATUS_BADGE_STYLES,
} from './boardData';
import DatePicker from './DatePicker';
import { canEditTask } from '../../services/api';

const formatToISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const convertToDateInput = (displayDate: string): string => {
  if (!displayDate || displayDate === 'Sin fecha') {
    return '';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const months: Record<string, number> = {
    'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11,
  };
  
  if (displayDate === 'Hoy') {
    return formatToISO(today);
  }
  
  const parts = displayDate.toLowerCase().trim().split(' ');
  if (parts.length === 2 && months[parts[1]]) {
    const day = parseInt(parts[0], 10);
    const month = months[parts[1]];
    const year = today.getFullYear();
    const date = new Date(year, month, day);
    if (date < today) {
      date.setFullYear(year + 1);
    }
    return formatToISO(date);
  }
  
  return '';
};

const parseISODate = (isoString: string): Date => {
  const [year, month, day] = isoString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const convertToDisplayDate = (isoDate: string): string => {
  if (!isoDate) {
    return 'Sin fecha';
  }
  
  const date = parseISODate(isoDate);
  if (isNaN(date.getTime())) {
    return 'Sin fecha';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  
  if (dateOnly.getTime() === today.getTime()) {
    return 'Hoy';
  }
  
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  
  return `${day} ${month}`;
};

type TaskDetailOverlayProps = {
  task: BoardTaskItem;
  taskDraft: BoardTaskItem;
  isEditing: boolean;
  isTaskDraftDirty: boolean;
  selectedMemberId: string;
  projectMembers: Array<{ id: string; name: string; email: string }>;
  currentAttachments: Array<{ name: string; size: number }>;
  formatBytes: (bytes: number) => string;
  onClose: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveTask: () => void;
  onResetDraft: () => void;
  onTaskDraftChange: <K extends keyof BoardTaskItem>(field: K, value: BoardTaskItem[K]) => void;
  onSelectMember: (memberId: string) => void;
  onAssignToCurrentUser: () => void;
  onOpenAttachments: () => void;
  onOpenComments: () => void;
  onOpenLabels: () => void;
  currentUser?: {
    id?: string;
    rol?: string;
  };
  projectManagerId?: string | null;
};

const TaskDetailOverlay: React.FC<TaskDetailOverlayProps> = ({
  task,
  taskDraft,
  isEditing,
  isTaskDraftDirty,
  selectedMemberId,
  projectMembers,
  currentAttachments,
  formatBytes,
  onClose,
  onStartEdit,
  onCancelEdit,
  onSaveTask,
  onResetDraft,
  onTaskDraftChange,
  onSelectMember,
  onAssignToCurrentUser,
  onOpenAttachments,
  onOpenComments,
  onOpenLabels,
  currentUser,
  projectManagerId,
}) => {
  const [canEdit, setCanEdit] = React.useState<boolean | null>(null);
  const [dateInputValue, setDateInputValue] = React.useState(() => 
    convertToDateInput(taskDraft.due)
  );

  React.useEffect(() => {
    let isMounted = true;
    
    const checkPermissions = async () => {
      try {
        const result = await canEditTask(task.id);
        if (isMounted) {
          setCanEdit(result);
        }
      } catch (error: any) {
        console.error('Error verificando permisos de edición:', error);
        if (isMounted && currentUser?.id) {
          const isAdmin = currentUser.rol === 'Administrador';
          const isCreator = task.createdById && currentUser.id === task.createdById;
          const isManager = projectManagerId && currentUser.id === projectManagerId;
          const fallbackCanEdit = Boolean(isAdmin || isCreator || isManager);
          setCanEdit(fallbackCanEdit);
        } else if (isMounted) {
          setCanEdit(false);
        }
      }
    };
    
    checkPermissions();
    
    return () => {
      isMounted = false;
    };
  }, [task.id, task.createdById, currentUser?.id, currentUser?.rol, projectManagerId]);

  React.useEffect(() => {
    setDateInputValue(convertToDateInput(taskDraft.due));
  }, [taskDraft.due]);

  return (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 md:px-8">
    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20">
      <header className="flex items-start justify-between">
        <div className="w-full pr-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Resumen de tarea</p>
          {isEditing ? (
            <input
              type="text"
              value={taskDraft.title}
              onChange={(event) => onTaskDraftChange('title', event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-2xl font-semibold text-slate-900 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
          ) : (
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{task.title}</h3>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancelar
            </button>
          ) : (
            canEdit === true && (
              <button
                type="button"
                onClick={onStartEdit}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
                  <img src="/img/edit-icon.svg" alt="Editar" className="h-3 w-3" />
                </span>
                Editar
              </button>
            )
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
            aria-label="Cerrar detalle de tarea"
          >
            ×
          </button>
        </div>
      </header>

      {isEditing ? (
        <form
          className="mt-5 space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveTask();
          }}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</span>
              <textarea
                value={taskDraft.description}
                onChange={(event) => onTaskDraftChange('description', event.target.value)}
                className="min-h-[120px] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
          </div>

          <div className="grid gap-4 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Prioridad
                <select
                  value={taskDraft.priority}
                  onChange={(event) => onTaskDraftChange('priority', event.target.value as BoardTaskItem['priority'])}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Asignado a
                <select
                  value={selectedMemberId}
                  onChange={(event) => onSelectMember(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 transition focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="custom" disabled>
                    Selecciona un miembro
                  </option>
                  <option value="na">
                    Sin asignar
                  </option>
                  {projectMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <label className="flex flex-col gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fecha límite
                <DatePicker
                  value={dateInputValue}
                  onChange={(isoDate) => {
                    setDateInputValue(isoDate);
                    // Si isoDate es una cadena vacía o falsy, establecer undefined
                    const normalizedDate = isoDate && isoDate.trim() !== '' ? isoDate : undefined;
                    const displayDate = convertToDisplayDate(normalizedDate || '');
                    // Actualizar tanto el formato de visualización como el formato ISO para el backend
                    onTaskDraftChange('due', displayDate);
                    onTaskDraftChange('dueDate', normalizedDate);
                  }}
                />
              </label>
            </div>
          </div>

          {currentAttachments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Adjuntos</span>
                <button
                  type="button"
                  onClick={onOpenAttachments}
                  className="text-xs font-semibold text-blue-500 transition hover:text-blue-600"
                >
                  Gestionar
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                {currentAttachments.map((file, index) => (
                  <li
                    key={`${task.id}-${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-slate-600">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-blue-500">
                        📎
                      </span>
                      <span className="font-medium">{file.name}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{formatBytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onResetDraft}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
            >
              Restablecer
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isTaskDraftDirty}
            >
              Guardar cambios
            </button>
          </div>
        </form>
      ) : (
        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</h4>
            <p className="mt-2 text-sm text-slate-600">{task.description}</p>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</span>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE_STYLES[task.status]}`}
            >
              {task.status}
            </span>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Prioridad</span>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${PRIORITY_BADGE_STYLES[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Asignado a</span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900/5 text-xs font-semibold text-slate-700">
                {task.avatar}
              </span>
              {task.owner}
            </span>
            {task.owner === 'Sin asignar' && (
              <button
                type="button"
                onClick={onAssignToCurrentUser}
                className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-blue-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300 hover:bg-blue-50"
              >
                Asignarme esta tarea
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha límite</span>
            <span className="text-sm font-semibold text-slate-800">{task.due}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha de creación</span>
            <span className="text-sm font-semibold text-slate-800">{task.createdAt}</span>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última actualización</span>
            <span className="text-sm font-semibold text-slate-800">{task.updatedAt}</span>
          </div>

          {currentAttachments.length > 0 && (
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Adjuntos</span>
                <button
                  type="button"
                  onClick={onOpenAttachments}
                  className="text-xs font-semibold text-blue-500 transition hover:text-blue-600"
                >
                  Ver todos
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                {currentAttachments.map((file, index) => (
                  <li
                    key={`${task.id}-${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-blue-500">
                        📎
                      </span>
                      <span className="font-medium text-slate-700">{file.name}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{formatBytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
        <button
          type="button"
          onClick={onOpenAttachments}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-3 font-semibold uppercase tracking-wide text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
            <img src="/img/add_file-icon.svg" alt="Adjuntar" className="h-3.5 w-3.5" />
          </span>
          Adjuntar archivo
        </button>
        <button
          type="button"
          onClick={onOpenComments}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-3 font-semibold uppercase tracking-wide text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
            <img src="/img/comments-icon.svg" alt="Comentarios" className="h-3.5 w-3.5" />
          </span>
          Comentarios
        </button>
        <button
          type="button"
          onClick={onOpenLabels}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-3 font-semibold uppercase tracking-wide text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
            <img src="/img/tag-icon.svg" alt="Etiquetas" className="h-3.5 w-3.5" />
          </span>
          Etiquetas
        </button>
      </div>
    </div>
  </div>
  );
};

export default TaskDetailOverlay;

