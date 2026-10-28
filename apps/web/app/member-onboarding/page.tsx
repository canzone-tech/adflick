'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import '../communication.css';
import './member-onboarding.css';

type Identity = { id:string; displayName:string; email:string; roles:string[] };
type Member = { memberCode:string; status:'PENDING_ACTIVATION'|'ACTIVE'|'SUSPENDED'; activatedAt:string|null };
type Consent = {version:string;documentSha256:string;documentText:string};
type Progress = {
  membership:Member|null;emailOtpVerified:boolean;emailOtpExpiresAt:string|null;
  hasIssuedPin:boolean;pinExpiresAt:string|null;pinPackage:{code:string;name:string}|null;
  consent:Consent|null;enrollmentEnabled:boolean;phoneOtpVerified:boolean;
  phoneOtpExpiresAt:string|null;mobileOtpProviderEnabled:boolean;reminder:string;
};
type Candidate = {memberCode:string;eligible:true;leftAvailable:boolean;rightAvailable:boolean;provisional:true;note:string};
type Preflight = {provisional:true;pinAssigned:true;emailOtpVerified:true;consentApproved:true;placementAvailable:true;message:string};
type Tree = {rootMemberCode:string;maxDepth:number;nodes:{memberCode:string;status:string;side:'LEFT'|'RIGHT'|null;parentMemberCode:string|null;depth:number}[]};
type Enrollment = {memberCode:string;status:string;placementSide:string;message:string};

export default function MemberOnboardingPage() {
  const [identity,setIdentity] = useState<Identity|null>(null);
  const [progress,setProgress] = useState<Progress|null>(null);
  const [tree,setTree] = useState<Tree|null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [sponsorCode,setSponsorCode] = useState('');
  const [parentCode,setParentCode] = useState('');
  const [sponsor,setSponsor] = useState<Candidate|null>(null);
  const [parent,setParent] = useState<Candidate|null>(null);
  const [side,setSide] = useState<'LEFT'|'RIGHT'>('LEFT');
  const [pin,setPin] = useState('');
  const [consentAccepted,setConsentAccepted] = useState(false);
  const [preflight,setPreflight] = useState<Preflight|null>(null);

  async function reload() {
    const loaded=await apiRequest<Progress>('/member-enrollment/progress');
    setProgress(loaded);
    if(loaded.membership) {
      try {
        setTree(await apiRequest<Tree>('/members/me/tree?depth=4'));
      } catch { setTree(null); }
    } else setTree(null);
  }
  const [reloadKey,setReloadKey]=useState(0);
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError('');setProgress(null);setTree(null);setIdentity(null);
    setSponsor(null);setParent(null);setPreflight(null);
    void (async()=>{
      try {
        const user=await apiRequest<Identity>('/auth/me');
        if(!alive)return;
        setIdentity(user);
        // Never load enrollment state for an unrelated role.
        if(!user.roles.includes('MEMBER'))return;
        const loaded=await apiRequest<Progress>('/member-enrollment/progress');
        if(!alive)return;
        setProgress(loaded);
        if(loaded.membership) {
          try {
            const subtree=await apiRequest<Tree>('/members/me/tree?depth=4');
            if(alive)setTree(subtree);
          }catch{if(alive)setTree(null);}
        }
      }catch(e){if(alive)setError(errorMessage(e));}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false;};
  },[reloadKey]);

  function invalidate(){setPreflight(null);setMessage('');}
  async function lookup(which:'sponsor'|'parent') {
    const code=(which==='sponsor'?sponsorCode:parentCode).trim();
    setBusy(true);setError('');invalidate();
    try {
      const candidate=await apiRequest<Candidate>('/member-enrollment/eligible/'+encodeURIComponent(code));
      if(which==='sponsor')setSponsor(candidate);else setParent(candidate);
    }catch(e) {
      if(which==='sponsor')setSponsor(null);else setParent(null);
      setError(errorMessage(e));
    }finally{setBusy(false);}
  }
  function body() {
    if(!progress?.consent)throw new Error('Approved registration consent unavailable.');
    return {
      sponsorMemberCode:sponsorCode.trim(),placementParentMemberCode:parentCode.trim(),
      side,pin,consentVersion:progress.consent.version,
      consentDocumentSha256:progress.consent.documentSha256,consentAccepted,
    };
  }
  async function check(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setMessage('');setPreflight(null);
    try {
      const result=await apiRequest<Preflight>('/member-enrollment/preflight',{
        method:'POST',body:JSON.stringify(body()),
      });
      setPreflight(result);
      setMessage(result.message);
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }
  async function enroll() {
    if(!preflight?.provisional)return;
    setBusy(true);setError('');setMessage('');
    try {
      const recorded=await apiRequest<Enrollment>('/member-enrollment/enroll',{
        method:'POST',body:JSON.stringify(body()),
      });
      setPin('');setPreflight(null);setConsentAccepted(false);
      setMessage(recorded.message+' Member code: '+recorded.memberCode);
      await reload();
    }catch(e) {
      // The preflight was never a reservation and may have become stale.
      setPreflight(null);setError(errorMessage(e));
    }finally{setBusy(false);}
  }
  const permitted=identity?.roles.includes('MEMBER')??false;
  const hasSlot=(side==='LEFT'?parent?.leftAvailable:parent?.rightAvailable)??false;

  return <main className="member-onboard">
    <p className="eyebrow">MEMBERSHIP / SECURE ENROLLMENT</p>
    <h1>Member enrollment</h1>
    <p className="communication-intro">Real account, approved consent, verified email OTP and recipient-bound e-PIN are checked by the server. Final LEFT/RIGHT placement uses a MySQL transaction, not browser state.</p>
    {loading&&<p role="status">Loading authenticated membership and verification state…</p>}
    {error&&<div role="alert" className="communication-error">
      <p>{error}</p>
      {!loading&&<button type="button" disabled={busy} onClick={()=>setReloadKey(key=>key+1)}>Retry membership checks</button>}
    </div>}
    {message&&<p role="status" className="communication-success">{message}</p>}
    {!loading&&!identity&&<p role="status">Please <Link href="/login">sign in</Link> to continue.</p>}
    {!loading&&identity&&!permitted&&<p role="alert">This workflow is restricted to MEMBER accounts.</p>}
    {!loading&&permitted&&progress&&<>
      <section className="member-onboard-summary" aria-label="Membership checks">
        <div><small>Email OTP</small><strong>{progress.emailOtpVerified?'Verified':'Verification needed'}</strong>
          {!progress.emailOtpVerified&&<Link href="/email-verification">Verify email</Link>}</div>
        <div><small>Phone OTP</small><strong>{progress.phoneOtpVerified?'Verified':'Verification needed'}</strong>
          {!progress.phoneOtpVerified&&<Link href="/phone-verification">Verify mobile</Link>}</div>
        <div><small>Assigned e-PIN</small><strong>{progress.hasIssuedPin?'Available':'Not assigned'}</strong>
          {progress.pinPackage&&<span>{progress.pinPackage.name}</span>}</div>
        <div><small>Approved consent</small><strong>{progress.consent?progress.consent.version:'Not available'}</strong></div>
        <div><small>Enrollment gate</small><strong>{progress.enrollmentEnabled?'Enabled by operator':'Disabled'}</strong></div>
      </section>
      {progress.membership?<section className="member-onboard-card">
        <h2>Recorded membership</h2>
        <p><Link href="/member-dashboard">View direct referrals and LEFT/RIGHT member dashboard</Link></p>
        <dl className="member-onboard-facts">
          <div><dt>Member code</dt><dd>{progress.membership.memberCode}</dd></div>
          <div><dt>Status</dt><dd>{progress.membership.status.replaceAll('_',' ')}</dd></div>
          <div><dt>Financial eligibility</dt><dd>Not established by this enrollment</dd></div>
        </dl>
        <p>Pending activation is not active membership. Phone verification, policy acceptance and any commercial/provider approvals remain separate.</p>
        <h3>Recorded binary descendants</h3>
        {tree?<ol className="member-onboard-tree">
          {tree.nodes.map((node,index)=><li key={node.memberCode+'-'+index}
            style={{paddingInlineStart:Math.min(node.depth,4)*13}}>
            <strong>{node.memberCode}</strong>
            <span>{node.depth===0?'Your profile':node.side+' under '+node.parentMemberCode}</span>
            <small>{node.status}</small>
          </li>)}
        </ol>:<p role="status">Genealogy is temporarily unavailable; no replacement data will be shown.</p>}
        <p className="member-onboard-note">Tree display is bounded to four levels, and uses your actual authenticated descendants only.</p>
      </section>:<section className="member-onboard-card">
        <h2>Complete pending enrollment</h2>
        <p className="member-onboard-note">Your membership will remain PENDING_ACTIVATION even after successful enrollment. A sponsor can be different from the binary placement parent; do not assume automatic spillover.</p>
        <form onSubmit={e=>void check(e)}>
          <div className="member-onboard-columns">
            <div className="member-onboard-field">
              <label htmlFor="member-sponsor">Verified sponsor member code</label>
              <div className="member-onboard-lookup">
                <input id="member-sponsor" required maxLength={40} pattern="[A-Za-z0-9_-]{1,40}"
                  value={sponsorCode} onChange={e=>{setSponsorCode(e.target.value);setSponsor(null);invalidate();}}
                  autoComplete="off"/>
                <button type="button" disabled={busy||!sponsorCode.trim()} onClick={()=>void lookup('sponsor')}>Verify sponsor</button>
              </div>
              {sponsor&&<p role="status" className="member-onboard-ok">Active same-organization sponsor: {sponsor.memberCode}</p>}
            </div>
            <div className="member-onboard-field">
              <label htmlFor="member-parent">Binary placement parent code</label>
              <div className="member-onboard-lookup">
                <input id="member-parent" required maxLength={40} pattern="[A-Za-z0-9_-]{1,40}"
                  value={parentCode} onChange={e=>{setParentCode(e.target.value);setParent(null);invalidate();}}
                  autoComplete="off"/>
                <button type="button" disabled={busy||!parentCode.trim()} onClick={()=>void lookup('parent')}>Check LEFT/RIGHT</button>
              </div>
              {parent&&<p role="status" className="member-onboard-ok">
                {parent.memberCode}: LEFT {parent.leftAvailable?'available':'occupied'} · RIGHT {parent.rightAvailable?'available':'occupied'}
              </p>}
            </div>
          </div>
          <fieldset className="member-onboard-sides">
            <legend>Requested binary side</legend>
            {(['LEFT','RIGHT'] as const).map(value=><label key={value}>
              <input type="radio" name="binary-side" value={value}
                checked={side===value} disabled={busy||!!parent&&!(value==='LEFT'?parent.leftAvailable:parent.rightAvailable)}
                onChange={()=>{setSide(value);invalidate();}}/>
              <span>{value}</span>
            </label>)}
          </fieldset>
          <p className="member-onboard-note">An available side is only a snapshot; another transaction can occupy it before final submission. Only the server&apos;s atomic enrollment commits placement.</p>
          <div className="member-onboard-field">
            <label htmlFor="member-pin">One-time e-PIN assigned to this account</label>
            <input id="member-pin" type="password" autoComplete="off" required minLength={40} maxLength={60}
              pattern="[A-Za-z0-9_-]{40,60}" value={pin}
              onChange={e=>{setPin(e.target.value);invalidate();}}/>
            <p className="member-onboard-note">e-PIN is never shown in member API responses. Contact an authorized administrator if no PIN is assigned.</p>
          </div>
          {progress.consent?<section className="member-onboard-consent" aria-labelledby="member-consent-title">
            <h3 id="member-consent-title">Approved consent — {progress.consent.version}</h3>
            <div className="member-onboard-legal" tabIndex={0}>{progress.consent.documentText}</div>
            <label className="member-onboard-accept">
              <input type="checkbox" required checked={consentAccepted} onChange={e=>{setConsentAccepted(e.target.checked);invalidate();}}/>
              <span>I have read and accept this exact approved version.</span>
            </label>
          </section>:<p role="alert">Enrollment is unavailable until independently approved consent is published.</p>}
          {!progress.emailOtpVerified&&<p role="status">First <Link href="/email-verification">verify email OTP</Link>. This is separate from login email proof.</p>}
          {!progress.phoneOtpVerified&&<p role="status">A verified <Link href="/phone-verification">mobile OTP</Link> is also mandatory. Without approved SMS gateway, enrollment cannot proceed.</p>}
          {!progress.enrollmentEnabled&&<p role="status">Enrollment is currently disabled by operator policy. This form cannot bypass that gate.</p>}
          <div className="member-onboard-actions">
            <button className="member-onboard-primary" type="submit"
              disabled={busy||!sponsor||!parent||!hasSlot||!consentAccepted||!progress.emailOtpVerified||!progress.phoneOtpVerified||!progress.enrollmentEnabled||!progress.consent||!progress.hasIssuedPin}>
              {busy?'Checking current server state…':'Verify PIN, OTP & placement'}
            </button>
            {preflight?.provisional&&<button className="member-onboard-final" type="button" disabled={busy} onClick={()=>void enroll()}>
              {busy?'Recording enrollment…':'Submit atomic pending enrollment'}
            </button>}
          </div>
          {preflight?.provisional&&<p className="member-onboard-note" role="status">Preflight confirmed. No PIN or placement has been reserved; submitting may still return a conflict.</p>}
        </form>
      </section>}
      <p className="member-onboard-note">{progress.reminder} Mobile verification is backed by a provider-neutral SMS gateway adapter; live provider sign-off, KYC, full SRS acceptance and monetary operations remain blocked.</p>
    </>}
  </main>;
}
