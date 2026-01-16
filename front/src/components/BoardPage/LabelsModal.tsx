import React from 'react';
import { BoardTaskItem } from './types';
import { LABEL_PRESETS } from './boardData';

type LabelsModalProps = {
  task: BoardTaskItem;
  columnId: string;
  activeLabels: string[];
  newLabel: string;
  trimmedNewLabel: string;
  isNewLabelDuplicate: boolean;
  onClose: () => void;
  onToggleLabel: (label: string) => void;
  onChangeNewLabel: (value: string) => void;
  onAddCustomLabel: () => void;
};

const LabelsModal: React.FC<LabelsModalProps> = ({
  task,
  columnId,
  activeLabels,
  newLabel,
  trimmedNewLabel,
  isNewLabelDuplicate,
  onClose,
  onToggleLabel,
  onChangeNewLabel,
  onAddCustomLabel,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 md:px-8">
    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Etiquetas</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{task.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
          aria-label="Cerrar etiquetas"
        >
          ×
        </button>
      </header>

      <section className="mt-4 space-y-4 text-sm text-slate-600">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Etiquetas rápidas</h4>
          <div className="mt-4 space-y-3">
            {LABEL_PRESETS.map((group) => (
              <div key={group.id} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
                <div className="flex flex-wrap gap-2">
                  {group.labels.map((label) => {
                    const isSelected = activeLabels.some((item) => item.toLowerCase() === label.toLowerCase());
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onToggleLabel(label)}
                        aria-pressed={isSelected}
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                          isSelected
                            ? 'border border-blue-300 bg-blue-50 text-blue-600 shadow-sm'
                            : 'border border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5">
          {activeLabels.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeLabels.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onToggleLabel(label)}
                  className="group inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-600 transition hover:border-blue-300 hover:bg-blue-100"
                >
                  <span>{label}</span>
                  <span className="text-base font-semibold text-blue-400 group-hover:text-rose-500">×</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              No hay etiquetas seleccionadas. Usa las etiquetas rápidas o añade una nueva.
            </p>
          )}
        </div>
      </section>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Añadir etiqueta</h4>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(event) => onChangeNewLabel(event.target.value)}
              placeholder="Nombre de la etiqueta"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
            />
            <button
              type="button"
              onClick={onAddCustomLabel}
              className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={trimmedNewLabel === '' || isNewLabelDuplicate}
            >
              Añadir
            </button>
          </div>
          {isNewLabelDuplicate && (
            <p className="mt-2 text-xs text-rose-500">Esa etiqueta ya está asignada a esta tarea.</p>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default LabelsModal;

