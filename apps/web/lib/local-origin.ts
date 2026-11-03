/** Correct the browser's local web Origin without changing its web port. */
export function canonicalLocalLoginUrl(currentHref: string, configuredApiBase: string): string | null {
  if (!configuredApiBase) return null;
  try {
    const page = new URL(currentHref);
    const api = new URL(configuredApiBase);
    if (page.protocol !== 'http:' || page.hostname !== 'localhost' || !page.port ||
        api.protocol !== 'http:' || api.hostname !== '127.0.0.1' || !api.port ||
        !api.pathname.startsWith('/api/v1')) return null;
    page.hostname = '127.0.0.1';
    return page.toString();
  } catch { return null; }
}
