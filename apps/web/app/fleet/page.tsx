'use client';

import { useState } from 'react';
import './fleet.css';

type Screen = { id: string; name: string; platform: string; status: string; lastSeen: string; version: string };
const initialScreens: Screen[] = [
  { id: 'SCR-1001', name: 'Bengaluru Storefront 01', platform: 'Android TV', status: 'ONLINE', lastSeen: 'Just now', version: '1.0.0-demo' },
  { id: 'SCR-1002', name: 'Mall Entrance Display', platform: 'Windows Player', status: 'OFFLINE', lastSeen: '18 min ago', version: '1.0.0-demo' },
  { id: 'SCR-1003', name: 'Cafe Counter Screen', platform: 'Android TV', status: 'PENDING_PAIRING', lastSeen: 'Never', version: '—' },
];

export default function FleetPage() {
  const [screens, setScreens] = useState(initialScreens);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('Android TV');
  const [pairingCode, setPairingCode] = useState('');
  const [notice, setNotice] = useState('Fleet preview uses sample records. Create screens here to test the interface only.');
  const [selected, setSelected] = useState<string | null>(null);

  function createScreen() {
    if (!name.trim()) { setNotice('Enter a screen name first.'); return; }
    const id = `SCR-${1000 + screens.length + 1}`;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setScreens((items) => [{ id, name: name.trim(), platform, status: 'PENDING_PAIRING', lastSeen: 'Never', version: '—' }, ...items]);
    setPairingCode(code);
    setName('');
    setNotice(`Created ${id} in local preview. The real API generates a one-time pairing code and stores only its hash.`);
  }

  function command(screen: Screen, type: string) {
    setSelected(screen.id);
    setNotice(`${type} queued in preview for ${screen.name}. Real commands require API authentication and an online player.`);
  }

  return <main className="fleet-shell">
    <header className="fleet-header"><div><a href="/" className="back-link">← Back to overview</a><p className="eyebrow">DEVICE OPERATIONS / BATCH 04</p><h1>Screen Fleet</h1><p className="fleet-lead">Register screens, pair players and inspect fleet health.</p></div><span className="preview-pill">INTERACTIVE PREVIEW</span></header>
    <section className="fleet-stats"><div><span>Total screens</span><strong>{screens.length}</strong></div><div><span>Online</span><strong>{screens.filter(s=>s.status==='ONLINE').length}</strong></div><div><span>Offline</span><strong>{screens.filter(s=>s.status==='OFFLINE').length}</strong></div><div><span>Awaiting pairing</span><strong>{screens.filter(s=>s.status==='PENDING_PAIRING').length}</strong></div></section>
    <section className="fleet-main">
      <div className="fleet-panel">
        <div className="fleet-panel-head"><div><span className="eyebrow">FLEET INVENTORY</span><h2>Registered screens</h2></div><span className="count-pill">{screens.length} devices</span></div>
        <div className="screen-list">{screens.map(screen=><article className={`screen-card ${selected===screen.id?'focused':''}`} key={screen.id}>
          <div className="screen-icon"><span>▣</span></div><div className="screen-main"><strong>{screen.name}</strong><small>{screen.id} · {screen.platform}</small><div className="screen-meta"><span className={`status-pill ${screen.status.toLowerCase()}`}><i/> {screen.status.replace('_',' ')}</span><span>Player {screen.version}</span><span>Seen {screen.lastSeen}</span></div></div>
          <button className="dots-button" aria-label={`Actions for ${screen.name}`} onClick={()=>setSelected(selected===screen.id?null:screen.id)}>•••</button>
          {selected===screen.id && <div className="screen-actions"><button onClick={()=>command(screen,'Refresh playlist')}>Refresh playlist</button><button onClick={()=>command(screen,'Reload app')}>Reload player</button><button onClick={()=>command(screen,'Sync time')}>Sync time</button></div>}
        </article>)}</div>
      </div>
      <aside className="fleet-panel register-panel"><span className="eyebrow">NEW PLAYER</span><h2>Register a screen</h2><p>Register a display and issue a one-time code to pair the player.</p><label>Screen name<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Store display — front" maxLength={160}/></label><label>Player platform<select value={platform} onChange={e=>setPlatform(e.target.value)}><option>Android TV</option><option>Android Tablet</option><option>Windows Player</option><option>Linux Player</option><option>Samsung Tizen</option><option>LG webOS</option><option>iOS / iPadOS</option></select></label><button className="fleet-primary" onClick={createScreen}>+ Register screen</button>
        {pairingCode && <div className="pairing-code"><span>LOCAL DEMO PAIRING CODE</span><strong>{pairingCode}</strong><small>Preview only — not accepted by the API.</small></div>}
        <div className="pairing-note"><b>Secure pairing flow</b><span>Codes expire after 10 minutes and can be used once. The player generates and stores its device secret securely.</span></div>
      </aside>
    </section>
    <div className="fleet-notice" role="status"><span>i</span>{notice}</div>
    <footer className="fleet-footer">ADFLICK PLAYOUT CMS <span>·</span> BATCH 04 <span>·</span> Real fleet data requires authenticated API integration</footer>
  </main>;
}
