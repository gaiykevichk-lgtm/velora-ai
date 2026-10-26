import { NextResponse } from 'next/server';
import { ConfigurationError } from './provider';
export function failure(error: unknown) {
  if (error instanceof ConfigurationError) return NextResponse.json({error:error.message}, {status:503});
  console.error(error);
  return NextResponse.json({error:'Something went wrong. Please try again.'},{status:500});
}
export const unauthorized = () => NextResponse.json({error:'Sign in to continue.'},{status:401});

// CSRF guard for state-changing requests. Accepts the configured application
// origin and, additionally, a request whose Origin matches the host it was
// actually sent to: the site is served both on the platform URL and on the
// public domain, so a strict single-origin comparison would reject legitimate
// same-origin posts from the other host.
export function originAllowed(
  req: { headers: { get(name: string): string | null } },
  expected: string,
) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  if (origin === expected) return true;
  try {
    const url = new URL(origin);
    const host = req.headers.get('host');
    if (!host || url.host !== host) return false;
    const proto = req.headers.get('x-forwarded-proto');
    return proto ? url.protocol === `${proto}:` : true;
  } catch {
    return false;
  }
}
