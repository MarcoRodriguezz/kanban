import React from 'react';

type BacklogsHeroProps = {
  projectName: string;
};

const BacklogsHero: React.FC<BacklogsHeroProps> = ({ projectName }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Proyecto</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{projectName}</h2>
      </div>
    </div>
    <p className="mt-4 max-w-3xl text-sm text-slate-600">
      Revisa el historial de movimientos del backlog: creación y edición de tareas, cambios de estado, asignaciones y
      etiquetados recientes. Cada entrada muestra quién realizó la acción y qué impacto tuvo sobre la tarea.
    </p>
  </section>
);

export default BacklogsHero;

