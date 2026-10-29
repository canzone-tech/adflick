import { NextResponse, type NextRequest } from 'next/server';

/**
 * The NestJS API owns authentication, revocation and tenant/RBAC decisions.
 * Do not trust cookie presence (or a client role claim) as a valid login.
 * Run before rendering any operations page or its React Server Components.
 */
const accessCookieNames = ['adflick-access', '__Host-adflick-access'] as const;
const publicPages = new Set(['/login', '/join']);

function loginRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function middleware(request: NextRequest) {
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
