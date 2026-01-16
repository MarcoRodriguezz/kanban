import React from 'react';
import type { PerformanceItem } from './types';

type PerformanceSectionProps = {
  rows: PerformanceItem[];
};

const PerformanceSection: React.FC<PerformanceSectionProps> = ({ rows }) => (
  <article className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
    <header className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Rendimiento semanal</h3>
        <p className="text-xs text-slate-500">Tareas resueltas frente a nuevas solicitudes y pendientes de cierre.</p>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Resueltas
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          Nuevas
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Pendientes
        </span>
      </div>
    </header>

    {rows.length > 0 ? (
      <ul className="mt-6 space-y-3 text-xs text-slate-500">
        {rows.map((item) => (
          <li key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
              <span>{item.label}</span>
              <span className="text-xs text-slate-400">
                {item.completed} / {item.new} / {item.pending}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
              <div className="rounded-xl bg-white px-3 py-2 shadow-inner shadow-emerald-500/10">
                <span className="font-semibold text-emerald-600">{item.completed}</span>
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">Resueltas</span>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-inner shadow-blue-500/10">
                <span className="font-semibold text-blue-500">{item.new}</span>
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">Nuevas</span>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 shadow-inner shadow-amber-500/10">
                <span className="font-semibold text-amber-500">{item.pending}</span>
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">Pendientes</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-xs text-slate-400">
        Aún no hay actividad semanal registrada para este proyecto.
      </div>
    )}
  </article>
);

export default PerformanceSection;

