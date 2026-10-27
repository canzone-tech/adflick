'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import './join.css';

type Tenant = {
  organizationSlug: string; organizationName: string; consentVersion: string;
  consentDocumentSha256: string; consentText: string;
  emailOnlyAccountBootstrap: boolean; mobileOtpVerified: false; memberActivated: false;
};
type Started = { requestId: string; expiresAt: string; message: string };
type Verified = { emailVerified: boolean; memberActivated: false; profileCreated: false; message: string };

export default function JoinPage() {
  const [tenantSlug,setTenantSlug]=useState('');
  const [tenant,setTenant]=useState<Tenant|null>(null);
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [consentAccepted,setConsentAccepted]=useState(false);
  const [requestId,setRequestId]=useState('');
  const [code,setCode]=useState('');
  const [expiresAt,setExpiresAt]=useState('');
  const [done,setDone]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  async function lookup(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');setNotice('');setTenant(null);setRequestId('');
    try {
      const slug=tenantSlug.trim().toLowerCase();
      const org=await apiRequest<Tenant>('/public-signup/organizations/'+encodeURIComponent(slug));
      setTenant(org);
    } catch(err){setError(errorMessage(err));}
    finally{setBusy(false);}
  }

  async function begin(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(!tenant)return;
    if(password!==confirmPassword){setError('Passwords must match.');return;}
    setBusy(true);setError('');setNotice('');
    try {
      const created=await apiRequest<Started>('/public-signup/start',{
        method:'POST',body:JSON.stringify({
          organizationSlug:tenant.organizationSlug,email,displayName:fullName,password,
          consentVersion:tenant.consentVersion,
          consentDocumentSha256:tenant.consentDocumentSha256,consentAccepted,
        }),
      });
      setRequestId(created.requestId);setExpiresAt(created.expiresAt);
      setPassword('');setConfirmPassword('');
      setNotice(created.message+' Delivery depends on your email provider.');
    }catch(err){setError(errorMessage(err));}
    finally{setBusy(false);}
  }

  async function verify(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const result=await apiRequest<Verified>('/public-signup/verify',{
        method:'POST',body:JSON.stringify({requestId,code}),
      });
      if(result.emailVerified){setDone(true);setCode('');setNotice(result.message);}
      else setError('Verification could not be confirmed.');
    }catch(err){setError(errorMessage(err));}
    finally{setBusy(false);}
  }

  return <main className="join-page">
    <header className="join-header">
      <Link href="/" className="join-brand">A<span>▶</span> ADFLICK</Link>
      <nav aria-label="Public access"><Link href="/login">Member login</Link></nav>
    </header>
    <div className="join-container">
      <p className="join-eyebrow">ADFLICK · VERIFIED ACCOUNT SETUP</p>
      <h1>Join ADFLICK</h1>
      <p className="join-intro">Create an email-verified login account for an approved organization. This is not a membership activation: your sponsor, e-PIN, phone OTP and placement must be confirmed separately.</p>
      {error&&<p role="alert" className="join-error">{error}</p>}
      {notice&&<p role="status" className="join-success">{notice}</p>}

      {done?<section className="join-card">
        <h2>Email verification confirmed</h2>
        <p>Your login account is ready. Membership profile, sponsor/placement, e-PIN, phone verification and activation are still pending approved onboarding.</p>
        <Link className="join-action" href="/login">Sign in securely</Link>
      </section>:requestId?<section className="join-card">
        <p className="join-step">Step 3 / 3</p><h2>Verify your registered email</h2>
        <p>Enter the six-digit code sent to <strong>{email}</strong>. If the address already had an account, no additional email is sent.</p>
        {expiresAt&&<p className="join-meta">Challenge expires: <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString()}</time>.</p>}
        <form onSubmit={e=>void verify(e)}>
          <label>One-time verification code
            <input autoComplete="one-time-code" inputMode="numeric" required maxLength={6}
              pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/>
          </label>
          <button disabled={busy||code.length!==6}>{busy?'Checking secure code…':'Verify email & create login account'}</button>
        </form>
        <button className="join-secondary" disabled={busy} onClick={()=>{setRequestId('');setCode('');setError('');setNotice('');}}>Start a new request</button>
      </section>:tenant?<section className="join-card">
        <p className="join-step">Step 2 / 3</p><h2>Account details</h2>
        <p>Organization: <strong>{tenant.organizationName}</strong></p>
        <form onSubmit={e=>void begin(e)}>
          <label>Full name
            <input autoComplete="name" required minLength={2} maxLength={160} value={fullName} onChange={e=>setFullName(e.target.value)}/>
          </label>
          <label>Email address
            <input autoComplete="email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/>
          </label>
          <label>Password (12–128 characters)
            <input autoComplete="new-password" type="password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/>
          </label>
          <label>Confirm password
            <input autoComplete="new-password" type="password" required minLength={12} maxLength={128} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/>
          </label>
          <section className="join-legal" aria-labelledby="legal-title">
            <h3 id="legal-title">Approved consent — version {tenant.consentVersion}</h3>
            <div className="join-legal-text" tabIndex={0}>{tenant.consentText}</div>
            <label className="join-checkbox">
              <input type="checkbox" required checked={consentAccepted} onChange={e=>setConsentAccepted(e.target.checked)}/>
              <span>I have read and accept the approved version shown above.</span>
            </label>
          </section>
          <button disabled={busy||!consentAccepted}>{busy?'Sending secure email…':'Send verification email'}</button>
        </form>
        <button className="join-secondary" onClick={()=>{setTenant(null);setConsentAccepted(false);}}>Change organization</button>
      </section>:<section className="join-card">
        <p className="join-step">Step 1 / 3</p><h2>Find an approved organization</h2>
        <p>Public signup is only available where organization registration, real SMTP and the current legal consent are explicitly enabled.</p>
        <form onSubmit={e=>void lookup(e)}>
          <label>Organization registration code
            <input autoComplete="off" required minLength={3} maxLength={180} pattern="[a-z0-9-]+"
              value={tenantSlug} onChange={e=>setTenantSlug(e.target.value.toLowerCase())} placeholder="Organization code"/>
          </label>
          <button disabled={busy}>{busy?'Checking registration availability…':'Continue'}</button>
        </form>
      </section>}
      <p className="join-footnote">ADFLICK does not guarantee any earnings or activation from account creation. Mobile OTP, e-PIN validation, sponsor and binary placement follow separate approved requirements.</p>
    </div>
  </main>;
}
