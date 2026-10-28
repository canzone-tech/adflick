'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import '../communication.css';
import './member-dashboard.css';

type Identity = { displayName:string; email:string; roles:string[] };
type Member = {
  memberCode:string; status:'PENDING_ACTIVATION'|'ACTIVE'|'SUSPENDED';
  displayName:string; sponsorMemberCode:string|null; placementParentMemberCode:string|null;
  placementSide:'LEFT'|'RIGHT'|null; isTreeRoot:boolean;activatedAt:string|null;createdAt:string;
};
type Slot = {memberCode:string;status:Member['status']}|null;
type Dashboard = {hasProfile:boolean;member:Member|null;directReferrals:number;
  directPlacement:{LEFT:Slot;RIGHT:Slot};financialEligibilityEstablished:false};
type Referral = {memberCode:string;status:Member['status'];sponsoredAt:string};
type ReferralPage = {hasProfile:boolean;items:Referral[];total:number;take:number;skip:number};
type Branch = {directMemberCode:string|null;visibleDescendants:number;
  active:number;pendingActivation:number;suspended:number};
type Team = {hasProfile:boolean;memberCode?:string;maxDepth:number;
  totalVisibleDescendants:number;left:Branch;right:Branch;bounded:true;note?:string};

const PAGE_SIZE=10;
export default function MemberDashboardPage() {
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [referrals,setReferrals]=useState<ReferralPage|null>(null);
  const [team,setTeam]=useState<Team|null>(null);
  const [depth,setDepth]=useState(3);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [reloadKey,setReloadKey]=useState(0);
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError('');setDashboard(null);setReferrals(null);setTeam(null);
    void (async()=>{
      try {
        // Check identity before requesting MEMBER-only data. Staff never calls
        // the member report endpoints merely by navigating to this page.
        const who=await apiRequest<Identity>('/auth/me');
        if(!alive)return;
        setIdentity(who);
        if(!who.roles.includes('MEMBER'))return;
        const summary=await apiRequest<Dashboard>('/members/me/dashboard');
        if(!alive)return;
        setDashboard(summary);
        if(!summary.hasProfile)return;
        const [refs,teamData]=await Promise.all([
          apiRequest<ReferralPage>('/members/me/referrals?take='+PAGE_SIZE+'&skip=0'),
          apiRequest<Team>('/members/me/team-summary?depth='+depth),
        ]);
        if(alive){setReferrals(refs);setTeam(teamData);}
      }catch(e){if(alive)setError(errorMessage(e));}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false;};
  // The refresh button always restarts a bounded, server-authenticated read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[reloadKey]);
  async function changePage(next:number) {
    setBusy(true);setError('');
    try {
      const rows=await apiRequest<ReferralPage>('/members/me/referrals?take='+PAGE_SIZE+'&skip='+next);
      setReferrals(rows);
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }
  async function changeDepth(next:number) {
    setDepth(next);setBusy(true);setError('');
    try {
      const result=await apiRequest<Team>('/members/me/team-summary?depth='+next);
      setTeam(result);
    }catch(e){setError(errorMessage(e));setTeam(null);}
    finally{setBusy(false);}
  }
  const eligible=identity?.roles.includes('MEMBER')??false;
  return <main className="member-dashboard">
    <p className="eyebrow">MEMBER PORTAL / OVERVIEW</p>
    <h1>My member dashboard</h1>
    <p className="communication-intro">Authenticated, organization-scoped membership records. Direct sponsorship and binary placement are separate relationships. No earnings, pairing or payout entitlement is inferred.</p>
    {loading&&<p role="status">Loading your real MySQL membership records…</p>}
    {error&&<div className="communication-error" role="alert">
      <p>{error}</p>
      {!loading&&<button type="button" disabled={busy} onClick={()=>setReloadKey(key=>key+1)}>Retry loading membership</button>}
    </div>}
    {!loading&&!identity&&<p role="status">Please <Link href="/login">sign in</Link>.</p>}
    {!loading&&identity&&!eligible&&<p role="alert">This dashboard requires a MEMBER role.</p>}
    {!loading&&eligible&&dashboard&&!dashboard.hasProfile&&<section className="member-dashboard-panel">
      <h2>Membership not recorded yet</h2>
      <p>Your account may have verified email, but no active/pending membership profile is recorded.
        This is not an invitation to transact financially.</p>
      <Link href="/member-onboarding" className="member-dashboard-link">Review approved onboarding checks</Link>
    </section>}
    {!loading&&eligible&&dashboard?.member&&<>
      <section className="member-dashboard-panel">
        <div className="member-dashboard-heading">
          <div><p className="member-dashboard-kicker">YOUR RECORDED PROFILE</p>
            <h2>{dashboard.member.displayName}</h2>
            <p>Member code <strong>{dashboard.member.memberCode}</strong></p></div>
          <strong className="member-dashboard-state">{dashboard.member.status.replaceAll('_',' ')}</strong>
        </div>
        <dl className="member-dashboard-facts">
          <div><dt>Sponsor</dt><dd>{dashboard.member.sponsorMemberCode??'Tree root / none'}</dd></div>
          <div><dt>Placement parent</dt><dd>{dashboard.member.placementParentMemberCode??'Tree root / none'}</dd></div>
          <div><dt>Placement side</dt><dd>{dashboard.member.placementSide??'Root'}</dd></div>
          <div><dt>Recorded since</dt><dd><time dateTime={dashboard.member.createdAt}>{new Date(dashboard.member.createdAt).toLocaleDateString()}</time></dd></div>
        </dl>
      </section>
      <section className="member-dashboard-metrics" aria-label="Recorded direct relationships">
        <div><small>Direct sponsored referrals</small><strong>{dashboard.directReferrals}</strong><span>Actual sponsor records</span></div>
        <div><small>Direct LEFT slot</small><strong>{dashboard.directPlacement.LEFT?.memberCode??'Vacant'}</strong>
          <span>{dashboard.directPlacement.LEFT?.status.replaceAll('_',' ')??'No recorded child'}</span></div>
        <div><small>Direct RIGHT slot</small><strong>{dashboard.directPlacement.RIGHT?.memberCode??'Vacant'}</strong>
          <span>{dashboard.directPlacement.RIGHT?.status.replaceAll('_',' ')??'No recorded child'}</span></div>
      </section>
      <section className="member-dashboard-columns">
        <div className="member-dashboard-panel">
          <div className="member-dashboard-heading"><div><p className="member-dashboard-kicker">SPONSORSHIP</p><h2>My direct referrals</h2></div>
            <span className="member-dashboard-total">{referrals?.total??0} recorded</span></div>
          <p>Members directly linked to your sponsorship code, not automatically placed below you.</p>
          {!referrals&&<p role="status">Referral records unavailable.</p>}
          {referrals?.items.length===0&&<p role="status">No direct referrals are recorded yet.</p>}
          {referrals?.items.length?<ul className="member-dashboard-referrals">
            {referrals.items.map(ref=><li key={ref.memberCode}>
              <div><strong>{ref.memberCode}</strong><small>Sponsored <time dateTime={ref.sponsoredAt}>{new Date(ref.sponsoredAt).toLocaleDateString()}</time></small></div>
              <span>{ref.status.replaceAll('_',' ')}</span>
            </li>)}
          </ul>:null}
          {referrals&&<div className="member-dashboard-pagination">
            <button type="button" disabled={busy||referrals.skip===0}
              onClick={()=>void changePage(Math.max(0,referrals.skip-PAGE_SIZE))}>Previous</button>
            <span>{referrals.total===0?'0 of 0':(referrals.skip+1)+'–'+(referrals.skip+referrals.items.length)+' of '+referrals.total}</span>
            <button type="button" disabled={busy||referrals.skip+referrals.items.length>=referrals.total}
              onClick={()=>void changePage(referrals.skip+PAGE_SIZE)}>Next</button>
          </div>}
        </div>
        <div className="member-dashboard-panel">
          <div className="member-dashboard-heading"><div><p className="member-dashboard-kicker">BINARY PLACEMENT</p><h2>Visible LEFT / RIGHT team</h2></div>
            <label className="member-dashboard-depth">Levels
              <select value={depth} disabled={busy} onChange={e=>void changeDepth(Number(e.target.value))}>
                {[1,2,3,4].map(level=><option key={level} value={level}>{level}</option>)}
              </select></label>
          </div>
          <p>Only recorded descendants within the selected {depth} levels are counted. These are not full-network totals or pairable volume.</p>
          {team?<div className="member-dashboard-branches">
            {([{label:'LEFT',data:team.left},{label:'RIGHT',data:team.right}] as const).map(side=>
              <div key={side.label}>
                <h3>{side.label} branch</h3>
                <p><strong>{side.data.visibleDescendants}</strong> visible descendants</p>
                <dl>
                  <div><dt>Direct child</dt><dd>{side.data.directMemberCode??'Vacant'}</dd></div>
                  <div><dt>Active</dt><dd>{side.data.active}</dd></div>
                  <div><dt>Pending</dt><dd>{side.data.pendingActivation}</dd></div>
                  <div><dt>Suspended</dt><dd>{side.data.suspended}</dd></div>
                </dl>
              </div>)}
          </div>:<p role="status">Team summary unavailable.</p>}
          <p className="member-dashboard-note">Total visible descendants: {team?.totalVisibleDescendants??'—'} · Depth-bounded read-only snapshot.</p>
          <Link href="/member-onboarding">View recorded tree and enrollment status</Link>
        </div>
      </section>
      <p className="member-dashboard-note">Membership status, referrals and placements are informational only. Phone/email proof is not KYC. No commission, ledger, wallet or payout is created by viewing this page.</p>
    </>}
  </main>;
}
