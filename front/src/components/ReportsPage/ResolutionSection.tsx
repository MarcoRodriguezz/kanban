import React from 'react';
import type { ResolutionPoint } from './types';

type ResolutionSectionProps = {
  points: ResolutionPoint[];
  resolutionAverage: number | null;
  resolutionMaxValue: number;
};

const ResolutionSection: React.FC<ResolutionSectionProps> = ({
  points,
  resolutionAverage,
  resolutionMaxValue,
}) => (
  <section className="rounded-3xl border border-slate-200 bg-white px-6 py-6 shadow-lg shadow-slate-900/5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">Tasa de resolución</h3>
        <p className="text-xs text-slate-500">Tareas cerradas mes a mes en el periodo seleccionado.</p>
      </div>
      <span className="text-xs font-semibold text-slate-400">
        {resolutionAverage !== null ? `Promedio · ${resolutionAverage.toFixed(1)} tareas/mes` : ''}
      </span>
    </header>

    <div className="mt-6 rounded-3xl bg-gradient-to-b from-blue-500/10 via-slate-50 to-white p-6">
      {points.length >= 2 ? (
        <svg viewBox="0 0 720 220" className="h-52 w-full">
          <defs>
            <linearGradient id="resolutionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`M0,200 ${points
              .map((point, index) => {
                const ratio = points.length > 1 ? index / (points.length - 1) : 0;
                const x = ratio * 720;
                const y = 200 - (point.value / resolutionMaxValue) * 180;
                return `L${x},${y}`;
              })
              .join(' ')} L720,200 Z`}
            fill="url(#resolutionGradient)"
            stroke="none"
          />
          <polyline
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points
              .map((point, index) => {
                const ratio = points.length > 1 ? index / (points.length - 1) : 0;
                const x = ratio * 720;
                const y = 200 - (point.value / resolutionMaxValue) * 180;
                return `${x},${y}`;
              })
              .join(' ')}
          />
          {points.map((point, index) => {
            const ratio = points.length > 1 ? index / (points.length - 1) : 0;
            const x = ratio * 720;
            const y = 200 - (point.value / resolutionMaxValue) * 180;
            return (
              <g key={`${point.month}-${index}`}>
                <circle cx={x} cy={y} r="5" fill="#2563EB" stroke="#fff" strokeWidth="2" />
                <text
                  x={x}
                  y={210}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] uppercase tracking-wide"
                >
                  {point.month}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-xs text-slate-400">
          No hay suficientes tareas completadas para generar el histórico.
        </div>
      )}
    </div>
  </section>
);

export default ResolutionSection;

