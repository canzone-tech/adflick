'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import '../communication.css';

type Identity = { roles: string[]; email: string };
type Status = { verified:boolean; expiresAt:string|null; pendingChallengeId:string|null; resendAfter:string|null; channel:'EMAIL' };
type Requested = { challengeId:string; expiresAt:string; resendAfter:string; message:string };

export default function EmailVerificationPage() {
  const [identity,setIdentity] = useState<Identity|null>(null);
  const [status,setStatus] = useState<Status|null>(null);
  const [challengeId,setChallengeId] = useState('');
  const [code,setCode] = useState('');
  const [loading,setLoading] = useState(true);
  const [now,setNow] = useState(0);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  async function refresh() {
    const s=await apiRequest<Status>('/member-enrollment/otp/status');
    setStatus(s);
    setChallengeId(s.pendingChallengeId??'');
  }
  useEffect(() => {
    let alive=true;
    void Promise.all([apiRequest<Identity>('/auth/me'),apiRequest<Status>('/member-enrollment/otp/status')])
      .then(([user,s])=>{
        if(!alive)return;
        setIdentity(user);setStatus(s);setChallengeId(s.pendingChallengeId??'');
      }).catch(e=>{if(alive)setError(errorMessage(e));})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[]);
  async function requestCode() {
    setBusy(true);setError('');setMessage('');
    try{
      const result=await apiRequest<Requested>('/member-enrollment/otp/request',{method:'POST'});
      setChallengeId(result.challengeId);
      setCode('');
      setMessage('SMTP server accepted your email OTP request. Check your registered inbox. Final delivery depends on the provider.');
      await refresh();
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }
  async function verifyCode(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      await apiRequest('/member-enrollment/otp/verify',{method:'POST',body:JSON.stringify({challengeId,code})});
      setCode('');setMessage('Email ownership verified. This does not activate your membership or authorize earnings.');
      await refresh();
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }
  useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return ()=>clearInterval(timer);},[]);
  const allowed=identity?.roles.includes('MEMBER')??false;
  const cooldown=status?.resendAfter?new Date(status.resendAfter).getTime()>now:false;
  return <main className="communication-page">
    <p className="eyebrow">MEMBER / SECURITY</p>
    <h1>Email verification</h1>
    <p className="communication-intro">One-time code is delivered only to your account email. Email verification is required before pending e-PIN enrollment and never activates commissions.</p>
    {loading&&<p role="status">Checking your verified account…</p>}
    {error&&<p className="communication-error" role="alert">{error}</p>}
    {message&&<p className="communication-success" role="status">{message}</p>}
    {!loading&&identity&&!allowed&&<p role="alert">This workflow is available only to authenticated MEMBER accounts.</p>}
    {!loading&&identity&&allowed&&<section className="communication-panel communication-verify">
      <p>Registered address: <strong>{identity.email}</strong></p>
      <p className={status?.verified?'communication-indicator ok':'communication-indicator'}>
        {status?.verified?'Verified for pending enrollment':'Email verification required'}
      </p>
      {status?.expiresAt&&<p>Challenge expires: <time dateTime={status.expiresAt}>{new Date(status.expiresAt).toLocaleString()}</time></p>}
      {!status?.verified&&<>
        <button className="communication-primary" type="button" disabled={busy||cooldown} onClick={()=>void requestCode()}>
          {busy?'Contacting SMTP server…':cooldown?'Resend cooldown active':'Send verification email'}
        </button>
        {cooldown&&<p className="communication-hint">Resend available after <time dateTime={status?.resendAfter??''}>{new Date(status?.resendAfter??'').toLocaleString()}</time>.</p>}
        {challengeId&&<form className="communication-otp-form" onSubmit={e=>void verifyCode(e)}>
          <label>Verification code
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8}
              required value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))}/>
          </label>
          <button className="communication-primary" disabled={busy||!/^\d{6,8}$/.test(code)} type="submit">
            {busy?'Verifying code…':'Verify email OTP'}
          </button>
        </form>}
      </>}
      {status?.verified&&<p className="communication-hint">Next: complete independently approved package, sponsor, e-PIN and consent checks. <Link href="/account">Account security</Link>.</p>}
    </section>}
  </main>;
}
