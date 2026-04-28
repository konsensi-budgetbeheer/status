import { SERVICES, SERVICE_GROUPS } from '@/data/services';
import { getActiveIncidents, getIncidentHistory, getServiceState } from '@/lib/store';
import {
  computeOverallStatus,
  formatDateTime,
  impactLabel,
  statusBg,
  statusColor,
  statusLabel,
} from '@/lib/status-helpers';
import type { ServiceState, Service } from '@/types/status';

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

  const overall = computeOverallStatus(states, activeIncidents);

  const stateById = new Map<string, ServiceState>(states.map((s) => [s.serviceId, s]));
  const groupedServices = SERVICES.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-1">
          <div className="size-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">K</span>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Konsensi Status
          </h1>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Live status van Konsensi Budgetbeheer diensten
        </p>
      </header>

      <section
        className={`mb-8 rounded-2xl border p-6 ${statusBg(overall.status)}`}
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-block size-3 rounded-full ${statusColor(overall.status)}`} />
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {overall.message}
          </h2>
        </div>
      </section>

      {activeIncidents.length > 0 && (
        <section className="mb-10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">
            Actieve incidenten
          </h3>
          <div className="space-y-4">
            {activeIncidents.map((incident) => (
              <article
                key={incident.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {incident.title}
                    </h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      Begonnen {formatDateTime(incident.startedAt)} · Impact:{' '}
                      {impactLabel(incident.impact)}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                    {incident.status}
                  </span>
                </div>
                <ul className="space-y-2 border-l border-neutral-200 dark:border-neutral-800 pl-4">
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

      <section className="mb-12">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">
          Diensten
        </h3>
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
          {Object.entries(groupedServices).map(([group, services], gi) => (
            <div key={group}>
              {gi > 0 && <div className="border-t border-neutral-200 dark:border-neutral-800" />}
              <div className="px-5 py-2 bg-neutral-50 dark:bg-neutral-950/50 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {SERVICE_GROUPS[group as keyof typeof SERVICE_GROUPS]}
              </div>
              {services.map((s, i) => {
                const state = stateById.get(s.id);
                const status = state?.status ?? 'operational';
                return (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between gap-3 px-5 py-3 ${
                      i < services.length - 1
                        ? 'border-b border-neutral-100 dark:border-neutral-800/60'
                        : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{s.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        {s.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {state?.responseTime !== undefined && (
                        <span className="text-xs text-neutral-400 tabular-nums">
                          {state.responseTime}ms
                        </span>
                      )}
                      <span
                        className={`inline-block size-2.5 rounded-full ${statusColor(status)}`}
                      />
                      <span className="text-sm text-neutral-600 dark:text-neutral-400 hidden sm:inline">
                        {statusLabel(status)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="mb-12">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3">
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

      <footer className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        <p>
          Vragen? Mail{' '}
          <a
            href="mailto:support@konsensi-budgetbeheer.nl"
            className="underline hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            support@konsensi-budgetbeheer.nl
          </a>
        </p>
        <p className="mt-1">
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
