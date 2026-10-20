import { randomBytes } from 'node:crypto';
import {
  buildOtpAuthUri,
  decryptSecret,
  encryptSecret,
  generateBase32Secret,
  generateRecoveryCodes,
  generateTotp,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp,
} from './mfa.crypto';

describe('MFA cryptography', () => {
  beforeEach(() => {
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-mfa-crypto-32-characters';
    delete process.env.MFA_ENCRYPTION_KEY;
  });

  it('generates valid TOTP secrets and rejects invalid codes', () => {
    const secret = generateBase32Secret();
    const now = Date.UTC(2026, 9, 20, 8, 30, 0);
    const code = generateTotp(secret, now);
    expect(verifyTotp(secret, code, now)).toMatchObject({ valid: true });
    expect(verifyTotp(secret, '000000', now)).toEqual({ valid: false });
  });

  it('accepts one configured clock step of drift but not an old window', () => {
    const secret = generateBase32Secret();
    const now = Date.UTC(2026, 9, 20, 8, 30, 30);
    const previous = generateTotp(secret, now - 30_000);
    expect(verifyTotp(secret, previous, now)).toMatchObject({ valid: true });
    const old = generateTotp(secret, now - 90_000);
    expect(verifyTotp(secret, old, now)).toEqual({ valid: false });
  });

  it('protects the authenticator secret with authenticated encryption', () => {
    const plaintext = randomBytes(20).toString('hex');
    const ciphertext = encryptSecret(plaintext);
    expect(ciphertext).not.toContain(plaintext);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it('normalizes and hashes recovery codes without retaining the raw value', () => {
    const code = 'abcd-1234-efgh-5678';
    expect(normalizeRecoveryCode(code)).toBe('ABCD1234EFGH5678');
    expect(hashRecoveryCode(code)).toHaveLength(64);
    expect(hashRecoveryCode(code)).toBe(hashRecoveryCode('ABCD 1234 EFGH 5678'));
    expect(hashRecoveryCode(code)).not.toBe(hashRecoveryCode('abcd-1234-efgh-5679'));
  });

  it('generates unique recovery codes and an authenticator URI', () => {
    const secret = generateBase32Secret();
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes.every((code) => /^[A-F0-9]+(?:-[A-F0-9]+)+$/.test(code))).toBe(true);
    expect(buildOtpAuthUri('operator@example.test', secret)).toContain('otpauth://totp/');
    expect(buildOtpAuthUri('operator@example.test', secret)).toContain(`secret=${secret}`);
  });
});
