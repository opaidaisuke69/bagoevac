import { cn } from '../lib/utils';

const variants = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  red: 'bg-red-50 text-red-700 ring-red-600/10',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  orange: 'bg-orange-50 text-orange-700 ring-orange-600/10',
  gray: 'bg-slate-50 text-slate-600 ring-slate-500/10',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/10',
};

const dotColors = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  orange: 'bg-orange-500',
  gray: 'bg-slate-400',
  purple: 'bg-purple-500',
};

const statusVariant = {
  Safe: 'green',
  Need_Assistance: 'yellow',
  In_Danger: 'red',
  Pending: 'yellow',
  Ongoing: 'blue',
  Completed: 'green',
  Open: 'green',
  Full: 'orange',
  Closed: 'red',
  Low: 'green',
  Moderate: 'yellow',
  High: 'orange',
  Critical: 'red',
};

const statusLabels = {
  Need_Assistance: 'Need Help',
  In_Danger: 'In Danger',
};

export default function Badge({ children, variant, status, dot = true, className }) {
  const resolvedVariant = variant || statusVariant[status] || 'gray';
  const label = children || statusLabels[status] || status?.replace(/_/g, ' ');

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ring-1 ring-inset',
      variants[resolvedVariant],
      className
    )}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[resolvedVariant])} />}
      {label}
    </span>
  );
}
