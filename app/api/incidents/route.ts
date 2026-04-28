import { NextResponse } from 'next/server';
import { getActiveIncidents, getIncidentHistory, saveIncident } from '@/lib/store';
import type { Incident, IncidentStatus, IncidentImpact } from '@/types/status';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [active, history] = await Promise.all([getActiveIncidents(), getIncidentHistory()]);
  return NextResponse.json({ active, history });
}

/**
 * Manual incident creation/update — voor handmatige meldingen.
 * Header: `Authorization: Bearer <ADMIN_SECRET>`
 *
 * Body:
 *   { id?, title, status, impact, affectedServices: string[], message? }
 */
function authorize(request: Request): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}

interface ManualIncidentBody {
  id?: string;
  title: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  affectedServices: string[];
  message?: string;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ManualIncidentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = body.id ?? `manual-${Date.now()}`;
  const active = await getActiveIncidents();
  const existing = active.find((i) => i.id === id);

  const incident: Incident = existing
    ? {
        ...existing,
        title: body.title,
        status: body.status,
        impact: body.impact,
        affectedServices: body.affectedServices,
        resolvedAt: body.status === 'resolved' ? now : existing.resolvedAt,
        updates: [
          ...existing.updates,
          {
            id: `update-${Date.now()}`,
            status: body.status,
            message: body.message ?? `Status: ${body.status}`,
            timestamp: now,
          },
        ],
      }
    : {
        id,
        title: body.title,
        status: body.status,
        impact: body.impact,
        affectedServices: body.affectedServices,
        startedAt: now,
        resolvedAt: body.status === 'resolved' ? now : undefined,
        source: 'manual',
        updates: [
          {
            id: `update-${Date.now()}`,
            status: body.status,
            message: body.message ?? `Incident gemeld: ${body.title}`,
            timestamp: now,
          },
        ],
      };

  await saveIncident(incident);
  return NextResponse.json({ ok: true, incident });
}
