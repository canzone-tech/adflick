'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import '../communication.css';

type Identity={roles:string[]};
type Status={
  verified:boolean;maskedPhone:string|null;expiresAt:string|null;
  pendingChallengeId:string|null;resendAfter:string|null;
  providerReady:boolean;channel:'SMS';pendingActivation:boolean;
};
type Started={challengeId:string;maskedPhone:string;expiresAt:string;resendAfter:string;message:string};

export default function PhoneVerificationPage() {
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [status,setStatus]=useState<Status|null>(null);
  const [phone,setPhone]=useState('');
  const [smsConsent,setSmsConsent]=useState(false);
  const [code,setCode]=useState('');
  const [challengeId,setChallengeId]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(0);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function refresh() {
    const state=await apiRequest<Status>('/member-enrollment/phone/status');
    setStatus(state);setChallengeId(state.pendingChallengeId??'');
  }
  useEffect(()=>{
    let active=true;
    void Promise.all([
      apiRequest<Identity>('/auth/me'),
      apiRequest<Status>('/member-enrollment/phone/status'),
    ]).then(([user,state])=>{
      if(!active)return;
      setIdentity(user);setStatus(state);setChallengeId(state.pendingChallengeId??'');
    }).catch(e=>{if(active)setError(errorMessage(e));})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());tick();
    const timer=setInterval(tick,1000);
    return()=>clearInterval(timer);
  },[]);
  async function send(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError('');setMessage('');setBusy(true);
    try {
      const result=await apiRequest<Started>('/member-enrollment/phone/request',{
        method:'POST',body:JSON.stringify({phone,smsConsentAccepted:smsConsent}),
      });
      setPhone('');setCode('');setSmsConsent(false);setChallengeId(result.challengeId);
      setMessage(result.message);
      await refresh();
    } catch(e) {setError(errorMessage(e));}
    finally {setBusy(false);}
  }
  async function verify(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setError('');setMessage('');setBusy(true);
    try {
      await apiRequest('/member-enrollment/phone/verify',{
        method:'POST',body:JSON.stringify({challengeId,code}),
      });
      setCode('');await refresh();
      setMessage('Phone ownership verified for pending enrollment. KYC, activation and payments remain unapproved.');
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }
  const cooldown=status?.resendAfter?new Date(status.resendAfter).getTime()>now:false;
  const allowed=identity?.roles.includes('MEMBER')??false;
  return <main className="communication-page">
    <p className="eyebrow">MEMBER / SECURITY</p>
    <h1>Mobile phone verification</h1>
    <p className="communication-intro">Real SMS OTP is dispatched only through an independently approved configured gateway. Your phone is encrypted in MySQL; codes are never stored in plaintext.</p>
    {loading&&<p role="status">Loading mobile verification status…</p>}
    {error&&<p className="communication-error" role="alert">{error}</p>}
    {message&&<p className="communication-success" role="status">{message}</p>}
    {!loading&&identity&&!allowed&&<p role="alert">This page requires a MEMBER account.</p>}
    {!loading&&allowed&&status&&<section className="communication-panel communication-verify">
      <h2>Verified phone ownership</h2>
      <p className={status.verified?'communication-indicator ok':'communication-indicator'}>
        {status.verified?'Mobile OTP verified':'Mobile OTP not yet verified'}
      </p>
      {status.maskedPhone&&<p>Phone: <strong>{status.maskedPhone}</strong></p>}
      {status.expiresAt&&<p>Challenge expiry: <time dateTime={status.expiresAt}>{new Date(status.expiresAt).toLocaleString()}</time></p>}
      {!status.providerReady&&<p role="status">SMS provider/template approval or configuration is missing. Sending is disabled, and no simulated delivery will be used.</p>}
      {!status.verified&&<>
        <form onSubmit={e=>void send(e)} className="communication-otp-form">
          <label>Mobile number in international E.164 format
            <input type="tel" autoComplete="tel" inputMode="tel"
              pattern="\+[1-9][0-9]{7,14}" placeholder="+919876543210"
              required maxLength={16} value={phone}
              onChange={e=>setPhone(e.target.value)} disabled={busy||!status.providerReady}/>
          </label>
          <label className="communication-toggle">
            <input type="checkbox" required checked={smsConsent} onChange={e=>setSmsConsent(e.target.checked)}
              disabled={busy||!status.providerReady}/>
            <span>I consent to one transactional verification SMS for this enrollment request.</span>
          </label>
          <button type="submit" className="communication-primary"
            disabled={busy||!status.providerReady||cooldown||!smsConsent}>
            {busy?'Contacting approved SMS gateway…':cooldown?'Resend cooldown active':'Request mobile OTP'}
          </button>
        </form>
        {cooldown&&status.resendAfter&&<p className="communication-hint">Resend available after <time dateTime={status.resendAfter}>{new Date(status.resendAfter).toLocaleString()}</time>.</p>}
        {challengeId&&<form className="communication-otp-form" onSubmit={e=>void verify(e)}>
          <label>Six-digit SMS code
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
              required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}
              disabled={busy}/>
          </label>
          <button type="submit" className="communication-primary" disabled={busy||code.length!==6}>
            {busy?'Verifying SMS…':'Verify mobile code'}
          </button>
        </form>}
      </>}
      {status.verified&&<p className="communication-hint">Phone proof must be consumed exactly once by <Link href="/member-onboarding">atomic pending enrollment</Link>. Verified phone is not KYC or approved paid membership.</p>}
      <p className="communication-hint">Gateway acceptance does not guarantee delivery to the handset. Contact your approved support channel for delivery issues.</p>
    </section>}
  </main>;
}
