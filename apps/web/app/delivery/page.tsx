'use client';
import { useState } from 'react';
import './delivery.css';
const initial=[
 {screen:'BLR-MALL-014',name:'Mall Atrium Display',status:'ONLINE',manifest:'Fresh',campaign:'Summer Retail Launch',asset:'summer-hero.mp4',expires:'5 min window'},
 {screen:'BLR-CAFE-008',name:'Cafe Counter Screen',status:'ONLINE',manifest:'Fresh',campaign:'Cafe Weekend Combo',asset:'weekend-combo.mp4',expires:'5 min window'},
 {screen:'HUB-STORE-003',name:'Store Entrance TV',status:'OFFLINE',manifest:'Stale',campaign:'—',asset:'—',expires:'Refresh on reconnect'},
 {screen:'MYS-TRANSIT-021',name:'Transit Lobby Screen',status:'ONLINE',manifest:'Fresh',campaign:'Festival Electronics Offer',asset:'festival-offer.mp4',expires:'5 min window'},
];
export default function DeliveryPage(){
 const [filter,setFilter]=useState('ALL');
 const [refresh,setRefresh]=useState(0);
 const rows=initial.filter(r=>filter==='ALL'||r.status===filter);
 return <main className="delivery-shell"><a className="delivery-back" href="/">← Back to overview</a><header className="delivery-head"><div><span className="delivery-eyebrow">PLAYER DELIVERY / BATCH 07</span><h1>Playback delivery engine</h1><p>Preview the server-authorized campaign manifest model and screen delivery status.</p></div><button onClick={()=>setRefresh(v=>v+1)}>↻ Simulate refresh</button></header>
 <div className="delivery-alert"><b>Prototype view</b><span>This page displays sample data only. The API manifest endpoint is implemented, but this dashboard does not fetch it or control real devices.</span></div>
 <section className="delivery-stats"><div><small>REGISTERED SAMPLE SCREENS</small><strong>04</strong></div><div><small>ONLINE SAMPLE SCREENS</small><strong>03</strong></div><div><small>MANIFEST VALIDITY</small><strong>5 min</strong></div><div><small>REFRESH CADENCE</small><strong>60 sec</strong></div></section>
 <section className="delivery-panel"><div className="delivery-panel-head"><div><span className="delivery-eyebrow">DEVICE MANIFESTS</span><h2>Screen delivery status</h2></div><div className="delivery-filters">{[['ALL','All'],['ONLINE','Online'],['OFFLINE','Offline']].map(([v,l])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{l}</button>)}</div></div>
 <div className="delivery-table"><div className="delivery-row delivery-th"><span>SCREEN</span><span>CONNECTION</span><span>CAMPAIGN / ASSET</span><span>MANIFEST</span></div>{rows.map((r,i)=><div className="delivery-row" key={r.screen}><div><strong>{r.name}</strong><small>{r.screen}</small></div><div><span className={`delivery-dot ${r.status.toLowerCase()}`}/>{r.status}</div><div><strong>{r.campaign}</strong><small>{r.asset}</small></div><div><span className={`delivery-manifest ${r.manifest.toLowerCase()}`}>{r.manifest}</span><small>{r.expires}</small></div></div>)}</div><p className="delivery-refresh">Preview refresh #{refresh} · Sample screen state is unchanged by the real API.</p></section>
 <section className="delivery-grid"><article><span>01</span><h3>Eligibility resolver</h3><p>Only ACTIVE campaigns within their time window, in the screen’s organization, and matching target screens are considered.</p></article><article><span>02</span><h3>Signed media access</h3><p>Media URLs are short-lived object-storage download links; the manifest is also short-lived and should be refreshed by the player.</p></article><article><span>03</span><h3>Playback authorization</h3><p>Each manifest entry receives a one-time authorization token whose hash is stored server-side and expires automatically.</p></article></section>
 <footer className="delivery-foot">AJOOBA DIGITAL · ADFLICK PLAYOUT CMS · BATCH 07</footer></main>
}
