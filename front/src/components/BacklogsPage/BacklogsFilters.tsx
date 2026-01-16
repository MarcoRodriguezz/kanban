import React from 'react';
import type { ActionFilter } from './types';

type BacklogsFiltersProps = {
  filters: ActionFilter[];
  activeFilter: ActionFilter['id'];
  onFilterChange: (filterId: ActionFilter['id']) => void;
  authorSearch: string;
  onAuthorSearchChange: (value: string) => void;
};

const BacklogsFilters: React.FC<BacklogsFiltersProps> = ({
  filters,
  activeFilter,
  onFilterChange,
  authorSearch,
  onAuthorSearchChange,
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-900/5">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Filtrar actividad</h3>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onFilterChange(filter.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 text-blue-600'
                    : 'border-slate-200 text-slate-500 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Autor</span>
          <input
            type="search"
            value={authorSearch}
            onChange={(event) => onAuthorSearchChange(event.target.value)}
            placeholder="Buscar por nombre..."
            className="w-36 bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none"
          />
        </label>
      </div>
    </div>
  </section>
);

export default BacklogsFilters;

