import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MFA_TOTP_STEP_SECONDS, MFA_TOTP_WINDOW_STEPS } from './mfa.policy';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) output += BASE32_ALPHABET[Number.parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]!;
  return output;
}

export function decodeBase32(value: string): Buffer {
  const normalized = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

export function generateTotp(secret: string, now = Date.now(), stepSeconds = MFA_TOTP_STEP_SECONDS): string {
  return totpForStep(secret, Math.floor(now / 1000 / stepSeconds));
}

export function verifyTotp(secret: string, code: string, now = Date.now(), stepSeconds = MFA_TOTP_STEP_SECONDS, windowSteps = MFA_TOTP_WINDOW_STEPS): { valid: boolean; matchedStep?: number } {
  if (!/^\d{6}$/.test(code)) return { valid: false };
  const currentStep = Math.floor(now / 1000 / stepSeconds);
  const offsets = [0, ...Array.from({ length: windowSteps }, (_, i) => -(i + 1)), ...Array.from({ length: windowSteps }, (_, i) => i + 1)];
  for (const offset of offsets) {
    const expected = Buffer.from(totpForStep(secret, currentStep + offset));
    const candidate = Buffer.from(code);
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return { valid: true, matchedStep: currentStep + offset };
  }
  return { valid: false };
}

function encryptionKey(): Buffer {
  const configured = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (configured) {
    const key = Buffer.from(configured, 'base64url');
    if (key.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    return key;
  }
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();
  if (!refreshSecret) throw new Error('MFA_ENCRYPTION_KEY or JWT_REFRESH_SECRET is required for MFA secret protection.');
  return createHash('sha256').update(`adflick-mfa:${refreshSecret}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = payload.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted MFA secret.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function normalizeRecoveryCode(code: string): string { return code.replace(/[\s-]/g, '').toUpperCase(); }
export function hashRecoveryCode(code: string): string { return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex'); }
export function generateRecoveryCodes(count: number): string[] {
  return Array.from({ length: count }, () => randomBytes(12).toString('hex').toUpperCase().match(/.{1,4}/g)!.join('-'));
}
export function buildOtpAuthUri(email: string, secret: string): string {
  const issuer = 'ADFLICK';
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${MFA_TOTP_STEP_SECONDS}`;
}
