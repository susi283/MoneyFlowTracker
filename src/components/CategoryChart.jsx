import React from 'react';
import { formatCurrency } from '../utils/helpers';

const COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-indigo-500',
];

export default function CategoryChart({ data, title }) {
  if (!data || data.length === 0) {
    return (
      <div className="card">
        <h3 className="section-title mb-4">{title}</h3>
        <p className="text-slate-400 text-sm text-center py-8">No data for this period.</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.amount, 0);
  const max = Math.max(...data.map((d) => d.amount));

  return (
    <div className="card">
      <h3 className="section-title mb-1">{title}</h3>
      <p className="text-sm text-slate-400 mb-5">Total: {formatCurrency(total)}</p>

      <div className="space-y-3">
        {data.map((item, i) => {
          const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
          const barPct = max > 0 ? (item.amount / max) * 100 : 0;
          return (
            <div key={item.category}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${COLORS[i % COLORS.length]}`} />
                  <span className="text-sm font-medium text-slate-700">{item.category}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-medium">{pct}%</span>
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(item.amount)}</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${COLORS[i % COLORS.length]}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
