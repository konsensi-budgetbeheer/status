import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { saveIncident, getActiveIncidents } from '@/lib/store';
import type { Incident, IncidentImpact } from '@/types/status';

/**
 * Sentry webhook receiver.
 * Sentry → Settings → Custom Integrations → Konsensi Status Page.
 *
 * Authenticatie: Sentry signed HMAC-SHA256 van de body met de Internal
 * Integration's clientSecret. We accepteren ook een eigen Bearer token
 * voor handmatige tests (curl, postman).
 *   SENTRY_WEBHOOK_SECRET = clientSecret van de Sentry Internal Integration.
 *
 * Sentry stuurt event types: issue.created, issue.resolved, error.created.
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

function verifySentrySignature(secret: string, body: string, signature: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(request: Request, rawBody: string): boolean {
  const expected = process.env.SENTRY_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';

  // Sentry: sentry-hook-signature = HMAC-SHA256(body, clientSecret)
  const sentrySig = request.headers.get('sentry-hook-signature') || '';
  if (sentrySig && verifySentrySignature(expected, rawBody, sentrySig)) {
    return true;
  }

  // Fallback: handmatige tests via Bearer token
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
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
  const rawBody = await request.text();

  if (!authorize(request, rawBody)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: SentryPayload;
  try {
    payload = JSON.parse(rawBody) as SentryPayload;
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
