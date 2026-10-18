export type ApiError = { status: number; message: string };

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const ACCESS_KEY = 'adflick_access_token';
const REFRESH_KEY = 'adflick_refresh_token';

export function getStoredTokens() {
  if (typeof window === 'undefined') return { accessToken: '', refreshToken: '' };
  return {
    accessToken: window.localStorage.getItem(ACCESS_KEY) || '',
    refreshToken: window.localStorage.getItem(REFRESH_KEY) || '',
  };
}

export function storeTokens(accessToken: string, refreshToken?: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearStoredTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) { clearStoredTokens(); return null; }
    const payload = await response.json() as { accessToken?: string; refreshToken?: string };
    if (!payload.accessToken || !payload.refreshToken) { clearStoredTokens(); return null; }
    storeTokens(payload.accessToken, payload.refreshToken);
    return payload.accessToken;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let { accessToken } = getStoredTokens();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, cache: 'no-store' });
  if (response.status === 401) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      headers.set('Authorization', `Bearer ${nextToken}`);
      response = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, cache: 'no-store' });
    }
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
