export type ServiceStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';

export interface Service {
  id: string;
  name: string;
  description: string;
  url?: string;
  group: 'frontend' | 'backend' | 'auth' | 'data' | 'integrations';
}

export interface ServiceState {
  serviceId: string;
  status: ServiceStatus;
  responseTime?: number;
  lastChecked: string; // ISO
  lastIncidentAt?: string;
}

export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type IncidentImpact = 'minor' | 'major' | 'critical';

export interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  message: string;
  timestamp: string; // ISO
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  affectedServices: string[]; // service ids
  startedAt: string; // ISO
  resolvedAt?: string; // ISO
  source: 'sentry' | 'pinger' | 'manual';
  updates: IncidentUpdate[];
}

export interface OverallStatus {
  status: ServiceStatus;
  message: string;
}

/**
 * Eén dag uptime data per service.
 * `date` = YYYY-MM-DD
 * `status` = aggregaat van alle pings die dag (worst case)
 * `checks` / `failures` voor uptime-% berekening
 */
export interface DailyUptime {
  date: string;
  status: ServiceStatus;
  checks: number;
  failures: number;
  avgResponseTime?: number;
}

export interface ServiceUptimeWindow {
  serviceId: string;
  days: DailyUptime[]; // 90 entries, oudste eerst
  uptimePercent: number;
}

export interface Subscriber {
  email: string;
  subscribedAt: string;
  confirmed: boolean;
  confirmToken: string;
  unsubscribeToken: string;
}
