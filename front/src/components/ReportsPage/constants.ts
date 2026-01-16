import { BOARD_TASKS } from '../BoardPage/boardData';
import type { BoardTaskItem } from '../BoardPage/types';
import type { BoardTasksByColumn, ColumnId } from './types';

export const STATUS_METADATA: Record<ColumnId, { label: string; colorClass: string }> = {
  pending: { label: 'Pendiente', colorClass: 'bg-amber-400' },
  'in-progress': { label: 'En progreso', colorClass: 'bg-blue-500' },
  review: { label: 'En revisión', colorClass: 'bg-purple-500' },
  done: { label: 'Completado', colorClass: 'bg-emerald-500' },
};

export const COLUMN_ORDER: ColumnId[] = ['pending', 'in-progress', 'review', 'done'];

export const SPANISH_MONTHS: Record<string, number> = {
  Ene: 0,
  Feb: 1,
  Mar: 2,
  Abr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Ago: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dic: 11,
};

export const PROJECT_TASK_SNAPSHOTS: Record<string, BoardTasksByColumn> = {
  default: BOARD_TASKS as BoardTasksByColumn,
  marketing: BOARD_TASKS as BoardTasksByColumn,
  desarrollo: BOARD_TASKS as BoardTasksByColumn,
  design: BOARD_TASKS as BoardTasksByColumn,
  ventas: BOARD_TASKS as BoardTasksByColumn,
};

