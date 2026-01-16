import React from 'react';
import { BoardTaskItem } from './types';

type CommentsModalProps = {
  task: BoardTaskItem;
  columnId: string;
  comments: string[];
  commentDraft: string;
  onClose: () => void;
  onChangeDraft: (value: string) => void;
  onAddComment: () => void;
  onDeleteComment: (taskId: string, columnId: string, index: number) => void;
};

const CommentsModal: React.FC<CommentsModalProps> = ({
  task,
  columnId,
  comments,
  commentDraft,
  onClose,
  onChangeDraft,
  onAddComment,
  onDeleteComment,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 md:px-8">
    <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl shadow-slate-900/20">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Comentarios</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{task.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
          aria-label="Cerrar comentarios"
        >
          ×
        </button>
      </header>

      <section className="mt-4 space-y-4">
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-500">No hay comentarios todavía. Sé el primero en compartir una actualización.</p>
          ) : (
            <ul className="space-y-2 text-xs text-slate-600">
              {comments.map((message, index) => (
                <li
                  key={`${task.id}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                  <span className="flex-1 text-left">{message}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteComment(task.id, columnId, index)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                    aria-label="Eliminar comentario"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onAddComment();
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="comment-input">
            Añadir comentario
          </label>
          <textarea
            id="comment-input"
            value={commentDraft}
            onChange={(event) => onChangeDraft(event.target.value)}
            placeholder="Escribe una actualización o pregunta..."
            className="min-h-[100px] resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onChangeDraft('')}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Limpiar
            </button>
            <button
              type="submit"
              className="rounded-full bg-blue-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={commentDraft.trim() === ''}
            >
              Publicar
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
);

export default CommentsModal;

