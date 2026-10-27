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
if (process.env.MFA_ENCRYPTION_KEY) {
  try {
    if (Buffer.from(process.env.MFA_ENCRYPTION_KEY.trim(), 'base64url').length !== 32) errors.push('MFA_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  } catch {
    errors.push('MFA_ENCRYPTION_KEY must be valid base64url.');
  }
}
if (production) {
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (process.env[key] && process.env[key].length < 32) errors.push(`${key} must be at least 32 characters in production.`);
  }
  if (!process.env.MFA_ENCRYPTION_KEY?.trim()) errors.push('MFA_ENCRYPTION_KEY is required in production.');
  else if (/change_me|replace_with|example|placeholder|secret$/i.test(process.env.MFA_ENCRYPTION_KEY)) errors.push('MFA_ENCRYPTION_KEY appears to contain a placeholder value.');
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

const smtpActive = process.env.ADFLICK_SMTP_ENABLED === 'true';
const otpActive = process.env.ADFLICK_MEMBER_EMAIL_OTP_ENABLED === 'true';
if (smtpActive || otpActive) {
  if (!smtpActive) errors.push('Email OTP requires ADFLICK_SMTP_ENABLED=true.');
  for (const key of ['ADFLICK_SMTP_HOST','ADFLICK_SMTP_FROM_EMAIL']) {
    if (!process.env[key]?.trim()) errors.push(key+' is required when SMTP/OTP is enabled.');
  }
  const port=Number(process.env.ADFLICK_SMTP_PORT ?? '587');
  if (!Number.isInteger(port)||port<1||port>65535) errors.push('SMTP port must be from 1 to 65535.');
  const secure=process.env.ADFLICK_SMTP_SECURE === 'true';
  if ((secure && port===587)||(!secure && port===465)) errors.push('SMTP port 465 requires implicit TLS; port 587 requires STARTTLS.');
  if (Boolean(process.env.ADFLICK_SMTP_USERNAME?.trim())!==Boolean(process.env.ADFLICK_SMTP_PASSWORD?.trim())) {
    errors.push('SMTP username/password must both be configured or both be absent.');
  }
  if (otpActive && (!process.env.ADFLICK_MEMBER_OTP_HASH_PEPPER || process.env.ADFLICK_MEMBER_OTP_HASH_PEPPER.length<32)) {
    errors.push('ADFLICK_MEMBER_OTP_HASH_PEPPER must be a distinct secret of >=32 characters.');
  }
}
if (production && process.env.ADFLICK_SMTP_INSECURE_LOOPBACK_TEST === 'true') {
  errors.push('Insecure loopback SMTP transport is forbidden in production.');
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Environment validation passed (${production ? 'production' : 'non-production'} mode).`);
}
