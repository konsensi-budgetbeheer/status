# Konsensi Status

Publieke status page voor Konsensi Budgetbeheer — live op `status.konsensi-budgetbeheer.nl`.

## Stack

- **Next.js 16** (App Router) op Vercel
- **Vercel KV** (Upstash Redis) voor persistente incident/uptime data
- **Vercel Cron** elke 5 min voor uptime monitoring
- **Sentry webhook** voor automatische incident melding bij errors

## Lokaal draaien

```bash
cp .env.example .env.local
# Vul KV credentials uit Vercel project (Storage tab)
npm install
npm run dev
```

## API endpoints

| Endpoint | Methode | Auth | Doel |
|---|---|---|---|
| `/` | GET | publiek | Status page UI |
| `/api/incidents` | GET | publiek | Lijst actieve + history JSON |
| `/api/incidents` | POST | `ADMIN_SECRET` | Handmatig incident posten |
| `/api/sentry` | POST | `SENTRY_WEBHOOK_SECRET` | Sentry webhook receiver |
| `/api/ping` | POST | Vercel cron / `PING_SECRET` | Pingt alle services, update states |

## Services configureren

Edit [data/services.ts](data/services.ts) — voeg services toe of verwijder. Elke service met een `url` wordt automatisch gepingd door de cron.

## Sentry koppelen

1. Sentry → **Settings → Developer Settings → Internal Integrations → New**
2. Naam: "Status Page Webhook"
3. Webhook URL: `https://status.konsensi-budgetbeheer.nl/api/sentry`
4. Permissions: `Issue & Event: Read`
5. Webhooks events: `issue` (created, resolved)
6. Save → kopieer "Client Secret" → zet als `SENTRY_WEBHOOK_SECRET` in Vercel
7. Activeer integration in jouw Sentry project (Settings → Integrations → Status Page Webhook)
