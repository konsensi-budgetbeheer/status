import type { DailyUptime } from '@/types/status';

interface Props {
  days: DailyUptime[]; // 90 entries
  uptimePercent: number;
}

function dayColor(d: DailyUptime): string {
  if (d.checks === 0) return 'bg-neutral-200 dark:bg-neutral-800';
  if (d.failures === 0) return 'bg-emerald-500';
  const failRatio = d.failures / d.checks;
  if (failRatio < 0.05) return 'bg-yellow-400';
  if (failRatio < 0.2) return 'bg-orange-500';
  return 'bg-red-500';
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

export function UptimeBars({ days, uptimePercent }: Props) {
  return (
    <div>
      <div className="flex items-end gap-[2px] h-9" role="img" aria-label="Uptime over 90 dagen">
        {days.map((d) => (
          <div
            key={d.date}
            className={`flex-1 rounded-sm ${dayColor(d)} h-full transition-opacity hover:opacity-80`}
            title={
              d.checks === 0
                ? `${formatDate(d.date)} — geen data`
                : `${formatDate(d.date)} — ${d.checks - d.failures}/${d.checks} checks ok`
            }
          />
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-neutral-500 dark:text-neutral-500">
        <span>90 dagen geleden</span>
        <span className="font-medium tabular-nums">{uptimePercent.toFixed(2)} % uptime</span>
        <span>Vandaag</span>
      </div>
    </div>
  );
}
