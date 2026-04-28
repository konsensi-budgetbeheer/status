import { NextResponse } from 'next/server';
import { removeSubscriber } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?unsubscribe=invalid', url));
  }
  const ok = await removeSubscriber(token);
  return NextResponse.redirect(new URL(`/?unsubscribe=${ok ? 'done' : 'invalid'}`, url));
}
