import type { Service } from '@/types/status';

/**
 * Geconfigureerde services die op de status page verschijnen.
 * Pas hier aan om services toe te voegen / wijzigen.
 */
export const SERVICES: Service[] = [
  {
    id: 'web-app',
    name: 'Web Applicatie',
    description: 'app.konsensi-budgetbeheer.nl',
    url: 'https://app.konsensi-budgetbeheer.nl',
    group: 'frontend',
  },
  {
    id: 'login',
    name: 'Authenticatie',
    description: 'Inloggen + 2FA',
    url: 'https://app.konsensi-budgetbeheer.nl/login',
    group: 'auth',
  },
  {
    id: 'supabase-api',
    name: 'Supabase API',
    description: 'Database + REST API',
    url: 'https://bwwoqgkojttarfpwvoxj.supabase.co/rest/v1/',
    group: 'backend',
  },
  {
    id: 'edge-functions',
    name: 'Edge Functions',
    description: 'AI parsing + email + 2FA',
    url: 'https://bwwoqgkojttarfpwvoxj.supabase.co/functions/v1/health-check',
    group: 'backend',
  },
  {
    id: 'ai-anthropic',
    name: 'AI Provider (Anthropic)',
    description: 'Claude API voor document parsing',
    url: 'https://status.anthropic.com',
    group: 'integrations',
  },
  {
    id: 'email-resend',
    name: 'Email (Resend)',
    description: 'Transactionele emails',
    url: 'https://status.resend.com',
    group: 'integrations',
  },
];

export const SERVICE_GROUPS: Record<Service['group'], string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  auth: 'Authenticatie',
  data: 'Data',
  integrations: 'Integraties',
};
