import React from 'react';
import { BoardTaskItem } from './types';

type AttachmentInfo = { name: string; size: number };

type AttachmentModalProps = {
  task: BoardTaskItem;
  columnId: string;
  attachments: AttachmentInfo[];
  formatBytes: (bytes: number) => string;
  onClose: () => void;
  onUploadFiles: (files: FileList) => void;
  onRemoveAttachment: (taskId: string, columnId: string, index: number) => void;
};

const AttachmentModal: React.FC<AttachmentModalProps> = ({
  task,
  columnId,
  attachments,
  formatBytes,
  onClose,
  onUploadFiles,
  onRemoveAttachment,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 md:px-8">
    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Adjuntar archivos</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{task.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
          aria-label="Cerrar adjuntos"
        >
          ×
        </button>
      </header>

      <section className="mt-4 space-y-5">
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-6 text-center text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Sube archivos relevantes a esta tarea</p>
          <p className="mt-1 text-xs text-slate-400">
            Formatos permitidos: PDF, JPG, PNG. Tamaño máximo 25 MB por archivo.
          </p>

          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full bg-blue-500 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-600">
            <input
              type="file"
              className="hidden"
              multiple
              onChange={(event) => {
                if (event.target.files) {
                  onUploadFiles(event.target.files);
                  event.target.value = '';
                }
              }}
            />
            Seleccionar archivos
          </label>
        </div>

        <div className="space-y-3">
          {attachments.length === 0 ? (
            <p className="text-xs text-slate-500">
              Aún no hay archivos adjuntos. Añade recursos para compartir contexto con tu equipo.
            </p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600">
              {attachments.map((file, index) => (
                <li
                  key={`${task.id}-${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                      <img src="/img/add_file-icon.svg" alt="Archivo" className="h-4 w-4" />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-800">{file.name}</span>
                      <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(task.id, columnId, index)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                    aria-label="Eliminar archivo adjunto"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-6 h-4" />
    </div>
  </div>
);

export default AttachmentModal;

