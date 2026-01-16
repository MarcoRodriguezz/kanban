import React from 'react';

type ReportsHeroProps = {
  projectName: string;
};

const ReportsHero: React.FC<ReportsHeroProps> = ({ projectName }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-900/5">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Proyecto</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{projectName}</h2>
      </div>
    </div>
    <p className="mt-4 max-w-3xl text-sm text-slate-600">
      Revisa el rendimiento del proyecto, tiempos de entrega, capacidad del equipo y posibles cuellos de botella. Usa esta vista
      para anticipar riesgos y ajustar la planificación de los próximos sprints.
    </p>
  </section>
);

export default ReportsHero;

