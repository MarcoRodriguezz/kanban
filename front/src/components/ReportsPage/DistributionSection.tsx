import React from 'react';
import type { DistributionItem } from './types';

type DistributionSectionProps = {
  items: DistributionItem[];
  totalTasks: number;
};

const DistributionSection: React.FC<DistributionSectionProps> = ({ items, totalTasks }) => (
  <article className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
    <header className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Distribución por estado</h3>
        <p className="text-xs text-slate-500">Detalle de tareas activas agrupadas según su estado actual en el tablero.</p>
      </div>
      <span className="text-xs font-semibold text-slate-400">Últimos 30 días</span>
    </header>

    {items.length > 0 && totalTasks > 0 ? (
      <ul className="mt-6 space-y-3 text-xs text-slate-500">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${item.colorClass}`} />
                <span className="text-sm font-semibold text-slate-800">{item.label}</span>
              </div>
              <span className="text-xs text-slate-400">
                {item.value} {item.value === 1 ? 'tarea' : 'tareas'} · {item.percentage}%
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white shadow-inner shadow-slate-900/5">
              <div className={`h-full rounded-full ${item.colorClass}`} style={{ width: `${item.percentage}%` }} />
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-xs text-slate-400">
        No hay tareas registradas en este proyecto para calcular la distribución.
      </div>
    )}
  </article>
);

export default DistributionSection;

