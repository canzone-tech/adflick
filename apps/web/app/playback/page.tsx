'use client';
import Link from 'next/link';

import { useMemo, useState } from 'react';
import './playback.css';

type EventRow = { id: string; screen: string; asset: string; campaign: string; duration: string; status: 'ACCEPTED'|'REJECTED'|'DUPLICATE'; reason: string; time: string };
const initial: EventRow[] = [
 {id:'evt_7a91',screen:'Bengaluru Storefront 01',asset:'Summer Collection 15s.mp4',campaign:'Summer Retail',duration:'15.0s',status:'ACCEPTED',reason:'Validation rules passed',time:'10:42:18'},
 {id:'evt_7a92',screen:'Mall Entrance Display',asset:'Weekend Offer 20s.mp4',campaign:'Weekend Offers',duration:'8.4s',status:'REJECTED',reason:'Below minimum completion ratio',time:'10:41:57'},
 {id:'evt_7a93',screen:'Cafe Counter Screen',asset:'Coffee Combo 10s.mp4',campaign:'Cafe Launch',duration:'10.0s',status:'ACCEPTED',reason:'Validation rules passed',time:'10:41:33'},
 {id:'evt_7a94',screen:'Bengaluru Storefront 01',asset:'Summer Collection 15s.mp4',campaign:'Summer Retail',duration:'15.0s',status:'DUPLICATE',reason:'Event ID already received',time:'10:41:02'},
 {id:'evt_7a95',screen:'Mall Entrance Display',asset:'Weekend Offer 20s.mp4',campaign:'Weekend Offers',duration:'20.0s',status:'ACCEPTED',reason:'Validation rules passed',time:'10:40:45'},
];

export default function PlaybackPage() {
 const [filter,setFilter]=useState('ALL');
 const [rows]=useState(initial);
 const [notice,setNotice]=useState('Sample events only. Connect the API to inspect validated playback records.');
 const [search,setSearch]=useState('');
 const visible=useMemo(()=>rows.filter(r=>(filter==='ALL'||r.status===filter)&&`${r.screen} ${r.asset} ${r.campaign} ${r.reason}`.toLowerCase().includes(search.toLowerCase())),[rows,filter,search]);
 const accepted=rows.filter(r=>r.status==='ACCEPTED').length;
 const rejected=rows.filter(r=>r.status==='REJECTED').length;
 const duplicates=rows.filter(r=>r.status==='DUPLICATE').length;
 function exportCsv(){const csv=['event_id,screen,asset,campaign,duration,status,reason,time',...visible.map(r=>[r.id,r.screen,r.asset,r.campaign,r.duration,r.status,r.reason,r.time].map(v=>`"${v.replaceAll('"','""')}"`).join(','))].join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='adflick-playback-demo.csv';a.click();URL.revokeObjectURL(url);setNotice('Exported the currently filtered sample rows. Live export must use the authenticated reporting API.');}
 return <main className="playback-shell">
  <header className="playback-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">PLAYBACK ANALYTICS / BATCH 05</p><h1>Proof of Play</h1><p className="playback-lead">Inspect playback events, validation outcomes and reporting foundations.</p></div><button className="export-button" onClick={exportCsv}>↓ Export CSV</button></header>
  <section className="playback-stats"><div><span>Accepted completions</span><strong>{accepted}</strong><small>Candidate qualifying events</small></div><div><span>Rejected events</span><strong>{rejected}</strong><small>Validation failures</small></div><div><span>Duplicates</span><strong>{duplicates}</strong><small>Idempotency protection</small></div><div><span>Completion rule</span><strong>90%</strong><small>Minimum of expected duration</small></div></section>
  <section className="playback-panel"><div className="playback-panel-head"><div><span className="eyebrow">EVENT LEDGER</span><h2>Playback event records</h2></div><span className="demo-pill">SAMPLE DATA</span></div>
   <div className="playback-controls"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search screen, asset, campaign…" aria-label="Search playback events"/><div className="playback-filters">{['ALL','ACCEPTED','REJECTED','DUPLICATE'].map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f==='ALL'?'All events':f[0]+f.slice(1).toLowerCase()}</button>)}</div></div>
   <div className="playback-table"><div className="playback-row playback-head"><span>EVENT / TIME</span><span>SCREEN & ASSET</span><span>DURATION</span><span>VALIDATION</span></div>
   {visible.length===0?<div className="playback-empty">No records match this filter.</div>:visible.map(r=><article className="playback-row" key={r.id}><div><strong>{r.id}</strong><small>{r.time}</small></div><div><strong>{r.screen}</strong><small>{r.asset} · {r.campaign}</small></div><span>{r.duration}</span><div><span className={`event-status ${r.status.toLowerCase()}`}>{r.status}</span><small>{r.reason}</small></div></article>)}</div>
  </section>
  <section className="proof-note"><span>i</span><div><strong>What counts as a qualifying play?</strong><p>Only accepted PLAY_COMPLETED events are candidates for eligibility calculations. A production system must additionally verify actual media bytes, campaign authorization, player integrity, anti-replay controls and any business-specific qualification rules. A client-reported event alone is not conclusive proof.</p></div></section>
  <div className="playback-notice" role="status">{notice}</div>
  <footer className="playback-footer">ADFLICK PLAYOUT CMS <span>·</span> BATCH 05 <span>·</span> API integration and device-side tests required</footer>
 </main>;
}
