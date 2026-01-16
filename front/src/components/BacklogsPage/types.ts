export type BacklogActionType =
  | 'create-task'
  | 'assign-task'
  | 'update-status'
  | 'comment'
  | 'add-label'
  | 'edit-task'
  | 'delete-task';

export type BacklogEntry = {
  id: string;
  timestamp: string;
  author: string;
  actorInitials: string;
  action: BacklogActionType;
  taskId: string;
  taskTitle: string;
  from?: string;
  to?: string;
  notes?: string;
};

export type BacklogActivityGroup = {
  date: string;
  entries: BacklogEntry[];
};

export type ActionFilter = {
  id: 'all' | BacklogActionType;
  label: string;
};

