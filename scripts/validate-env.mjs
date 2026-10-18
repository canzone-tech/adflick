#!/usr/bin/env node
import process from 'node:process';

const errors = [];
const warnings = [];
const production = process.env.NODE_ENV === 'production';
const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
for (const key of required) {
  const value = process.env[key]?.trim();
  if (!value) errors.push(`${key} is required.`);
  else if (production && /change_me|replace_with|example|placeholder|secret$/i.test(value)) {
    errors.push(`${key} appears to contain a placeholder value.`);
  }
}
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('mysql://') && !process.env.DATABASE_URL.startsWith('mysql2://')) {
  errors.push('DATABASE_URL must use the MySQL protocol for this project.');
}
if (process.env.JWT_ACCESS_SECRET && process.env.JWT_REFRESH_SECRET && process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
  errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
}
if (production) {
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (process.env[key] && process.env[key].length < 32) errors.push(`${key} must be at least 32 characters in production.`);
  }
}
if (production) {
  if (process.env.WEB_ORIGIN?.includes('localhost')) errors.push('WEB_ORIGIN must not include localhost in production.');
  if (!process.env.WEB_ORIGIN?.trim()) errors.push('WEB_ORIGIN must be explicitly configured in production.');
  if (process.env.WEB_ORIGIN?.split(',').some((origin) => { try { return new URL(origin.trim()).protocol !== 'https:'; } catch { return true; } })) {
    errors.push('Every WEB_ORIGIN must be a valid HTTPS origin in production.');
  }
  if (process.env.ALERT_WEBHOOK_URL) {
    try {
      const webhook = new URL(process.env.ALERT_WEBHOOK_URL);
      const allowedHosts = (process.env.ALERT_WEBHOOK_ALLOWED_HOSTS ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
      if (webhook.protocol !== 'https:') errors.push('ALERT_WEBHOOK_URL must use HTTPS in production.');
      if (webhook.username || webhook.password || webhook.hash) errors.push('ALERT_WEBHOOK_URL must not contain credentials or a fragment.');
      if (!allowedHosts.includes(webhook.hostname.toLowerCase())) errors.push('ALERT_WEBHOOK_URL hostname must match ALERT_WEBHOOK_ALLOWED_HOSTS.');
    } catch { errors.push('ALERT_WEBHOOK_URL must be a valid URL.'); }
  }
} else {
  warnings.push('Non-production environment: placeholder credentials may be present; never reuse them in a shared deployment.');
}
for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Environment validation passed (${production ? 'production' : 'non-production'} mode).`);
}
