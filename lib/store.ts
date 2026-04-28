import { kv } from '@vercel/kv';
import type {
  Incident,
  ServiceState,
  DailyUptime,
  ServiceStatus,
  Subscriber,
} from '@/types/status';

/**
 * Persistente opslag via Vercel KV (Upstash Redis).
 * Lokaal: in-memory fallback als KV niet geconfigureerd is.
 */

const isKvConfigured = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

const memStore = new Map<string, unknown>();

async function get<T>(key: string): Promise<T | null> {
  if (isKvConfigured) {
    return ((await kv.get<T>(key)) ?? null) as T | null;
  }
  return (memStore.get(key) as T | undefined) ?? null;
}

async function set<T>(key: string, value: T): Promise<void> {
  if (isKvConfigured) {
    await kv.set(key, value);
  } else {
    memStore.set(key, value);
  }
}

// === Incidents ===

export async function getActiveIncidents(): Promise<Incident[]> {
  const raw = await get<unknown>('incidents:active');
  return Array.isArray(raw) ? (raw as Incident[]) : [];
}

export async function getIncidentHistory(): Promise<Incident[]> {
  const raw = await get<unknown>('incidents:history');
  return Array.isArray(raw) ? (raw as Incident[]) : [];
}

export async function saveIncident(incident: Incident): Promise<void> {
  const active = await getActiveIncidents();
  const idx = active.findIndex((i) => i.id === incident.id);

  if (incident.status === 'resolved') {
    const filtered = active.filter((i) => i.id !== incident.id);
    await set('incidents:active', filtered);

    const history = await getIncidentHistory();
    const newHistory = [incident, ...history.filter((i) => i.id !== incident.id)].slice(0, 100);
    await set('incidents:history', newHistory);
    return;
  }

  if (idx >= 0) {
    active[idx] = incident;
  } else {
    active.unshift(incident);
  }
  await set('incidents:active', active);
}

// === Service states (laatste check) ===

export async function getServiceState(serviceId: string): Promise<ServiceState | null> {
  return get<ServiceState>(`service:${serviceId}:state`);
}

export async function saveServiceState(state: ServiceState): Promise<void> {
  await set(`service:${state.serviceId}:state`, state);
}

// === Daily uptime tracking (90 dagen rolling window) ===

const WINDOW_DAYS = 90;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const STATUS_RANK: Record<ServiceStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

function worstStatus(a: ServiceStatus, b: ServiceStatus): ServiceStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/**
 * Registreert een ping resultaat in de daily uptime van vandaag.
 * Aggregeert: worst-case status, telt checks + failures, gemiddelde response time.
 */
export async function recordDailyPing(
  serviceId: string,
  status: ServiceStatus,
  responseTime: number
): Promise<void> {
  const date = todayKey();
  const key = `uptime:${serviceId}:${date}`;
  const existing = await get<DailyUptime>(key);

  const isFailure = status === 'major_outage' || status === 'partial_outage';

  const updated: DailyUptime = existing
    ? {
        date,
        status: worstStatus(existing.status, status),
        checks: existing.checks + 1,
        failures: existing.failures + (isFailure ? 1 : 0),
        avgResponseTime: Math.round(
          ((existing.avgResponseTime ?? 0) * existing.checks + responseTime) /
            (existing.checks + 1)
        ),
      }
    : {
        date,
        status,
        checks: 1,
        failures: isFailure ? 1 : 0,
        avgResponseTime: responseTime,
      };

  await set(key, updated);
}

/**
 * Haal de afgelopen 90 dagen op voor een service. Lege dagen → operational placeholder.
 */
export async function getUptimeWindow(serviceId: string): Promise<{
  days: DailyUptime[];
  uptimePercent: number;
}> {
  const days = lastNDays(WINDOW_DAYS);
  const results = await Promise.all(
    days.map((date) => get<DailyUptime>(`uptime:${serviceId}:${date}`))
  );

  const filled: DailyUptime[] = days.map((date, i) => {
    const r = results[i];
    if (r) return r;
    // Placeholder voor dagen vóór eerste meting
    return { date, status: 'operational', checks: 0, failures: 0 };
  });

  // Uptime% over alleen dagen met daadwerkelijke checks
  const measured = filled.filter((d) => d.checks > 0);
  const totalChecks = measured.reduce((sum, d) => sum + d.checks, 0);
  const totalFailures = measured.reduce((sum, d) => sum + d.failures, 0);
  const uptimePercent =
    totalChecks > 0 ? ((totalChecks - totalFailures) / totalChecks) * 100 : 100;

  return { days: filled, uptimePercent };
}

// === Subscribers ===

export async function getSubscribers(): Promise<Subscriber[]> {
  const raw = await get<unknown>('subscribers');
  return Array.isArray(raw) ? (raw as Subscriber[]) : [];
}

export async function saveSubscriber(sub: Subscriber): Promise<void> {
  const all = await getSubscribers();
  const idx = all.findIndex((s) => s.email === sub.email);
  if (idx >= 0) all[idx] = sub;
  else all.push(sub);
  await set('subscribers', all);
}

export async function removeSubscriber(token: string): Promise<boolean> {
  const all = await getSubscribers();
  const filtered = all.filter((s) => s.unsubscribeToken !== token);
  if (filtered.length === all.length) return false;
  await set('subscribers', filtered);
  return true;
}

export async function confirmSubscriber(token: string): Promise<Subscriber | null> {
  const all = await getSubscribers();
  const sub = all.find((s) => s.confirmToken === token);
  if (!sub) return null;
  sub.confirmed = true;
  await set('subscribers', all);
  return sub;
}
