import type { CookieOptions } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from './auth.constants';

if (process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_SECURE === 'false') {
  throw new Error('AUTH_COOKIE_SECURE=false is forbidden in production. Use HTTPS and Secure cookies.');
}
const secure = process.env.AUTH_COOKIE_SECURE === 'true'
  || (process.env.AUTH_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production');
const sameSiteValue = (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSiteValue)) {
  throw new Error('AUTH_COOKIE_SAME_SITE must be lax, strict or none.');
}
if (sameSiteValue === 'none' && !secure) {
  throw new Error('AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true.');
}

const sameSite = sameSiteValue as 'lax' | 'strict' | 'none';
const prefix = secure ? '__Host-' : '';

export const ACCESS_COOKIE_NAME = `${prefix}adflick-access`;
export const REFRESH_COOKIE_NAME = `${prefix}adflick-refresh`;

export function accessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  };
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function clearCookieOptions(): CookieOptions {
  return { httpOnly: true, secure, sameSite, path: '/' };
}
