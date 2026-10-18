'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import './incidents.css';
import { apiRequest, errorMessage, formatAge, getStoredTokens } from '../../lib/api';

type Incident = {
 id:string; title:string; description?:string|null; category:string; severity:'CRITICAL'|'HIGH'|'MEDIUM'|'LOW';
 status:'OPEN'|'ACKNOWLEDGED'|'IN_PROGRESS'|'RESOLVED'|'DISMISSED'; createdAt:string; assignedToId?:string|null;
 screen?:{id:string;name:string;status:string;platform:string}|null;
};
type Summary={open:number;acknowledged:number;inProgress:number;critical:number;resolvedToday:number};
const emptySummary:Summary={open:0,acknowledged:0,inProgress:0,critical:0,resolvedToday:0};
const human=(s:string)=>s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export default function IncidentsPage(){
 const [rows,setRows]=useState<Incident[]>([]);const [summary,setSummary]=useState(emptySummary);
 const [filter,setFilter]=useState('ALL');const [selected,setSelected]=useState('');
 const [notice,setNotice]=useState('Connect with an authorized organization account to load live incidents.');
 const [loading,setLoading]=useState(false);const [live,setLive]=useState(false);const [busy,setBusy]=useState(false);
 const load=useCallback(async()=>{
  if(!getStoredTokens().accessToken){setLive(false);setNotice('No access token found. Sign in to the API and store tokens as adflick_access_token and adflick_refresh_token to load live incidents.');return;}
  setLoading(true);
  try{
   const [list,counts]=await Promise.all([
    apiRequest<Incident[]>(`/incidents${filter!=='ALL'&&!['CRITICAL','HIGH','MEDIUM','LOW'].includes(filter)?`?status=${encodeURIComponent(filter)}`:''}`),
    apiRequest<Summary>('/incidents/summary')
   ]);
   const filtered=['CRITICAL','HIGH','MEDIUM','LOW'].includes(filter)?list.filter(x=>x.severity===filter):list;
   setRows(filtered);setSummary(counts);setSelected(current=>filtered.some(x=>x.id===current)?current:(filtered[0]?.id||''));setLive(true);setNotice(`Live API connected · ${list.length} incident records loaded.`);
  }catch(e){setLive(false);setNotice(errorMessage(e));}
  finally{setLoading(false);}
 },[filter]);
 useEffect(()=>{void load();},[load]);
 const active=useMemo(()=>rows.find(r=>r.id===selected)||rows[0],[rows,selected]);
 async function scan(){setBusy(true);try{const result=await apiRequest<{scannedScreens:number;incidentsCreated:number}>('/incidents/scan-alerts',{method:'POST',body:'{}'});setNotice(`Alert scan complete: ${result.scannedScreens} screens checked; ${result.incidentsCreated} new incidents created.`);await load();}catch(e){setNotice(errorMessage(e));}finally{setBusy(false);}}
 async function move(status:Incident['status']){
  if(!active)return;setBusy(true);
  const body:Record<string,string>={status};
  if(status==='RESOLVED'){const note=window.prompt('Resolution note (required):');if(!note?.trim()){setNotice('Resolution cancelled: a resolution note is required.');setBusy(false);return;}body.resolutionNote=note.trim();}
  try{await apiRequest(`/incidents/${encodeURIComponent(active.id)}`,{method:'PATCH',body:JSON.stringify(body)});setNotice(`${active.id} updated to ${human(status)}.`);await load();}
  catch(e){setNotice(errorMessage(e));}finally{setBusy(false);}
 }
 return <main className="inc-shell"><Link href="/" className="inc-back">← Back to overview</Link><header className="inc-head"><div><span className="inc-eyebrow">OPERATIONS / INCIDENTS · BATCH 11</span><h1>Incident management</h1><p>Live incident queue, fleet alert scans and recovery workflow.</p></div><button disabled={busy||loading} onClick={()=>void scan()}>{busy?'Working…':'↻ Scan fleet alerts'}</button></header>
 <div className={`inc-banner ${live?'inc-live':''}`}><b>{live?'Live API':'Connection status'}</b><span>{notice}</span><button onClick={()=>void load()} disabled={loading}>{loading?'Loading…':'Refresh'}</button></div>
 <section className="inc-kpis"><article><small>OPEN</small><strong>{summary.open}</strong><span>Requires triage</span></article><article><small>CRITICAL</small><strong>{summary.critical}</strong><span>Immediate attention</span></article><article><small>IN PROGRESS</small><strong>{summary.inProgress}</strong><span>Being investigated</span></article><article><small>RESOLVED TODAY</small><strong>{summary.resolvedToday}</strong><span>Current API summary</span></article></section>
 <div className="inc-layout"><section className="inc-list"><div className="inc-list-head"><div><span className="inc-eyebrow">INCIDENT QUEUE</span><h2>Incidents <span>{rows.length}</span></h2></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All incidents</option><option value="OPEN">Open</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CRITICAL">Critical severity</option><option value="HIGH">High severity</option><option value="MEDIUM">Medium severity</option><option value="LOW">Low severity</option></select></div>
 {!live&&rows.length===0&&<div className="inc-empty"><strong>Live records not loaded</strong><p>{notice}</p><p>Configure the API URL, sign in and retry. No demo incidents are presented as real records.</p></div>}
 {live&&rows.length===0&&<div className="inc-empty">No incidents match this filter.</div>}
 {rows.map(r=><button key={r.id} className={`inc-item ${selected===r.id?'selected':''}`} onClick={()=>setSelected(r.id)}><div className="inc-item-top"><span className={`inc-severity ${r.severity.toLowerCase()}`}>{r.severity}</span><small>{formatAge(r.createdAt)}</small></div><strong>{r.title}</strong><span className="inc-device">{r.screen?`${r.screen.name} · ${r.screen.platform}`:'No screen linked'}</span><div className="inc-item-bottom"><span>{r.id}</span><span className={`inc-status ${r.status.toLowerCase()}`}>{human(r.status)}</span></div></button>)}
 </section>
 <section className="inc-detail">{active&&live?<><div className="inc-detail-top"><span className={`inc-severity ${active.severity.toLowerCase()}`}>{active.severity}</span><span className={`inc-status ${active.status.toLowerCase()}`}>{human(active.status)}</span></div><span className="inc-eyebrow">{active.id} · {human(active.category)}</span><h2>{active.title}</h2><p>{active.description||'No description supplied.'}</p><div className="inc-meta"><div><small>DEVICE</small><strong>{active.screen?.name||'Not linked'}</strong></div><div><small>PLATFORM</small><strong>{active.screen?.platform||'—'}</strong></div><div><small>OPENED</small><strong>{formatAge(active.createdAt)}</strong></div><div><small>ASSIGNEE ID</small><strong>{active.assignedToId||'Unassigned'}</strong></div></div><div className="inc-actions"><span className="inc-eyebrow">WORKFLOW ACTIONS</span>{active.status==='OPEN'&&<button disabled={busy} onClick={()=>void move('ACKNOWLEDGED')}>✓ Acknowledge incident</button>}{['OPEN','ACKNOWLEDGED'].includes(active.status)&&<button className="inc-secondary" disabled={busy} onClick={()=>void move('IN_PROGRESS')}>↗ Start investigation</button>}{!['RESOLVED','DISMISSED'].includes(active.status)&&<button className="inc-resolve" disabled={busy} onClick={()=>void move('RESOLVED')}>✓ Resolve with note</button>}</div></>:<div className="inc-empty"><strong>Incident details</strong><p>{live?'Select an incident to inspect it.':'Live API connection is required to inspect and update incidents.'}</p></div>}</section></div>
 <footer className="inc-footer">AJOOBA DIGITAL · ADFLICK PLAYOUT CMS · BATCH 11 · Live API mode</footer></main>
}
