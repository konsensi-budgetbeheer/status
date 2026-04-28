import { SERVICES, SERVICE_GROUPS } from '@/data/services';
import {
  getActiveIncidents,
  getIncidentHistory,
  getServiceState,
  getUptimeWindow,
} from '@/lib/store';
import {
  computeOverallStatus,
  formatDateTime,
  impactLabel,
  statusColor,
  statusLabel,
} from '@/lib/status-helpers';
import type { ServiceState, Service } from '@/types/status';
import { UptimeBars } from './components/UptimeBars';
import { SubscribeButton } from './components/SubscribeButton';

export const revalidate = 30;

export default async function StatusPage() {
  const [activeIncidents, history] = await Promise.all([
    getActiveIncidents(),
    getIncidentHistory(),
  ]);

  const states = await Promise.all(
    SERVICES.map(async (s) => {
      const state = await getServiceState(s.id);
      return (
        state ?? {
          serviceId: s.id,
          status: 'operational' as const,
          lastChecked: new Date().toISOString(),
        }
      );
    })
  );

  const uptimes = await Promise.all(
    SERVICES.map(async (s) => ({
      serviceId: s.id,
      ...(await getUptimeWindow(s.id)),
    }))
  );

  const overall = computeOverallStatus(states, activeIncidents);

  const stateById = new Map<string, ServiceState>(states.map((s) => [s.serviceId, s]));
  const uptimeById = new Map(uptimes.map((u) => [u.serviceId, u]));
  const groupedServices = SERVICES.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  const overallBg =
    overall.status === 'operational'
      ? 'bg-emerald-600'
      : overall.status === 'degraded'
        ? 'bg-yellow-500'
        : overall.status === 'partial_outage'
          ? 'bg-orange-500'
          : overall.status === 'maintenance'
            ? 'bg-blue-500'
            : 'bg-red-600';

  const overallHeadline =
    overall.status === 'operational' ? 'Alle systemen werken normaal' : overall.message;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 mb-12">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold">K</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Konsensi Status</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Live status van Konsensi Budgetbeheer diensten
            </p>
          </div>
        </div>
        <SubscribeButton />
      </header>

      {/* Overall status banner */}
      <section
        className={`mb-12 rounded-lg ${overallBg} text-white px-6 py-5 shadow-sm`}
        aria-live="polite"
      >
        <h2 className="text-lg font-semibold">{overallHeadline}</h2>
      </section>

      {/* Active incidents */}
      {activeIncidents.length > 0 && (
        <section className="mb-12">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            Actieve incidenten
          </h3>
          <div className="space-y-4">
            {activeIncidents.map((incident) => (
              <article
                key={incident.id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold">{incident.title}</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Begonnen {formatDateTime(incident.startedAt)} · Impact{' '}
                      {impactLabel(incident.impact)}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 capitalize">
                    {incident.status}
                  </span>
                </div>
                <ul className="space-y-2 border-l-2 border-neutral-200 dark:border-neutral-800 pl-4">
                  {[...incident.updates].reverse().map((u) => (
                    <li key={u.id} className="text-sm">
                      <span className="text-neutral-500 dark:text-neutral-400 text-xs block">
                        {formatDateTime(u.timestamp)}
                      </span>
                      <span className="text-neutral-700 dark:text-neutral-300">{u.message}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Uptime over the past 90 days header */}
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Diensten
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Uptime over de afgelopen 90 dagen
        </p>
      </div>

      {/* Services with uptime bars per service */}
      <section className="space-y-8 mb-16">
        {Object.entries(groupedServices).map(([group, services]) => (
          <div key={group}>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500 mb-3">
              {SERVICE_GROUPS[group as keyof typeof SERVICE_GROUPS]}
            </p>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800">
              {services.map((s) => {
                const state = stateById.get(s.id);
                const uptime = uptimeById.get(s.id);
                const status = state?.status ?? 'operational';
                return (
                  <div key={s.id} className="px-5 py-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {s.name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {s.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`inline-block size-2.5 rounded-full ${statusColor(status)}`}
                        />
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          {statusLabel(status)}
                        </span>
                      </div>
                    </div>
                    {uptime && (
                      <UptimeBars days={uptime.days} uptimePercent={uptime.uptimePercent} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section className="mb-12">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
            Recente incidenten
          </h3>
          <ul className="space-y-2">
            {history.slice(0, 10).map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {i.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatDateTime(i.startedAt)}
                    {i.resolvedAt ? ` — opgelost ${formatDateTime(i.resolvedAt)}` : ''}
                  </p>
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Opgelost
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-neutral-500 dark:text-neutral-400 pt-8 border-t border-neutral-200 dark:border-neutral-800">
        <p>
          Vragen? Mail{' '}
          <a
            href="mailto:support@konsensi-budgetbeheer.nl"
            className="underline hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            support@konsensi-budgetbeheer.nl
          </a>
          {' · '}
          <a
            href="https://app.konsensi-budgetbeheer.nl"
            className="underline hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Terug naar app
          </a>
        </p>
      </footer>
    </main>
  );
}
