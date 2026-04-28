import { NextResponse } from 'next/server';
import { saveIncident, getActiveIncidents } from '@/lib/store';
import type { Incident, IncidentImpact } from '@/types/status';

/**
 * Sentry webhook receiver.
 * Sentry → Settings → Integrations → Internal Integration → Webhooks
 *
 * Beveiliging: shared secret in `Authorization` header.
 *   Set SENTRY_WEBHOOK_SECRET in Vercel env vars.
 *
 * Sentry stuurt verschillende event types: issue.created, issue.resolved, alert.triggered, etc.
 * We mappen "issue.created" met error niveau → incident, "issue.resolved" → resolved.
 */
export const dynamic = 'force-dynamic';

interface SentryPayload {
  action?: string;
  data?: {
    issue?: {
      id?: string;
      title?: string;
      level?: string;
      culprit?: string;
      permalink?: string;
      url?: string;
    };
    event?: {
      title?: string;
      level?: string;
    };
  };
}

function authorize(request: Request): boolean {
  const expected = process.env.SENTRY_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';

  const auth = request.headers.get('authorization') || '';
  const sentryAuth = request.headers.get('sentry-hook-signature') || '';

  return auth === `Bearer ${expected}` || sentryAuth === expected;
}

function levelToImpact(level?: string): IncidentImpact {
  switch (level) {
    case 'fatal':
      return 'critical';
    case 'error':
      return 'major';
    default:
      return 'minor';
  }
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: SentryPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const issue = payload.data?.issue;
  if (!issue?.id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const incidentId = `sentry-${issue.id}`;
  const now = new Date().toISOString();
  const action = payload.action || 'created';

  if (action === 'resolved') {
    const active = await getActiveIncidents();
    const existing = active.find((i) => i.id === incidentId);
    if (!existing) return NextResponse.json({ ok: true, notFound: true });

    const resolved: Incident = {
      ...existing,
      status: 'resolved',
      resolvedAt: now,
      updates: [
        ...existing.updates,
        {
          id: `update-${Date.now()}`,
          status: 'resolved',
          message: 'Issue is opgelost in Sentry.',
          timestamp: now,
        },
      ],
    };
    await saveIncident(resolved);
    return NextResponse.json({ ok: true, resolved: true });
  }

  // Create or update
  const active = await getActiveIncidents();
  const existing = active.find((i) => i.id === incidentId);

  if (existing) {
    return NextResponse.json({ ok: true, alreadyTracked: true });
  }

  const incident: Incident = {
    id: incidentId,
    title: issue.title || 'Onbekende fout in productie',
    status: 'investigating',
    impact: levelToImpact(issue.level),
    affectedServices: ['web-app'], // default — kan via culprit/tags fijner
    startedAt: now,
    source: 'sentry',
    updates: [
      {
        id: `update-${Date.now()}`,
        status: 'investigating',
        message: `Sentry alert ontvangen: ${issue.title || 'fout gedetecteerd'}.`,
        timestamp: now,
      },
    ],
  };

  await saveIncident(incident);
  return NextResponse.json({ ok: true, incidentId });
}
