import React from 'react';
import type { ReportMetric } from './types';

type MetricsGridProps = {
  metrics: ReportMetric[];
};

const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => (
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {metrics.map((metric) => (
      <article
        key={metric.id}
        className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm shadow-slate-900/10"
      >
        <header className="flex items-start justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{metric.label}</span>
        </header>
        <p className="text-3xl font-semibold text-slate-900">{metric.value}</p>
      </article>
    ))}
  </section>
);

export default MetricsGrid;

