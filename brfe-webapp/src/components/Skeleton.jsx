import { cn } from '../lib/utils';

export function Skeleton({ className, ...props }) {
  return <div className={cn('skeleton h-4', className)} {...props} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="p-6 space-y-4">
      {/* Header skeleton */}
      <div className="flex gap-4 pb-4 border-b border-slate-100">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-3 flex-1 rounded-md" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center" style={{ animationDelay: `${i * 0.05}s` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className={cn('h-4 flex-1 rounded-md', j === 0 && 'max-w-[120px]')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <Skeleton className="h-3 w-20 mb-4 rounded-md" />
      <Skeleton className="h-8 w-14 rounded-md" />
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="relative h-full w-full bg-slate-100 rounded-2xl overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading map...</p>
        </div>
      </div>
    </div>
  );
}
