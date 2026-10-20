'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, errorMessage } from '../../lib/api';
import '../login/login.css';

type Identity = { id: string; displayName: string; email: string; organizationId: string | null; roles: string[] };
type MfaStatus = { enabled: boolean; enrollmentPending: boolean; privileged: boolean; stepUpVerifiedUntil: string | null };
type MfaSetup = { secret: string; otpauthUri: string; recoveryCodes: string[]; enrollmentExpiresAt?: string; message: string };

export default function AccountPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [message, setMessage] = useState('Checking your authenticated session…');
  const [mfaMessage, setMfaMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [enrollPassword, setEnrollPassword] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [stepUpCode, setStepUpCode] = useState('');
  const [rotatePassword, setRotatePassword] = useState('');
  const [rotateCode, setRotateCode] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  async function refreshMfa() {
    try {
      const status = await apiRequest<MfaStatus>('/auth/mfa/status');
      setMfa(status);
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally {
      setMfaLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [me, status] = await Promise.all([
          apiRequest<Identity>('/auth/me'),
          apiRequest<MfaStatus>('/auth/mfa/status'),
        ]);
        if (mounted) {
          setIdentity(me);
          setMfa(status);
          setMessage('Authenticated API session confirmed.');
        }
      } catch (e) {
        if (mounted) {
          setIdentity(null);
          setMessage(errorMessage(e));
          setMfaMessage(errorMessage(e));
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setMfaLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function logout() {
    setSigningOut(true);
    setMessage('Revoking the current server-side session…');
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
      router.replace('/login');
    } catch (e) {
      setMessage('Logout could not be confirmed by the API: ' + errorMessage(e));
    } finally { setSigningOut(false); }
  }

  async function beginEnrollment() {
    setBusy(true);
    setMfaMessage('Starting encrypted MFA enrollment…');
    try {
      const result = await apiRequest<MfaSetup>('/auth/mfa/enroll', { method: 'POST', body: JSON.stringify({ currentPassword: enrollPassword }) });
      setSetup(result);
      setEnrollCode('');
      setMfaMessage('Setup secret generated. Add it to your authenticator, then enter the current 6-digit code to confirm.');
      await refreshMfa();
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally { setBusy(false); }
  }

  async function confirmEnrollment() {
    setBusy(true);
    try {
      await apiRequest('/auth/mfa/enroll/confirm', { method: 'POST', body: JSON.stringify({ code: enrollCode }) });
      setEnrollPassword('');
      setEnrollCode('');
      setMfaMessage('MFA enabled. This browser session is step-up verified. Keep the recovery codes offline.');
      await refreshMfa();
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally { setBusy(false); }
  }

  async function createChallenge() {
    setBusy(true);
    try {
      const result = await apiRequest<{ challengeId: string; expiresAt: string }>('/auth/mfa/challenge', { method: 'POST' });
      setChallengeId(result.challengeId);
      setStepUpCode('');
      setMfaMessage('Step-up challenge created. Enter the current authenticator code before it expires.');
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally { setBusy(false); }
  }

  async function verifyChallenge() {
    setBusy(true);
    try {
      await apiRequest('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ challengeId, code: stepUpCode }) });
      setChallengeId('');
      setStepUpCode('');
      setMfaMessage('Privileged step-up verified for this session.');
      await refreshMfa();
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally { setBusy(false); }
  }

  async function rotateMfa() {
    setBusy(true);
    try {
      const result = await apiRequest<MfaSetup>('/auth/mfa/rotate', { method: 'POST', body: JSON.stringify({ currentPassword: rotatePassword, code: rotateCode }) });
      setSetup(result);
      setRotatePassword('');
      setRotateCode('');
      setMfaMessage(result.message);
      await refreshMfa();
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally { setBusy(false); }
  }

  async function recoverMfa() {
    setBusy(true);
    try {
      const result = await apiRequest<MfaSetup>('/auth/mfa/recover', { method: 'POST', body: JSON.stringify({ currentPassword: recoveryPassword, recoveryCode }) });
      setSetup(result);
      setRecoveryPassword('');
      setRecoveryCode('');
      setMfaMessage(result.message);
      await refreshMfa();
    } catch (e) {
      setMfaMessage(errorMessage(e));
    } finally { setBusy(false); }
  }

  return <main className="login-shell">
    <Link href="/" className="login-back">← ADFLICK dashboard</Link>
    <section className="login-card account-card">
      <div className="login-mark">A▶</div><span className="login-eyebrow">ADFLICK · ACCOUNT</span>
      <h1>Your organization session</h1>
      {loading ? <p role="status">Verifying identity…</p> : identity ? <>
        <p><strong>{identity.displayName}</strong></p><p>{identity.email}</p>
        <p>Role: {identity.roles.join(', ')}</p>
        <p>Organization ID: {identity.organizationId || 'not assigned'}</p>
        <p><Link href="/health">Open authenticated player health</Link></p>

        <section className="mfa-panel" aria-labelledby="mfa-heading">
          <div className="mfa-heading-row"><div><span className="login-eyebrow">PRIVILEGED SECURITY</span><h2 id="mfa-heading">Multi-factor authentication</h2></div><span data-testid="mfa-status" className={mfa?.enabled ? 'mfa-badge enabled' : 'mfa-badge'}>{mfaLoading ? 'Checking…' : mfa?.enabled ? 'Enabled' : 'Not enabled'}</span></div>
          <p className="mfa-copy">Privileged operational mutations require a fresh MFA step-up. Secrets and recovery codes are never returned by the status endpoint.</p>
          {mfa?.privileged && !mfa.enabled && !setup && <form onSubmit={(e) => { e.preventDefault(); void beginEnrollment(); }} className="mfa-form">
            <label>Current password<input data-testid="mfa-enroll-password" type="password" autoComplete="current-password" value={enrollPassword} onChange={(e) => setEnrollPassword(e.target.value)} required maxLength={128} /></label>
            <button data-testid="mfa-enroll-button" disabled={busy}>{busy ? 'Preparing…' : 'Start MFA enrollment'}</button>
          </form>}
          {mfa?.enrollmentPending && setup && <form onSubmit={(e) => { e.preventDefault(); void confirmEnrollment(); }} className="mfa-form">
            <label>Authenticator code<input data-testid="mfa-enroll-code" inputMode="numeric" autoComplete="one-time-code" value={enrollCode} onChange={(e) => setEnrollCode(e.target.value)} required pattern="[0-9]{6}" maxLength={6} /></label>
            <button data-testid="mfa-confirm-button" disabled={busy}>{busy ? 'Confirming…' : 'Confirm MFA'}</button>
          </form>}
          {setup && <div className="mfa-secret" data-testid="mfa-setup-output">
            <strong>Store this setup data securely</strong>
            <p>Manual secret</p><code data-testid="mfa-secret">{setup.secret}</code>
            <details><summary>Authenticator URI</summary><code>{setup.otpauthUri}</code></details>
            <p>Recovery codes — each code is single-use:</p><pre data-testid="mfa-recovery-codes">{setup.recoveryCodes.join('\n')}</pre>
          </div>}
          {mfa?.enabled && <div className="mfa-stepup">
            <div><strong>Privileged step-up</strong><span>{mfa.stepUpVerifiedUntil ? `Verified until ${new Date(mfa.stepUpVerifiedUntil).toLocaleTimeString()}.` : 'Not verified for this current session.'}</span></div>
            {!challengeId ? <button data-testid="mfa-challenge-button" disabled={busy} onClick={() => void createChallenge()}>{busy ? 'Preparing…' : 'Request MFA step-up'}</button> : <form onSubmit={(e) => { e.preventDefault(); void verifyChallenge(); }} className="mfa-form-inline"><input data-testid="mfa-challenge-code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={stepUpCode} onChange={(e) => setStepUpCode(e.target.value)} required pattern="[0-9]{6}" maxLength={6} /><button data-testid="mfa-verify-button" disabled={busy}>{busy ? 'Verifying…' : 'Verify step-up'}</button></form>}
          </div>}
          {mfa?.enabled && <details className="mfa-recovery-tools"><summary>Rotate or recover MFA</summary><div className="mfa-grid">
            <form onSubmit={(e) => { e.preventDefault(); void rotateMfa(); }} className="mfa-form"><h3>Rotate authenticator</h3><label>Current password<input type="password" autoComplete="current-password" value={rotatePassword} onChange={(e) => setRotatePassword(e.target.value)} required maxLength={128} /></label><label>Current MFA code<input inputMode="numeric" value={rotateCode} onChange={(e) => setRotateCode(e.target.value)} required pattern="[0-9]{6}" maxLength={6} /></label><button disabled={busy}>Rotate MFA</button></form>
            <form onSubmit={(e) => { e.preventDefault(); void recoverMfa(); }} className="mfa-form"><h3>Recover with a code</h3><label>Current password<input type="password" autoComplete="current-password" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} required maxLength={128} /></label><label>Unused recovery code<input value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} required maxLength={64} /></label><button disabled={busy}>Recover MFA</button></form>
          </div></details>}
          {mfaMessage && <div className="login-notice" role="status">{mfaMessage}</div>}
        </section>

        <button disabled={signingOut} onClick={() => void logout()} aria-label="Sign out of ADFLICK" className="account-logout">
          {signingOut ? 'Signing out…' : 'Sign out securely'}
        </button>
      </> : <p><Link href="/login">Go to sign in</Link></p>}
      <div className="login-notice" role="status">{message}</div>
      <small>Session credentials use Secure, HttpOnly cookies. The API rejects untrusted cross-origin state-changing requests.</small>
    </section>
  </main>;
}
