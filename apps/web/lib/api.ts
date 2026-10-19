export type ApiError = { status: number; message: string };

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

async function refreshAccessSession(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const requestInit: RequestInit = { ...init, headers, credentials: 'include', cache: 'no-store' };
  let response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, requestInit);
  const isAuthEndpoint = /^\/auth\/(login|refresh|logout)$/.test(path);
  if (response.status === 401 && !isAuthEndpoint && await refreshAccessSession()) {
    response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, requestInit);
  }
  const payload = await response.json().catch(() => null) as { message?: string | string[] } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? (Array.isArray(payload.message) ? payload.message.join(', ') : payload.message)
      : `API request failed (${response.status})`;
    throw { status: response.status, message: String(message || `API request failed (${response.status})`) } satisfies ApiError;
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String((error as {message: unknown}).message);
  return 'Unable to connect to the API. Check the API URL and network connection.';
}

export function formatAge(value?: string | null): string {
  if (!value) return 'Never';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return 'Unknown';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
