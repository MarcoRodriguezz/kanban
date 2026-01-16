import React from 'react';
import { ACTION_COLORS, ACTION_LABELS } from './constants';
import type { BacklogActivityGroup } from './types';

type BacklogActivityListProps = {
  groups: BacklogActivityGroup[];
};

const BacklogActivityList: React.FC<BacklogActivityListProps> = ({ groups }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-900/5">
    <div className="mt-6 space-y-6">
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">
          No se registran movimientos para este filtro.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.date} className="space-y-4">
            <div className="sticky top-20 z-10 inline-flex rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-slate-900/10">
              {group.date}
            </div>
            <ul className="space-y-3">
              {group.entries.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 text-sm shadow-sm shadow-slate-900/5 ${ACTION_COLORS[entry.action]}`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/70 text-sm font-semibold text-slate-700">
                        {entry.actorInitials}
                      </span>
                      {entry.author}
                    </span>
                    <span>{entry.timestamp}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-slate-700">
                    <span className="font-semibold">
                      {ACTION_LABELS[entry.action]} · {entry.taskId}
                    </span>
                    <span className="font-medium text-slate-800">{entry.taskTitle}</span>
                  </div>
                  {(entry.from || entry.to) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      {entry.from && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 font-medium">
                          <span className="text-slate-500">De:</span>
                          <span className="text-slate-700">{entry.from}</span>
                        </span>
                      )}
                      {entry.to && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1 font-medium">
                          <span className="text-slate-500">{entry.from ? '→' : entry.action === 'assign-task' ? 'Asignado a:' : entry.action === 'add-label' ? 'Etiqueta:' : 'A:'}</span>
                          <span className="text-slate-700">{entry.to}</span>
                        </span>
                      )}
                    </div>
                  )}
                  {entry.notes && (
                    <p className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2 text-xs leading-relaxed text-slate-600">
                      {entry.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  </section>
);

export default BacklogActivityList;

