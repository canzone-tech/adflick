'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import '../communication.css';

type Identity = { roles: string[]; displayName: string };
type Policy = {
  emailEnabled: boolean; digits: number; ttlSeconds: number;
  resendSeconds: number; maxAttempts: number; version: number;
  smtpReady: boolean; platformEnabled: boolean; smsEnabled: boolean;
};
type SmsStatus={enabled:boolean;providerReady:boolean;ready:boolean;mobileVerifiedIsNotKyc:boolean;note:string};
type JoinPolicy = { enabled:boolean;version:number;platformEnabled:boolean;otpEnabled:boolean;smtpReady:boolean;memberActivationEnabled:false };
const defaultPolicy: Policy = {
  emailEnabled: false, digits: 6, ttlSeconds: 300,
  resendSeconds: 60, maxAttempts: 5, version: 0,
  smtpReady: false, platformEnabled: false, smsEnabled: false,
};
export default function CommunicationsPage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [policy, setPolicy] = useState<Policy>(defaultPolicy);
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy|null>(null);
  const [smsStatus, setSmsStatus] = useState<SmsStatus|null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    void Promise.all([
      apiRequest<Identity>('/auth/me'),
      apiRequest<Policy>('/member-enrollment/otp/policy'),
      apiRequest<JoinPolicy>('/admin/public-signup/policy'),
      apiRequest<SmsStatus>('/member-enrollment/phone/configuration'),
    ]).then(([user, data, joining, mobile]) => {
      if (alive) { setIdentity(user); setPolicy(data); setJoinPolicy(joining); setSmsStatus(mobile); }
    }).catch((e: unknown) => {
      if (alive) setError(errorMessage(e));
    }).finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  const canEdit = identity?.roles.some(role => ['SUPER_ADMIN','ORGANIZATION_ADMIN'].includes(role)) ?? false;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = await apiRequest<Policy>('/member-enrollment/otp/policy', {
        method: 'PUT', body: JSON.stringify({
          emailEnabled: policy.emailEnabled, digits: policy.digits, ttlSeconds: policy.ttlSeconds,
          resendSeconds: policy.resendSeconds, maxAttempts: policy.maxAttempts, expectedVersion: policy.version,
        }),
      });
      setPolicy(saved);
      setMessage('Policy saved and audited. Transport and platform approval gates remain independent.');
    } catch (e) {
      setError(errorMessage(e));
    } finally { setBusy(false); }
  }
  async function saveJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinPolicy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const changed = await apiRequest<JoinPolicy>('/admin/public-signup/policy', {
        method: 'PUT', body: JSON.stringify({ enabled: joinPolicy.enabled, expectedVersion: joinPolicy.version }),
      });
      setJoinPolicy(changed);
      setMessage('Public account-creation policy saved and audited. Other operator gates remain independent.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  function change(key: 'digits'|'ttlSeconds'|'resendSeconds'|'maxAttempts', value: string) {
    setPolicy(old => ({...old,[key]:Number(value)}));
  }
  return <main className="communication-page">
    <p className="eyebrow">ADMINISTRATION / COMMUNICATIONS</p>
    <h1>Email OTP &amp; SMTP settings</h1>
    <p className="communication-intro">Real tenant-scoped OTP policy from the authenticated API. SMTP credentials remain in protected server configuration—not in the browser.</p>
    {!loaded && <p role="status">Loading secure communications configuration…</p>}
    {error && <p className="communication-error" role="alert">{error} <Link href="/account">Review your account/MFA session</Link>.</p>}
    {message && <p className="communication-success" role="status">{message}</p>}
    {loaded && identity && <div className="communication-grid">
      <section className="communication-panel" aria-labelledby="smtp-title">
        <p className="communication-kicker">PROVIDER STATUS</p>
        <h2 id="smtp-title">SMTP email transport</h2>
        <p className={policy.smtpReady ? 'communication-indicator ok' : 'communication-indicator'}>
          {policy.smtpReady ? 'Configuration present' : 'Not configured'}
        </p>
        <p>This status checks required transport settings, not final inbox delivery. Real provider/mailbox UAT is required before production.</p>
        <dl className="communication-kv">
          <div><dt>Transport security</dt><dd>TLS 465 or mandatory STARTTLS 587</dd></div>
          <div><dt>SMTP credentials</dt><dd>Private server secrets only</dd></div>
          <div><dt>Platform master switch</dt><dd>{policy.platformEnabled ? 'Enabled by operator' : 'Disabled'}</dd></div>
          <div><dt>SMS OTP</dt><dd>{smsStatus?.ready?'Configured (requires provider UAT)':'Disabled or unapproved'}</dd></div>
        </dl>
        <p className="communication-hint">Operator config: ADFLICK_SMTP_HOST, PORT, SECURE, USERNAME, PASSWORD, FROM_EMAIL and feature gates. Secrets are intentionally never returned by the API.</p>
      </section>
      <form className="communication-panel" onSubmit={e=>void submit(e)} aria-labelledby="otp-title">
        <p className="communication-kicker">ORGANIZATION POLICY</p>
        <h2 id="otp-title">Member email verification</h2>
        <label className="communication-toggle">
          <input type="checkbox" checked={policy.emailEnabled} disabled={!canEdit||busy||!policy.smtpReady}
            onChange={e=>setPolicy(p=>({...p,emailEnabled:e.target.checked}))}/>
          <span>Allow organization email OTP requests</span>
        </label>
        <div className="communication-fields">
          <label>OTP digits
            <select value={policy.digits} disabled={!canEdit||busy} onChange={e=>change('digits',e.target.value)}>
              {[6,7,8].map(x=><option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label>Expiry (seconds)
            <input type="number" min={120} max={900} step={1} required value={policy.ttlSeconds}
              disabled={!canEdit||busy} onChange={e=>change('ttlSeconds',e.target.value)}/>
          </label>
          <label>Resend cooldown (seconds)
            <input type="number" min={30} max={300} step={1} required value={policy.resendSeconds}
              disabled={!canEdit||busy} onChange={e=>change('resendSeconds',e.target.value)}/>
          </label>
          <label>Maximum attempts
            <input type="number" min={3} max={8} step={1} required value={policy.maxAttempts}
              disabled={!canEdit||busy} onChange={e=>change('maxAttempts',e.target.value)}/>
          </label>
        </div>
        <p className="communication-hint">Policy version {policy.version}. Every change requires permitted admin role and fresh MFA step-up, is audited, and fails if version changed concurrently.</p>
        {canEdit ? <button className="communication-primary" type="submit" disabled={busy}>
          {busy?'Saving to secure API…':'Save OTP policy'}
        </button> : <p role="status">Read-only role: policy changes require Organization Admin or Super Admin.</p>}
        <p className="communication-hint">Master switches and SMTP provider are managed outside this form. Enabling the organization policy alone does not authorize paid enrollment or payouts.</p>
      </form>
    </div>}
    {loaded&&identity&&smsStatus&&<section className="communication-panel" aria-labelledby="sms-policy-title" style={{marginTop:20}}>
      <p className="communication-kicker">MOBILE VERIFICATION / PROVIDER STATUS</p>
      <h2 id="sms-policy-title">SMS gateway &amp; phone OTP</h2>
      <p className={smsStatus.ready?'communication-indicator ok':'communication-indicator'}>
        {smsStatus.ready?'Approved configuration present':'Not configured or provider approval missing'}
      </p>
      <dl className="communication-kv">
        <div><dt>SMS transport</dt><dd>{smsStatus.providerReady?'Adapter configured':'Disabled'}</dd></div>
        <div><dt>Phone OTP master</dt><dd>{smsStatus.enabled?'Enabled':'Disabled'}</dd></div>
        <div><dt>Identity/KYC</dt><dd>Separate approval required</dd></div>
      </dl>
      <p className="communication-hint">{smsStatus.note} Gateway credentials, sender, legal template and encryption/HMAC keys are strictly server-side. A configured adapter is not provider certification.</p>
    </section>}
    {loaded && identity && joinPolicy && <form className="communication-panel" onSubmit={e=>void saveJoin(e)}
      aria-labelledby="join-policy-title" style={{marginTop:20}}>
      <p className="communication-kicker">PUBLIC REGISTRATION · SEPARATE REVIEW</p>
      <h2 id="join-policy-title">Join Now email-account access</h2>
      <p>Organization-scoped policy only. Email verification creates a login account, not active membership.
        The SRS mobile OTP, sponsor/e-PIN placement and activation remain separately gated.</p>
      <label className="communication-toggle">
        <input type="checkbox" checked={joinPolicy.enabled}
          disabled={!canEdit||busy||!joinPolicy.smtpReady||!joinPolicy.otpEnabled}
          onChange={e=>setJoinPolicy(x=>x?{...x,enabled:e.target.checked}:x)}/>
        <span>Allow this organization to accept public email account requests</span>
      </label>
      <dl className="communication-kv">
        <div><dt>Global public signup</dt><dd>{joinPolicy.platformEnabled?'Operator enabled':'Operator disabled'}</dd></div>
        <div><dt>SMTP ready</dt><dd>{joinPolicy.smtpReady?'Configured':'Unavailable'}</dd></div>
        <div><dt>Email OTP master</dt><dd>{joinPolicy.otpEnabled?'Enabled':'Disabled'}</dd></div>
        <div><dt>Membership activation</dt><dd>Not enabled by public signup</dd></div>
      </dl>
      <p className="communication-hint">Policy version {joinPolicy.version}. Admin JWT and current MFA step-up required.
        The independent ADFLICK_PUBLIC_SIGNUP_POLICY_ENABLED operator gate may reject edits.</p>
      {canEdit&&<button type="submit" className="communication-primary" disabled={busy}>
        {busy?'Saving to API…':'Save public signup policy'}</button>}
      <p className="communication-hint">Public route: <Link href="/join">Join Now</Link>. Disabled tenants are intentionally not available.</p>
    </form>}
  </main>;
}
