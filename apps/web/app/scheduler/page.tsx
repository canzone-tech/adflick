'use client';
import { useMemo, useState } from 'react';
import './scheduler.css';
const initial=[
 {id:'ASN-001',screen:'BLR-MALL-014',screenName:'Mall Atrium Display',playlist:'Retail Loop — Main Floor',priority:10,start:'Always active',end:'No end date',enabled:true,lastSync:'Synced 1 min ago'},
 {id:'ASN-002',screen:'BLR-CAFE-008',screenName:'Cafe Counter Screen',playlist:'Cafe Offers — Portrait',priority:20,start:'Today, 08:00',end:'Today, 22:00',enabled:true,lastSync:'Refresh queued'},
 {id:'ASN-003',screen:'HUB-STORE-003',screenName:'Store Entrance TV',playlist:'Regional Promo Loop',priority:30,start:'Tomorrow, 09:00',end:'In 30 days',enabled:false,lastSync:'Offline · waits for reconnect'},
 {id:'ASN-004',screen:'MYS-TRANSIT-021',screenName:'Transit Lobby Screen',playlist:'Transit Information Loop',priority:15,start:'Always active',end:'No end date',enabled:true,lastSync:'Synced 3 min ago'},
];
export default function SchedulerPage(){
 const [filter,setFilter]=useState('ALL');
 const [rows,setRows]=useState(initial);
 const [notice,setNotice]=useState('Demo data only — this page does not call the API.');
 const visible=useMemo(()=>rows.filter(r=>filter==='ALL'||(filter==='ENABLED'?r.enabled:!r.enabled)),[rows,filter]);
 function toggle(id:string){setRows(old=>old.map(r=>r.id===id?{...r,enabled:!r.enabled}:r));setNotice('Local preview changed. Save/disable through the API in the integrated player console.');}
 return <main className="sched-shell"><a href="/" className="sched-back">← Back to overview</a><header className="sched-head"><div><span className="sched-eyebrow">PLAYLISTS / SCHEDULER · BATCH 08</span><h1>Scheduling & player sync</h1><p>Assign active playlists to screens and preview scheduler-driven refresh behavior.</p></div><a href="/delivery" className="sched-primary">Open delivery engine ↗</a></header>
 <div className="sched-notice"><b>Prototype</b><span>{notice}</span></div>
 <section className="sched-metrics"><article><small>ASSIGNMENTS</small><strong>{rows.length.toString().padStart(2,'0')}</strong></article><article><small>ENABLED</small><strong>{rows.filter(r=>r.enabled).length.toString().padStart(2,'0')}</strong></article><article><small>SYNC COMMANDS</small><strong>02</strong></article><article><small>SCHEDULER CYCLE</small><strong>60 sec</strong></article></section>
 <section className="sched-panel"><div className="sched-panel-head"><div><span className="sched-eyebrow">SCREEN ASSIGNMENTS</span><h2>Playlist assignment register</h2></div><div className="sched-filters">{[['ALL','All'],['ENABLED','Enabled'],['DISABLED','Disabled']].map(([v,l])=><button key={v} className={filter===v?'selected':''} onClick={()=>setFilter(v)}>{l}</button>)}</div></div>
 <div className="sched-table"><div className="sched-row sched-th"><span>SCREEN / ID</span><span>ASSIGNED PLAYLIST</span><span>SCHEDULE WINDOW</span><span>PRIORITY</span><span>STATUS</span></div>{visible.map(r=><div className="sched-row" key={r.id}><div><strong>{r.screenName}</strong><small>{r.screen} · {r.id}</small></div><div><strong>{r.playlist}</strong><small>{r.lastSync}</small></div><div><strong>{r.start}</strong><small>Until: {r.end}</small></div><div><span className="sched-priority">{r.priority}</span></div><div><button className={`sched-toggle ${r.enabled?'on':''}`} onClick={()=>toggle(r.id)} aria-label={`${r.enabled?'Disable':'Enable'} ${r.id}`}><i/>{r.enabled?'Enabled':'Disabled'}</button></div></div>)}</div>
 <p className="sched-footnote">Priority is lower-number-first. Schedule windows are interpreted in the API/database timezone in this prototype; per-screen timezone/daypart support remains a future enhancement.</p></section>
 <section className="sched-cards"><article><span>01</span><h3>Campaign lifecycle worker</h3><p>Activates scheduled campaigns whose start time has arrived and completes campaigns after their end time.</p></article><article><span>02</span><h3>Playlist assignment API</h3><p>Supports listing, assigning/updating, and disabling screen playlist assignments with organization and role checks.</p></article><article><span>03</span><h3>Refresh command queue</h3><p>Creates device refresh commands on assignment changes and periodically checks for enabled assignments.</p></article></section>
 <footer className="sched-footer">AJOOBA DIGITAL · ADFLICK PLAYOUT CMS · BATCH 08</footer></main>
}
