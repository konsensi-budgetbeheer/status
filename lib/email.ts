import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || 'Konsensi Status <status@konsensi-budgetbeheer.nl>';
const STATUS_BASE_URL = process.env.STATUS_BASE_URL || 'https://status.konsensi-budgetbeheer.nl';

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY niet gezet — email niet verzonden');
    return { ok: false, error: 'No RESEND_API_KEY' };
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  max-width: 560px; margin: 0 auto; padding: 32px 24px;
  color: #1a1a1a; line-height: 1.6;
`;

export function sendConfirmationEmail(to: string, confirmToken: string) {
  const link = `${STATUS_BASE_URL}/api/subscribe/confirm?token=${confirmToken}`;
  return send({
    to,
    subject: 'Bevestig je inschrijving — Konsensi Status',
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #059669; font-size: 20px;">Bevestig je inschrijving</h2>
        <p>Bedankt voor je interesse in Konsensi Status updates. Klik op de knop hieronder om je inschrijving te bevestigen.</p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Bevestig email
          </a>
        </p>
        <p style="font-size: 13px; color: #6b7280;">
          Als je je niet hebt ingeschreven kun je deze email negeren.
        </p>
      </div>
    `,
  });
}

export function sendIncidentEmail(
  to: string,
  unsubscribeToken: string,
  args: { title: string; status: string; impact: string; message?: string }
) {
  const unsubLink = `${STATUS_BASE_URL}/api/subscribe/unsubscribe?token=${unsubscribeToken}`;
  return send({
    to,
    subject: `[Status] ${args.title}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #dc2626; font-size: 20px;">${args.title}</h2>
        <p><strong>Status:</strong> ${args.status}<br/><strong>Impact:</strong> ${args.impact}</p>
        ${args.message ? `<p>${args.message}</p>` : ''}
        <p>
          <a href="${STATUS_BASE_URL}" style="color: #059669;">Bekijk status page →</a>
        </p>
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="font-size: 12px; color: #6b7280;">
          <a href="${unsubLink}" style="color: #6b7280;">Uitschrijven</a>
        </p>
      </div>
    `,
  });
}
