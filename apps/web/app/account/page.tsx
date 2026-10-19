'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest, errorMessage } from '../../lib/api';
import '../login/login.css';

type Identity = { id: string; displayName: string; email: string; organizationId: string | null; roles: string[] };
export default function AccountPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [message, setMessage] = useState('Checking your authenticated session…');
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me = await apiRequest<Identity>('/auth/me');
        if (mounted) { setIdentity(me); setMessage('Authenticated API session confirmed.'); }
      } catch (e) {
        if (mounted) { setIdentity(null); setMessage(errorMessage(e)); }
      } finally {
        if (mounted) setLoading(false);
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
  return <main className="login-shell">
    <Link href="/" className="login-back">← ADFLICK dashboard</Link>
    <section className="login-card">
      <div className="login-mark">A▶</div><span className="login-eyebrow">ADFLICK · ACCOUNT</span>
      <h1>Your organization session</h1>
      {loading ? <p role="status">Verifying identity…</p> : identity ? <>
        <p><strong>{identity.displayName}</strong></p><p>{identity.email}</p>
        <p>Role: {identity.roles.join(', ')}</p>
        <p>Organization ID: {identity.organizationId || 'not assigned'}</p>
        <p><Link href="/health">Open authenticated player health</Link></p>
        <button disabled={signingOut} onClick={() => void logout()} aria-label="Sign out of ADFLICK" className="account-logout">
          {signingOut ? 'Signing out…' : 'Sign out securely'}
        </button>
      </> : <p><Link href="/login">Go to sign in</Link></p>}
      <div className="login-notice" role="status">{message}</div>
      <small>Session credentials use Secure, HttpOnly cookies. The API rejects untrusted cross-origin state-changing requests.</small>
    </section>
  </main>;
}
