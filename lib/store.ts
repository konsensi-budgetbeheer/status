import { kv } from '@vercel/kv';
import type { Incident, ServiceState } from '@/types/status';

/**
 * Persistente opslag via Vercel KV (Upstash Redis).
 * Lokaal ontwikkeling: in-memory fallback als KV niet geconfigureerd is.
 *
 * Keys:
 *   incidents:active     → Incident[]   (lopende incidenten)
 *   incidents:history    → Incident[]   (afgesloten, max 100 recent)
 *   service:<id>:state   → ServiceState (laatste check resultaat)
 */

const isKvConfigured = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// In-memory fallback voor lokale dev
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
  return (await get<Incident[]>('incidents:active')) ?? [];
}

export async function getIncidentHistory(): Promise<Incident[]> {
  return (await get<Incident[]>('incidents:history')) ?? [];
}

export async function saveIncident(incident: Incident): Promise<void> {
  const active = await getActiveIncidents();
  const idx = active.findIndex((i) => i.id === incident.id);

  if (incident.status === 'resolved') {
    // Move to history
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

// === Service states ===

export async function getServiceState(serviceId: string): Promise<ServiceState | null> {
  return get<ServiceState>(`service:${serviceId}:state`);
}

export async function saveServiceState(state: ServiceState): Promise<void> {
  await set(`service:${state.serviceId}:state`, state);
}
