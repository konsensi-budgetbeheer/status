import type { ServiceStatus, ServiceState, Incident, OverallStatus } from '@/types/status';

const STATUS_RANK: Record<ServiceStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

export function worseStatus(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function computeOverallStatus(states: ServiceState[], incidents: Incident[]): OverallStatus {
  if (states.length === 0) {
    return { status: 'operational', message: 'Geen status data beschikbaar' };
  }

  let worst: ServiceStatus = 'operational';
  for (const s of states) {
    worst = worseStatus(worst, s.status);
  }

  // Active incidents tellen ook mee
  if (incidents.length > 0) {
    const hasCritical = incidents.some((i) => i.impact === 'critical');
    const hasMajor = incidents.some((i) => i.impact === 'major');
    if (hasCritical) worst = worseStatus(worst, 'major_outage');
    else if (hasMajor) worst = worseStatus(worst, 'partial_outage');
  }

  const messages: Record<ServiceStatus, string> = {
    operational: 'Alle systemen werken normaal',
    maintenance: 'Gepland onderhoud bezig',
    degraded: 'Sommige systemen werken trager dan normaal',
    partial_outage: 'Gedeeltelijke storing aanwezig',
    major_outage: 'Grote storing — we werken eraan',
  };

  return { status: worst, message: messages[worst] };
}

export function statusColor(status: ServiceStatus): string {
  switch (status) {
    case 'operational':
      return 'bg-emerald-500';
    case 'maintenance':
      return 'bg-blue-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'partial_outage':
      return 'bg-orange-500';
    case 'major_outage':
      return 'bg-red-500';
  }
}

export function statusBg(status: ServiceStatus): string {
  switch (status) {
    case 'operational':
      return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900';
    case 'maintenance':
      return 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900';
    case 'degraded':
      return 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-900';
    case 'partial_outage':
      return 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-900';
    case 'major_outage':
      return 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900';
  }
}

export function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case 'operational':
      return 'Operationeel';
    case 'maintenance':
      return 'Onderhoud';
    case 'degraded':
      return 'Verminderd';
    case 'partial_outage':
      return 'Gedeeltelijke storing';
    case 'major_outage':
      return 'Storing';
  }
}

export function impactLabel(impact: 'minor' | 'major' | 'critical'): string {
  switch (impact) {
    case 'minor':
      return 'Klein';
    case 'major':
      return 'Groot';
    case 'critical':
      return 'Kritiek';
  }
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
