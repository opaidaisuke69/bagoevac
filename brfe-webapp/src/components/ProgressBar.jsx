import { cn } from '../lib/utils';

export default function ProgressBar({ value, max, className, showLabel = false }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : pct >= 50 ? 'bg-blue-500' : 'bg-emerald-500';

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-slate-500">
          <span>{value}/{max}</span>
          <span className="font-medium">{pct}%</span>
        </div>
      )}
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
