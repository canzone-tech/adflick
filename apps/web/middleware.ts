import { NextResponse, type NextRequest } from 'next/server';

/**
 * The NestJS API owns authentication, revocation and tenant/RBAC decisions.
 * Do not trust cookie presence (or a client role claim) as a valid login.
 * Run before rendering any operations page or its React Server Components.
 */
const accessCookieNames = ['adflick-access', '__Host-adflick-access'] as const;
const publicPages = new Set(['/login', '/join']);

/**
 * Local development runs on the loopback IP so its configured API origin,
 * same-site cookies and CSRF allowlist all agree. Visiting `localhost`
 * otherwise looks like a different site and login fails as a network error.
 * Redirect only the exact matching local port; never canonicalize production.
 */
function canonicalLocalRedirect(request: NextRequest): NextResponse | null {
  if (!process.env.WEB_ORIGIN) return null;
  try {
    const configured = new URL(process.env.WEB_ORIGIN);
    const incoming = request.nextUrl;
    if (configured.protocol !== 'http:' || configured.hostname !== '127.0.0.1' ||
        !configured.port || incoming.hostname !== 'localhost' ||
        incoming.protocol !== configured.protocol || incoming.port !== configured.port) return null;
    const destination = new URL(incoming.pathname + incoming.search, configured.origin);
    const response = NextResponse.redirect(destination, 307);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    // Never create redirects to untrusted/malformed environment origins.
    return null;
  }
}

function loginRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function middleware(request: NextRequest) {
  const canonical = canonicalLocalRedirect(request);
  if (canonical) return canonical;
  const pathname = request.nextUrl.pathname;
  if (publicPages.has(pathname)) return NextResponse.next();

  // Only forward approved cookie names. A user-made/fake cookie does not grant access.
  const cookie = accessCookieNames
    .map((name) => request.cookies.get(name))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => `${item.name}=${item.value}`)
    .join('; ');
  if (!cookie || cookie.length > 8192) return loginRedirect(request);

  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  if (!base) return loginRedirect(request); // fail closed when API auth is unavailable

  try {
    // A revoked/expired/forged session must not render the workspace shell.
    const response = await fetch(`${base}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookie, Accept: 'application/json' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (response.status !== 200) return loginRedirect(request);
    const session: unknown = await response.json();
    if (!session || typeof session !== 'object' || !('id' in session) ||
        typeof session.id !== 'string' || !('roles' in session) ||
        !Array.isArray(session.roles)) return loginRedirect(request);
    const next = NextResponse.next();
    next.headers.set('Cache-Control', 'private, no-store');
    return next;
  } catch {
    return loginRedirect(request);
  }
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
