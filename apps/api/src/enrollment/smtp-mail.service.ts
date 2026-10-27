import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

type SmtpSettings = {
  host: string; port: number; secure: boolean; from: { name: string; address: string };
  user?: string; pass?: string; localTestOnly: boolean;
};
const isEmail = (value: string) => /^[^\s<>@\r\n]{1,64}@[^\s<>@\r\n]{1,189}$/.test(value);
const loopback = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Secrets remain in the server environment. No email provider, test stub,
 * or insecure SMTP fallback is silently substituted in production.
 */
export function smtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings {
  if (env.ADFLICK_SMTP_ENABLED !== 'true') throw new ServiceUnavailableException('SMTP delivery is disabled.');
  const host = env.ADFLICK_SMTP_HOST?.trim() ?? '';
  const port = Number(env.ADFLICK_SMTP_PORT ?? '587');
  const secure = env.ADFLICK_SMTP_SECURE === 'true';
  const user = env.ADFLICK_SMTP_USERNAME?.trim();
  const pass = env.ADFLICK_SMTP_PASSWORD;
  const fromName = (env.ADFLICK_SMTP_FROM_NAME || 'ADFLICK').trim();
  const fromEmail = (env.ADFLICK_SMTP_FROM_EMAIL ?? '').trim().toLowerCase();
  const localTestOnly = env.NODE_ENV === 'test'
    && env.ADFLICK_SMTP_INSECURE_LOOPBACK_TEST === 'true' && loopback.has(host);
  if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || host.length > 253 ||
      !Number.isInteger(port) || port < 1 || port > 65535 ||
      !isEmail(fromEmail) || !fromName || fromName.length > 80 || /[\r\n<>]/.test(fromName) ||
      Boolean(user) !== Boolean(pass) || (pass && pass.length < 1) ||
      (!secure && port === 465) || (secure && port === 587)) {
    throw new ServiceUnavailableException('SMTP delivery configuration is incomplete or invalid.');
  }
  if (localTestOnly && env.CI !== 'true' && env.NODE_ENV !== 'test') {
    throw new ServiceUnavailableException('Insecure SMTP is strictly test-only.');
  }
  return { host, port, secure, user, pass, from: { name: fromName, address: fromEmail }, localTestOnly };
}

@Injectable()
export class SmtpMailService {
  configurationReady(): boolean {
    try { smtpSettings(); return true; } catch { return false; }
  }

  async sendEnrollmentOtp(to: string, code: string, expiryMinutes: number): Promise<void> {
    const settings = smtpSettings();
    if (!isEmail(to) || !/^\d{6,8}$/.test(code) || !Number.isInteger(expiryMinutes) ||
        expiryMinutes < 1 || expiryMinutes > 30) {
      throw new ServiceUnavailableException('Mail delivery validation failed.');
    }
    const transport = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure && !settings.localTestOnly,
      ...(settings.user && settings.pass ? { auth: { user: settings.user, pass: settings.pass } } : {}),
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 10_000,
      pool: false,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail({
        from: settings.from, to, subject: 'ADFLICK membership email verification',
        text: `Your ADFLICK verification code is ${code}.\n\nIt expires in ${expiryMinutes} minutes. Do not share it.\nIf you did not request this, ignore the message.`,
        disableFileAccess: true, disableUrlAccess: true,
      });
      if (!result.accepted?.some(address => address.toLowerCase() === to.toLowerCase())) {
        throw new Error('SMTP did not accept the intended recipient.');
      }
    } catch {
      // Never expose SMTP credentials, provider diagnostics or OTP to the API.
      throw new ServiceUnavailableException('SMTP server did not accept the verification email.');
    } finally {
      transport.close();
    }
  }
}
