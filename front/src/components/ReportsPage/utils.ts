import { COLUMN_ORDER, SPANISH_MONTHS } from './constants';
import type { WeeklySummary } from './types';

export const parseSpanishDate = (value: string): Date | null => {
  if (!value || value === 'Sin fecha') {
    return null;
  }

  // Intentar parsear como fecha ISO primero (formato del backend)
  const isoDate = new Date(value);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Si falla, intentar parsear como fecha en español (formato "15 nov 2024")
  const [dayStr, monthAbbr, yearStr] = value.split(' ');
  if (!dayStr || !monthAbbr || !yearStr) {
    return null;
  }

  const monthIndex = SPANISH_MONTHS[monthAbbr];
  if (monthIndex === undefined) {
    return null;
  }

  const day = Number.parseInt(dayStr, 10);
  const year = Number.parseInt(yearStr, 10);
  if (Number.isNaN(day) || Number.isNaN(year)) {
    return null;
  }

  const date = new Date(year, monthIndex, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getWeekStart = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const formatWeekLabel = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });
  const formatted = formatter.format(date);
  return `Semana del ${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
};

export const formatMonthLabel = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('es-ES', { month: 'short' });
  const formatted = formatter.format(date);
  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)}`;
};

