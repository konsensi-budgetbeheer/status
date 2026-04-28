import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { saveSubscriber, getSubscribers } from '@/lib/store';
import { sendConfirmationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Ongeldig emailadres' }, { status: 400 });
  }

  const existing = (await getSubscribers()).find((s) => s.email === email);
  if (existing && existing.confirmed) {
    return NextResponse.json({ ok: true, alreadySubscribed: true });
  }

  const confirmToken = existing?.confirmToken ?? randomBytes(32).toString('hex');
  const unsubscribeToken = existing?.unsubscribeToken ?? randomBytes(32).toString('hex');

  await saveSubscriber({
    email,
    subscribedAt: existing?.subscribedAt ?? new Date().toISOString(),
    confirmed: false,
    confirmToken,
    unsubscribeToken,
  });

  await sendConfirmationEmail(email, confirmToken);

  return NextResponse.json({ ok: true });
}
