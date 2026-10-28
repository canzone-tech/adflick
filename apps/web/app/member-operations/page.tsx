'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import '../communication.css';
import './member-operations.css';

type Identity = {id:string;email:string;roles:string[]};
type Package = {id:string;code:string;name:string;status:'DRAFT'|'ENABLED'|'DISABLED';approvedAt:string|null};
type Consent = {id:string;version:string;status:'DRAFT'|'APPROVED'|'RETIRED';documentSha256:string;approvedAt:string|null};
type IssuedPin = {
  id:string;recipientUserId:string;packageId:string;status:'ISSUED'|'REDEEMED'|'REVOKED';
  expiresAt:string;createdAt:string;redeemedAt:string|null;revokedAt:string|null;
};
type PinList = {items:IssuedPin[];total:number;take:number;skip:number};
type Recipient = {id:string;displayName:string;email:string};
type OneTime = {id:string;pin:string;expiresAt:string;status:string;notice:string};
type PackageDraft = {id:string;status:string};
type ConsentDraft = {id:string;status:string};
type Approval = {id:string;status:string};
type Overview = {
  membership:{total:number;pendingActivation:number;active:number;suspended:number};
  placement:{left:number;right:number};
  pins:{issued:number;redeemed:number;revoked:number};
  approvedConsents:number;enabledPackages:number;
  financialBalancesIncluded:false;note:string;
};

const PIN_PAGE_SIZE=25;
export default function MemberOperationsPage() {
  const [identity,setIdentity] = useState<Identity|null>(null);
  const [overview,setOverview] = useState<Overview|null>(null);
  const [packages,setPackages] = useState<Package[]>([]);
  const [consents,setConsents] = useState<Consent[]>([]);
  const [pins,setPins] = useState<IssuedPin[]>([]);
  const [pinTotal,setPinTotal] = useState(0);
  const [pinSkip,setPinSkip] = useState(0);
  const recipientLookupVersion=useRef(0);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [packageCode,setPackageCode] = useState('');
  const [packageName,setPackageName] = useState('');
  const [consentVersion,setConsentVersion] = useState('');
  const [consentText,setConsentText] = useState('');
  const [approvalReference,setApprovalReference] = useState('');
  const [recipientEmail,setRecipientEmail] = useState('');
  const [recipient,setRecipient] = useState<Recipient|null>(null);
  const [selectedPackage,setSelectedPackage] = useState('');
  const [expiryInput,setExpiryInput] = useState('');
  const [pinSecret,setPinSecret] = useState<OneTime|null>(null);
  const [revocationReason,setRevocationReason] = useState('');

  async function refresh() {
    const [packageRows,consentRows,pinRows,overviewData] = await Promise.all([
      apiRequest<Package[]>('/member-enrollment/packages'),
      apiRequest<Consent[]>('/member-enrollment/consents'),
      apiRequest<PinList>('/member-enrollment/pins?take='+PIN_PAGE_SIZE+'&skip=0'),
      apiRequest<Overview>('/members/overview'),
    ]);
    setPackages(packageRows);setConsents(consentRows);
    setPins(pinRows.items);setPinTotal(pinRows.total);setPinSkip(0);setOverview(overviewData);
  }
  async function loadPinPage(next:number) {
    if(busy||next<0||next>=pinTotal)return;
    setBusy(true);setError('');setMessage('');setPinSecret(null);
    try {
      const page=await apiRequest<PinList>('/member-enrollment/pins?take='+PIN_PAGE_SIZE+'&skip='+next);
      setPins(page.items);setPinTotal(page.total);setPinSkip(page.skip);
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }
  const [reloadKey,setReloadKey]=useState(0);
  useEffect(()=>{
    let alive=true;
    recipientLookupVersion.current++;
    setLoading(true);setError('');setIdentity(null);setOverview(null);
    setPackages([]);setConsents([]);setPins([]);setPinTotal(0);setPinSkip(0);
    setPinSecret(null);setRecipient(null);
    void (async()=>{
      try{
        const me=await apiRequest<Identity>('/auth/me');
        if(!alive)return;
        setIdentity(me);
        if(me.roles.some(role=>['SUPER_ADMIN','ORGANIZATION_ADMIN','AUDITOR_COMPLIANCE'].includes(role))) await refresh();
      }catch(e){if(alive)setError(errorMessage(e));}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false;};
  },[reloadKey]);

  async function action(label:string, run:()=>Promise<unknown>) {
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try {
      await run();
    } catch(e) {
      setError(errorMessage(e));
      setBusy(false);
      return;
    }
    // Mutation succeeded before refresh. A later read failure must never be
    // presented as "PIN issuance failed" and encourage duplicate issuance.
    try {
      await refresh();
      setMessage(label+' — committed and reloaded from the secured API.');
    } catch(e) {
      setMessage(label+' — accepted by the secured API.');
      setError('Records could not be reloaded. Check inventory before repeating this action. '+errorMessage(e));
    } finally{setBusy(false);}
  }

  const staff=identity?.roles.some(role=>['SUPER_ADMIN','ORGANIZATION_ADMIN','AUDITOR_COMPLIANCE'].includes(role))??false;
  const editor=identity?.roles.some(role=>['SUPER_ADMIN','ORGANIZATION_ADMIN'].includes(role))??false;
  const superAdmin=identity?.roles.includes('SUPER_ADMIN')??false;

  function createPackage(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action('Draft package',async()=>{
      await apiRequest<PackageDraft>('/member-enrollment/packages',{
        method:'POST',body:JSON.stringify({code:packageCode.trim(),name:packageName.trim()}),
      });
      setPackageCode('');setPackageName('');
    });
  }
  function createConsent(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action('Consent draft',async()=>{
      await apiRequest<ConsentDraft>('/member-enrollment/consents',{
        method:'POST',body:JSON.stringify({version:consentVersion.trim(),documentText:consentText.trim()}),
      });
      setConsentVersion('');setConsentText('');
    });
  }
  function approve(type:'packages'|'consents',id:string) {
    void action(type==='packages'?'Package approval':'Consent approval',async()=>{
      await apiRequest<Approval>('/member-enrollment/'+type+'/'+encodeURIComponent(id)+'/approve',{
        method:'POST',body:JSON.stringify({approvalReference:approvalReference.trim()}),
      });
    });
  }
  async function findRecipient() {
    if(busy||!recipientEmail.trim())return;
    const version=++recipientLookupVersion.current;
    const target=recipientEmail.trim();
    setBusy(true);setError('');setMessage('');setRecipient(null);setPinSecret(null);
    try {
      const record=await apiRequest<Recipient>('/member-enrollment/recipient?email='+encodeURIComponent(target));
      if(recipientLookupVersion.current!==version)return;
      setRecipient(record);setMessage('Eligible, active MEMBER account found in this organization.');
    } catch(e) {
      if(recipientLookupVersion.current===version)setError(errorMessage(e));
    } finally {setBusy(false);}
  }
  function issuePin(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy||!recipient)return;
    const timestamp=Date.parse(expiryInput);
    const now=Date.now();
    if(!Number.isFinite(timestamp)||timestamp<=now||timestamp>now+366*24*60*60*1000){
      setError('PIN expiry must be a valid future date/time within one year.');
      setMessage('');
      return;
    }
    if(!packages.some(item=>item.code===selectedPackage&&item.status==='ENABLED')){
      setError('Select an independently approved package before issuing a PIN.');
      setMessage('');
      return;
    }
    void action('One-time e-PIN issued',async()=>{
      setPinSecret(null);
      const response=await apiRequest<OneTime>('/member-enrollment/pins',{
        method:'POST',body:JSON.stringify({
          recipientUserId:recipient.id,packageCode:selectedPackage,
          expiresAt:new Date(timestamp).toISOString(),
        }),
      });
      setPinSecret(response);setRecipient(null);setRecipientEmail('');setExpiryInput('');
    });
  }
  function revokePin(id:string) {
    void action('PIN revocation',async()=>{
      await apiRequest<Approval>('/member-enrollment/pins/'+encodeURIComponent(id)+'/revoke',{
        method:'POST',body:JSON.stringify({reason:revocationReason.trim()}),
      });
      setRevocationReason('');
    });
  }

  return <main className="member-admin">
    <p className="eyebrow">ADMIN / MEMBERSHIP OPERATIONS</p>
    <h1>Member enrollment operations</h1>
    <p className="communication-intro">Manage real organization packages, versioned consent and one-time recipient-bound e-PINs. Operator feature gates, MFA and maker–checker approvals remain mandatory.</p>
    {loading&&<p role="status">Loading authorized membership records…</p>}
    {error&&<div className="communication-error" role="alert">
      <p>{error} <Link href="/account">Account and MFA</Link></p>
      {!loading&&<button type="button" disabled={busy} onClick={()=>setReloadKey(key=>key+1)}>Retry authorized records</button>}
    </div>}
    {message&&<p className="communication-success" role="status">{message}</p>}
    {!loading&&!identity&&<p role="status">Please <Link href="/login">sign in</Link> to view authorized membership records.</p>}
    {!loading&&identity&&!staff&&<p role="alert">Membership administration is restricted to authorized staff roles.</p>}
    {!loading&&staff&&<>
      <section className="member-admin-card" aria-labelledby="member-admin-overview-title">
        <p className="communication-kicker">ORGANIZATION / NON-FINANCIAL OVERVIEW</p>
        <h2 id="member-admin-overview-title">Membership operations snapshot</h2>
        <p>Counts come from real tenant-scoped MySQL records. These are not commission, paid activation or revenue figures.</p>
        {overview?<div className="member-admin-overview">
          {([
            ['Members recorded',overview.membership.total],
            ['Pending activation',overview.membership.pendingActivation],
            ['Active profiles',overview.membership.active],
            ['Suspended profiles',overview.membership.suspended],
            ['LEFT placements',overview.placement.left],
            ['RIGHT placements',overview.placement.right],
            ['Issued e-PINs',overview.pins.issued],
            ['Redeemed e-PINs',overview.pins.redeemed],
            ['Revoked e-PINs',overview.pins.revoked],
            ['Approved consent versions',overview.approvedConsents],
            ['Enabled non-financial packages',overview.enabledPackages],
          ] as const).map(([label,value])=><div key={label}>
            <small>{label}</small><strong>{value}</strong>
          </div>)}
        </div>:<p role="status">Operations summary could not be loaded.</p>}
        {overview&&<p className="member-admin-hint">{overview.note}</p>}
      </section>
      <section className="member-admin-columns">
        <div className="member-admin-card">
          <h2>Enrollment packages</h2>
          <p>Non-financial package configuration. No price or compensation is inferred.</p>
          {editor&&<form onSubmit={createPackage}>
            <label>Package code<input required maxLength={60} pattern="[A-Za-z0-9_-]+" value={packageCode} disabled={busy}
              onChange={e=>setPackageCode(e.target.value)}/></label>
            <label>Package name<input required maxLength={160} value={packageName} disabled={busy}
              onChange={e=>setPackageName(e.target.value)}/></label>
            <button disabled={busy}>Create draft package</button>
          </form>}
          <h3>Organization package records</h3>
          {!packages.length&&<p role="status">No packages are configured.</p>}
          <ul className="member-admin-records">
            {packages.map(item=><li key={item.id}>
              <div><strong>{item.code} — {item.name}</strong><span>{item.status}</span></div>
              {superAdmin&&item.status==='DRAFT'&&<button disabled={busy||approvalReference.trim().length<8}
                onClick={()=>approve('packages',item.id)}>Approve draft</button>}
            </li>)}
          </ul>
        </div>
        <div className="member-admin-card">
          <h2>Registration consent</h2>
          <p>Actual document text and hash are stored per version; independent legal sign-off must be recorded before using a version.</p>
          {editor&&<form onSubmit={createConsent}>
            <label>Version<input required maxLength={60} pattern="[A-Za-z0-9._-]+" value={consentVersion}
              disabled={busy} onChange={e=>setConsentVersion(e.target.value)}/></label>
            <label>Document text<textarea required minLength={20} maxLength={30000} rows={5} value={consentText}
              disabled={busy} onChange={e=>setConsentText(e.target.value)}/></label>
            <button disabled={busy}>Create consent draft</button>
          </form>}
          <h3>Version history</h3>
          {!consents.length&&<p role="status">No consent versions are configured.</p>}
          <ul className="member-admin-records">
            {consents.map(item=><li key={item.id}>
              <div><strong>{item.version}</strong><span>{item.status}</span>
                <small title={item.documentSha256}>SHA256: {item.documentSha256.slice(0,14)}…</small></div>
              {superAdmin&&item.status==='DRAFT'&&<button disabled={busy||approvalReference.trim().length<8}
                onClick={()=>approve('consents',item.id)}>Approve version</button>}
            </li>)}
          </ul>
        </div>
      </section>
      {superAdmin&&<section className="member-admin-card member-admin-approval">
        <h2>Independent reviewer evidence</h2>
        <label>Signed approval/reference identifier<input value={approvalReference}
          onChange={e=>setApprovalReference(e.target.value)} minLength={8} maxLength={240}
          placeholder="Reference from approved review" disabled={busy}/></label>
        <p>Maker cannot approve their own draft. Server checks actor identity and current MFA; a typed reference is not itself business/legal approval.</p>
      </section>}
      <section className="member-admin-card">
        <h2>Recipient-bound one-time e-PIN</h2>
        <p>Find an existing verified-login MEMBER account in this organization. PIN issuance requires an approved package and operator permission. No tokens are stored in plaintext.</p>
        {editor&&<form className="member-admin-pin-form" onSubmit={issuePin}>
          <label>Recipient account email
            <input type="email" required value={recipientEmail} onChange={e=>{recipientLookupVersion.current++;setRecipientEmail(e.target.value);setRecipient(null);setMessage('');setPinSecret(null);}}/></label>
          <button type="button" disabled={busy||!recipientEmail.trim()} onClick={()=>void findRecipient()}>Find eligible recipient</button>
          {recipient&&<p role="status" className="member-admin-recipient">
            Confirmed: {recipient.displayName} ({recipient.email}) · {recipient.id}
          </p>}
          <label>Approved package
            <select required value={selectedPackage} onChange={e=>setSelectedPackage(e.target.value)} disabled={busy}>
              <option value="">Select approved package</option>
              {packages.filter(item=>item.status==='ENABLED').map(item=>
                <option key={item.id} value={item.code}>{item.code} — {item.name}</option>)}
            </select></label>
          <label>PIN expiry date/time
            <input type="datetime-local" required value={expiryInput} onChange={e=>{setExpiryInput(e.target.value);setError('');}} disabled={busy}/>
            <small>Future expiry within one year; validated again by the server.</small></label>
          <button type="submit" disabled={busy||!recipient||!selectedPackage||!expiryInput}>Issue one-time PIN</button>
        </form>}
        {pinSecret&&<div className="member-admin-secret" role="status">
          <strong>One-time PIN (visible only now)</strong>
          <code>{pinSecret.pin}</code>
          <p>Safely deliver this secret to the intended recipient. It cannot be recovered from the database. Do not include it in support logs.</p>
          <button type="button" onClick={()=>setPinSecret(null)}>Dismiss and hide secret</button>
        </div>}
        <h3>PIN issuance records ({pinTotal})</h3>
        {!pins.length&&<p role="status">No e-PIN inventory records exist.</p>}
        <ul className="member-admin-records">
          {pins.map(item=><li key={item.id}>
            <div><strong>PIN {item.id}</strong><span>{item.status}</span>
              <small>Recipient ID: {item.recipientUserId}</small>
              <small>Expires: {new Date(item.expiresAt).toLocaleString()}</small></div>
            {editor&&item.status==='ISSUED'&&<button type="button"
              disabled={busy||revocationReason.trim().length<8} onClick={()=>revokePin(item.id)}>Revoke PIN</button>}
          </li>)}
        </ul>
        {editor&&<label className="member-admin-revoke">Revocation reason (required)
          <input minLength={8} maxLength={240} value={revocationReason} onChange={e=>setRevocationReason(e.target.value)}
            disabled={busy}/></label>}
        {pinTotal>0&&<nav className="member-admin-pin-pagination" aria-label="e-PIN inventory pages">
          <button type="button" disabled={busy||pinSkip===0}
            onClick={()=>void loadPinPage(Math.max(0,pinSkip-PIN_PAGE_SIZE))}>Previous PINs</button>
          <span aria-live="polite">Showing {pinSkip+1}–{pinSkip+pins.length} of {pinTotal} PIN records</span>
          <button type="button" disabled={busy||pinSkip+pins.length>=pinTotal}
            onClick={()=>void loadPinPage(pinSkip+PIN_PAGE_SIZE)}>Next PINs</button>
        </nav>}
      </section>
      <p className="member-admin-hint">Financial compensation, paid joining, PIN transfer, live SMS provider certification and production activation remain blocked. <Link href="/communications">OTP configuration</Link> · <Link href="/account">MFA security</Link>.</p>
    </>}
  </main>;
}
