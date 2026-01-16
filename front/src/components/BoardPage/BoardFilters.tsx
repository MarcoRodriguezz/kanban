import React from 'react';
import { PRIORITY_OPTIONS } from './boardData';
import { BoardTaskItem } from './types';
import { MiembroProyecto } from '../../services/api';

type BoardFiltersProps = {
  priorityFilter: 'all' | BoardTaskItem['priority'];
  assigneeFilter: 'all' | string;
  onPriorityChange: (value: 'all' | BoardTaskItem['priority']) => void;
  onAssigneeChange: (value: 'all' | string) => void;
  onReset: () => void;
  projectMembers?: MiembroProyecto[];
};

const BoardFilters: React.FC<BoardFiltersProps> = ({
  priorityFilter,
  assigneeFilter,
  onPriorityChange,
  onAssigneeChange,
  onReset,
  projectMembers = [],
}) => {
  const [showFilters, setShowFilters] = React.useState(false);
  const [openSection, setOpenSection] = React.useState<'priority' | 'assignee' | null>(null);

  const renderDropdownSection = (
    title: string,
    section: 'priority' | 'assignee',
    content: React.ReactNode
  ) => (
    <div className="rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpenSection((prev) => (prev === section ? null : section))}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        <span>{title}</span>
        <span className="text-[11px] text-slate-400">{openSection === section ? '▲' : '▼'}</span>
      </button>
      {openSection === section && (
        <div className="border-t border-slate-200 px-3 py-3 text-xs text-slate-500">{content}</div>
      )}
    </div>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowFilters((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
      >
        <span>Filtros</span>
        <span className="text-[11px] text-slate-400">{showFilters ? '▲' : '▼'}</span>
      </button>

      {showFilters && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[320px] space-y-3 rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-xl shadow-slate-900/10">
          {renderDropdownSection(
            'Prioridad',
            'priority',
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onPriorityChange('all')}
                className={`flex w-full items-center justify-between rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  priorityFilter === 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-600'
                    : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                Todas
              </button>
              {PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => onPriorityChange(priority)}
                  className={`flex w-full items-center justify-between rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    priorityFilter === priority
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}

          {renderDropdownSection(
            'Asignado a',
            'assignee',
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onAssigneeChange('all')}
                className={`flex w-full items-center justify-between rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  assigneeFilter === 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-600'
                    : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => onAssigneeChange('Sin asignar')}
                className={`flex w-full items-center justify-between rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  assigneeFilter === 'Sin asignar'
                    ? 'border-blue-300 bg-blue-50 text-blue-600'
                    : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                Sin asignar
              </button>
              {projectMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onAssigneeChange(member.name)}
                  className={`flex w-full items-center justify-between rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    assigneeFilter === member.name
                      ? 'border-blue-300 bg-blue-50 text-blue-600'
                      : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                  }`}
                >
                  {member.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpenSection(null);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoardFilters;

