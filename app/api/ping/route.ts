import { NextResponse } from 'next/server';
import { SERVICES } from '@/data/services';
import { saveServiceState, getActiveIncidents, saveIncident } from '@/lib/store';
import type { ServiceStatus, Incident } from '@/types/status';

/**
 * Pingt alle geconfigureerde services en update de service states.
 * Triggert ook automatisch een incident als een service down/degraded is.
 *
 * Bedoeld als Vercel Cron job — elke 1-5 min.
 *   POST /api/ping       (handmatig of via cron)
 *
 * Beveiliging: header `Authorization: Bearer <PING_SECRET>` of
 *              Vercel Cron user-agent.
 */
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 8000;
const DEGRADED_THRESHOLD_MS = 3000;

async function pingService(url: string): Promise<{ status: ServiceStatus; responseTime: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'KonsensiStatus/1.0' },
    });
    const responseTime = Date.now() - start;
    clearTimeout(timeout);

    if (!res.ok) {
      // 5xx = outage, 4xx = mogelijk auth required maar service zelf werkt
      const status: ServiceStatus = res.status >= 500 ? 'major_outage' : 'operational';
      return { status, responseTime };
    }

    const status: ServiceStatus = responseTime > DEGRADED_THRESHOLD_MS ? 'degraded' : 'operational';
    return { status, responseTime };
  } catch {
    clearTimeout(timeout);
    return { status: 'major_outage', responseTime: Date.now() - start };
  }
}

function authorize(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.PING_SECRET;

  // Vercel Cron stuurt user-agent met "vercel-cron"
  const ua = request.headers.get('user-agent') || '';
  if (ua.includes('vercel-cron')) return true;

  if (expected && authHeader === `Bearer ${expected}`) return true;

  // In dev: zonder secret toestaan
  if (!expected && process.env.NODE_ENV !== 'production') return true;

  return false;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await Promise.all(
    SERVICES.filter((s) => !!s.url).map(async (service) => {
      const { status, responseTime } = await pingService(service.url!);
      const now = new Date().toISOString();

      await saveServiceState({
        serviceId: service.id,
        status,
        responseTime,
        lastChecked: now,
        lastIncidentAt: status !== 'operational' ? now : undefined,
      });

      return { serviceId: service.id, status, responseTime };
    })
  );

  // Auto-incident creation voor down services zonder lopend incident
  const downServices = results.filter((r) => r.status === 'major_outage');
  if (downServices.length > 0) {
    const active = await getActiveIncidents();
    const downServiceIds = new Set(downServices.map((d) => d.serviceId));
    const alreadyTracked = new Set(
      active.filter((i) => i.source === 'pinger').flatMap((i) => i.affectedServices)
    );

    const newDown = [...downServiceIds].filter((id) => !alreadyTracked.has(id));
    if (newDown.length > 0) {
      const id = `pinger-${Date.now()}`;
      const now = new Date().toISOString();
      const incident: Incident = {
        id,
        title: `Service downtime gedetecteerd: ${newDown.join(', ')}`,
        status: 'investigating',
        impact: 'major',
        affectedServices: newDown,
        startedAt: now,
        source: 'pinger',
        updates: [
          {
            id: `update-${Date.now()}`,
            status: 'investigating',
            message: 'Automatisch gedetecteerd door uptime monitor.',
            timestamp: now,
          },
        ],
      };
      await saveIncident(incident);
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return POST(request);
}
