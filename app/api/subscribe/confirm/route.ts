import { NextResponse } from 'next/server';
import { confirmSubscriber } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?subscribe=invalid', url));
  }
  const sub = await confirmSubscriber(token);
  if (!sub) {
    return NextResponse.redirect(new URL('/?subscribe=invalid', url));
  }
  return NextResponse.redirect(new URL('/?subscribe=confirmed', url));
}
