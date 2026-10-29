'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage, formatAge } from '../lib/api';
import './real-operations.css';

type Identity = {roles:string[];organizationId:string|null};
type Screen = {id:string;name:string;platform:string;status:string;playerVersion:string|null;lastHeartbeatAt:string|null};
type Health = {generatedAt:string;heartbeatStaleAfterSeconds:number;screens:{total:number;online:number;offline:number;maintenance:number;unhealthy:number}};
type Registered = {screen:Screen;pairingCode:string;expiresAt:string;instructions:string};
const readRoles=['SUPER_ADMIN','ORGANIZATION_ADMIN','OPERATIONS_MANAGER','SUPPORT_AGENT','AUDITOR_COMPLIANCE'];
const writeRoles=['SUPER_ADMIN','ORGANIZATION_ADMIN','OPERATIONS_MANAGER'];

export function RealFleetOperations() {
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [screens,setScreens]=useState<Screen[]>([]);
  const [health,setHealth]=useState<Health|null>(null);
  const [name,setName]=useState('');
  const [platform,setPlatform]=useState('Android TV');
  const [pairing,setPairing]=useState<Registered|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [reloadKey,setReloadKey]=useState(0);
  const canRead=Boolean(identity?.organizationId && identity.roles.some(role=>readRoles.includes(role)));
  const canWrite=identity?.roles.some(role=>writeRoles.includes(role))??false;

  async function refresh() {
    const [rows,summary]=await Promise.all([
      apiRequest<Screen[]>('/fleet/screens'),
      apiRequest<Health>('/fleet/health-summary'),
    ]);
    setScreens(rows);setHealth(summary);
  }
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError('');setNotice('');setIdentity(null);
    setScreens([]);setHealth(null);setPairing(null);
    void (async()=>{
      try {
        const me=await apiRequest<Identity>('/auth/me');
        if(!alive)return;
        setIdentity(me);
        if(!me.organizationId || !me.roles.some(role=>readRoles.includes(role)))return;
        const [rows,summary]=await Promise.all([
          apiRequest<Screen[]>('/fleet/screens'),
          apiRequest<Health>('/fleet/health-summary'),
        ]);
        if(alive){setScreens(rows);setHealth(summary);}
      }catch(e){if(alive)setError(errorMessage(e));}
      finally{if(alive)setLoading(false);}
    })();
    return()=>{alive=false;};
  },[reloadKey]);

  async function register(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy||!canWrite||!name.trim())return;
    setBusy(true);setError('');setNotice('');setPairing(null);
    try {
      const created=await apiRequest<Registered>('/fleet/screens',{
        method:'POST',body:JSON.stringify({name:name.trim(),platform}),
      });
      setPairing(created);setName('');
      // Preserve one-time pairing code if refresh fails: operator must not
      // re-register a second screen simply because the list read failed.
      try {
        await refresh();
        setNotice('Screen registered in MySQL, pending player pairing. No device command was sent.');
      }catch(e){
        setNotice('Screen registered by API. Preserve the one-time code and check inventory before retrying.');
        setError('Inventory refresh failed: '+errorMessage(e));
      }
    }catch(e){setError(errorMessage(e));}
    finally{setBusy(false);}
  }

  return <section className="real-ops" data-testid="real-fleet-operations" aria-label="Authenticated fleet records">
    <div className="real-ops-header"><div><p className="real-ops-kicker">SECURED API / LIVE TENANT DATA</p>
      <h2>MySQL device inventory</h2><p>Separate from sample screens above. No remote commands are sent from this panel.</p></div>
      <button type="button" disabled={loading||busy} onClick={()=>setReloadKey(k=>k+1)}>Reload records</button>
    </div>
    {loading&&<p role="status">Checking fleet access and stored device state…</p>}
    {error&&<p className="real-ops-error" role="alert">{error}</p>}
    {!loading&&!identity&&<p>Please <Link href="/login">sign in</Link> to access fleet records.</p>}
    {!loading && identity && !identity.organizationId && <p role="status">Organization context required. This account is not linked to an organization; select or provision an approved tenant context before viewing secured records.</p>}
    {!loading&&identity&&identity.organizationId&&!canRead&&<p role="status">Your role cannot view organization fleet records.</p>}
    {!loading&&canRead&&<div className="real-ops-grid">
      <div className="real-ops-panel"><h3>Recorded screens ({screens.length} latest)</h3>
        {health&&<p role="status">Tenant summary: {health.screens.total} screens · {health.screens.online} online · {health.screens.offline} offline · {health.screens.unhealthy} unhealthy</p>}
        {screens.length?<ul>{screens.map(screen=><li key={screen.id}>
          <strong>{screen.name}</strong>
          <small>{screen.id} · {screen.platform} · {screen.status}</small>
          <small>Heartbeat: {formatAge(screen.lastHeartbeatAt)} · Player {screen.playerVersion??'not reported'}</small>
        </li>)}</ul>:<p role="status">No registered screens in this organization.</p>}
      </div>
      <div className="real-ops-panel"><h3>Register new screen</h3>
        {canWrite?<form onSubmit={e=>void register(e)}>
          <label>Screen name<input required minLength={2} maxLength={160} disabled={busy}
            value={name} onChange={e=>setName(e.target.value)}/></label>
          <label>Player platform<select value={platform} disabled={busy} onChange={e=>setPlatform(e.target.value)}>
            {['Android Mobile','Android Tablet','Android TV','Google TV','iOS / iPadOS','Samsung Tizen','LG webOS','Windows Player','Linux Player','Roku TV','Fire TV OS','Titan OS','VIZIO SmartCast','Xumo TV OS','Apple tvOS'].map(value=><option key={value}>{value}</option>)}
          </select></label>
          <button disabled={busy||name.trim().length<2} type="submit">Register screen in MySQL</button>
        </form>:<p>Your role can inspect but cannot register screens.</p>}
        {pairing&&<div className="real-ops-secret" role="status">
          <strong>One-time device pairing code</strong>
          <code>{pairing.pairingCode}</code>
          <small>Expires: <time dateTime={pairing.expiresAt}>{new Date(pairing.expiresAt).toLocaleString()}</time>. Only shown in this browser session; server stores its hash.</small>
          <button type="button" onClick={()=>setPairing(null)}>Dismiss secure code</button>
        </div>}
        <p><strong>Client-required OS targets:</strong> Android/iOS mobile/tablets, Google TV/Android TV, Samsung Tizen, LG webOS, Roku TV, Fire TV OS, Titan OS, VIZIO SmartCast, Xumo TV OS, Apple tvOS, Windows and Linux. Registration only records a platform in MySQL; it does not mean a native player build is available or certified. See the per-platform UAT matrix.</p>
        <p>Actual player must pair within the API expiry window. No physical SmartTV/player verification, playback attestation or production deployment is implied.</p>
      </div>
    </div>}
    {notice&&<p className="real-ops-notice" role="status">{notice}</p>}
  </section>;
}
