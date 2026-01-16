import type { BoardTaskItem } from '../BoardPage/types';

export type Trend = 'up' | 'down' | 'neutral';

export type ReportMetric = {
  id: string;
  label: string;
  value: string;
};

export type DistributionItem = {
  id: string;
  label: string;
  value: number;
  percentage: number;
  colorClass: string;
};

export type PerformanceItem = {
  id: string;
  label: string;
  completed: number;
  new: number;
  pending: number;
};

export type ResolutionPoint = {
  month: string;
  value: number;
};

export type WeeklySummary = {
  key: string;
  start: Date;
  newCount: number;
  completedCount: number;
  pendingCount: number;
  completedDurations: number[];
};

export type ColumnId = 'pending' | 'in-progress' | 'review' | 'done';

export type BoardTasksByColumn = Record<ColumnId, BoardTaskItem[]>;

