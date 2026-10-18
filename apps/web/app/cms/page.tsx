'use client';
import Link from 'next/link';

import { useState } from 'react';
import './cms.css';

type Zone = { id: number; name: string; x: number; y: number; width: number; height: number; type: 'Video' | 'Ticker' | 'Image' };

const initialZones: Zone[] = [
  { id: 1, name: 'Main content', x: 0, y: 0, width: 68, height: 100, type: 'Video' },
  { id: 2, name: 'Side promotion', x: 68, y: 0, width: 32, height: 70, type: 'Image' },
  { id: 3, name: 'News ticker', x: 68, y: 70, width: 32, height: 30, type: 'Ticker' },
];

export default function CmsPage() {
  const [tab, setTab] = useState<'layouts' | 'media' | 'playlists'>('layouts');
  const [zones, setZones] = useState<Zone[]>(initialZones);
  const [layoutName, setLayoutName] = useState('Retail 3-Zone Layout');
  const [message, setMessage] = useState('Local workspace preview — changes are in browser state only.');
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState('image/png');
  const [assets, setAssets] = useState<{ name: string; type: string; status: string }[]>([]);
  const [playlistName, setPlaylistName] = useState('Morning Store Playlist');
  const [playlistItems, setPlaylistItems] = useState<string[]>([]);

  function updateZone(id: number, patch: Partial<Zone>) {
    setZones((current) => current.map((zone) => zone.id === id ? { ...zone, ...patch } : zone));
    setMessage('Layout changed locally. Connect the authenticated API to persist it.');
  }

  function addZone() {
    if (zones.length >= 8) {
      setMessage('Maximum of 8 zones in this editor preview.');
      return;
    }
    const id = Math.max(0, ...zones.map((zone) => zone.id)) + 1;
    setZones((current) => [...current, { id, name: `Zone ${id}`, x: 0, y: 0, width: 20, height: 20, type: 'Image' }]);
  }

  function addAsset() {
    if (!assetName.trim()) {
      setMessage('Enter a media filename first.');
      return;
    }
    setAssets((current) => [...current, { name: assetName.trim(), type: assetType, status: 'Needs upload' }]);
    setAssetName('');
    setMessage('Media metadata added to the local preview only; file bytes are not uploaded.');
  }

  function togglePlaylist(name: string) {
    setPlaylistItems((current) => current.includes(name) ? current.filter((x) => x !== name) : [...current, name]);
  }

  return (
    <main className="cms-shell">
      <header className="cms-header">
        <div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">CONTENT OPERATIONS / BATCH 03</p><h1>CMS & Layout Studio</h1><p className="lead">Design screen layouts, prepare media and compose playlists.</p></div>
        <span className="preview-pill">INTERACTIVE PREVIEW</span>
      </header>
      <div className="cms-tabs" role="tablist" aria-label="CMS modules">
        {(['layouts', 'media', 'playlists'] as const).map((value) => <button key={value} className={tab === value ? 'selected' : ''} onClick={() => setTab(value)} role="tab" aria-selected={tab === value}>{value === 'layouts' ? 'Layout Studio' : value === 'media' ? 'Media Library' : 'Playlists & Scheduling'}</button>)}
      </div>

      {tab === 'layouts' && <section className="cms-grid">
        <div className="panel editor-panel">
          <div className="panel-heading"><div><span className="eyebrow">CANVAS EDITOR</span><h2>Multi-zone composition</h2></div><span className="resolution">1920 × 1080</span></div>
          <label className="field-label" htmlFor="layoutName">Layout name</label>
          <input id="layoutName" value={layoutName} onChange={(e) => setLayoutName(e.target.value)} maxLength={180} />
          <div className="canvas-wrap"><div className="canvas">
            {zones.map((zone) => <div key={zone.id} className={`zone zone-${zone.type.toLowerCase()}`} style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%` }}><b>{zone.name}</b><span>{zone.type}</span></div>)}
          </div></div>
          <div className="canvas-footer"><span>Canvas preview · 16:9</span><span>{zones.length} zones</span></div>
          <button className="primary-button" onClick={() => setMessage(`Draft "${layoutName}" prepared locally. Use POST /api/v1/cms/layouts after connecting API authentication.`)}>Save draft layout</button>
        </div>
        <div className="panel properties-panel">
          <div className="panel-heading"><div><span className="eyebrow">PROPERTIES</span><h2>Zone settings</h2></div><button className="small-button" onClick={addZone}>+ Add zone</button></div>
          <div className="zone-list">{zones.map((zone) => <div className="zone-setting" key={zone.id}>
            <div className="zone-setting-head"><span className={`zone-chip ${zone.type.toLowerCase()}`}>{zone.id}</span><input aria-label={`Zone ${zone.id} name`} value={zone.name} onChange={(e) => updateZone(zone.id, { name: e.target.value })} /><select aria-label={`Zone ${zone.id} type`} value={zone.type} onChange={(e) => updateZone(zone.id, { type: e.target.value as Zone['type'] })}><option>Video</option><option>Image</option><option>Ticker</option></select></div>
            <div className="coordinate-grid">{(['x','y','width','height'] as const).map((field) => <label key={field}>{field.toUpperCase()} (%)<input type="number" min={0} max={100} value={zone[field]} onChange={(e) => updateZone(zone.id, { [field]: Math.min(100, Math.max(0, Number(e.target.value))) })} /></label>)}</div>
            <button className="remove-link" onClick={() => setZones((current) => current.filter((z) => z.id !== zone.id))} disabled={zones.length <= 1}>Remove zone</button>
          </div>)}</div>
          <p className="hint">This visual editor is a prototype. Server-side layout validation enforces canvas boundaries when saving through the API.</p>
        </div>
      </section>}

      {tab === 'media' && <section className="panel media-panel">
        <div className="panel-heading"><div><span className="eyebrow">ASSET MANAGEMENT</span><h2>Media library</h2></div><span className="resolution">{assets.length} local items</span></div>
        <p className="hint">This batch adds an authenticated API upload URL flow for S3-compatible storage. The list below is only local browser state and does not upload file bytes.</p>
        <div className="media-form"><label>Display name<input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Diwali campaign hero" maxLength={180} /></label><label>MIME type<select value={assetType} onChange={(e) => setAssetType(e.target.value)}><option value="image/png">PNG image</option><option value="image/jpeg">JPEG image</option><option value="image/webp">WebP image</option><option value="video/mp4">MP4 video</option><option value="video/webm">WebM video</option><option value="audio/mpeg">MP3 audio</option></select></label><button className="primary-button" onClick={addAsset}>Add metadata preview</button></div>
        <div className="asset-table"><div className="asset-row asset-head"><span>ASSET</span><span>TYPE</span><span>STATUS</span></div>{assets.length === 0 ? <div className="empty-state">No local preview assets yet. Add one above to test the UI.</div> : assets.map((asset, i) => <div className="asset-row" key={`${asset.name}-${i}`}><span>{asset.name}</span><span>{asset.type}</span><span><i className="status-dot" />{asset.status}</span></div>)}</div>
      </section>}

      {tab === 'playlists' && <section className="cms-grid playlist-grid">
        <div className="panel"><div className="panel-heading"><div><span className="eyebrow">PLAYLIST BUILDER</span><h2>Sequence content</h2></div></div><label className="field-label" htmlFor="playlistName">Playlist name</label><input id="playlistName" value={playlistName} onChange={(e) => setPlaylistName(e.target.value)} maxLength={180} /><div className="playlist-sequence"><div className="sequence-title">Available local media</div>{assets.length === 0 ? <p className="empty-state">Add preview assets in the Media Library tab first.</p> : assets.map((asset) => <label className="check-row" key={asset.name}><input type="checkbox" checked={playlistItems.includes(asset.name)} onChange={() => togglePlaylist(asset.name)} /> <span>{asset.name}</span><small>{asset.type}</small></label>)}</div><button className="primary-button" onClick={() => setMessage(`Playlist "${playlistName}" has ${playlistItems.length} selected local items. Real persistence requires API authentication and READY assets.`)}>Save playlist draft</button></div>
        <div className="panel"><span className="eyebrow">SCHEDULING FOUNDATION</span><h2>Playback plan</h2><div className="schedule-card"><span className="schedule-time">06:00 — 11:00</span><strong>Morning rotation</strong><small>Weekdays · Asia/Kolkata</small></div><div className="schedule-card"><span className="schedule-time">11:00 — 18:00</span><strong>Daytime rotation</strong><small>Every day · Asia/Kolkata</small></div><div className="schedule-card"><span className="schedule-time">18:00 — 23:00</span><strong>Evening rotation</strong><small>Every day · Asia/Kolkata</small></div><p className="hint">Scheduling UI is illustrative. Device targeting, conflict resolution and timezone-aware delivery are planned for later batches.</p></div>
      </section>}

      <div className="notice" role="status"><span>i</span>{message}</div>
      <footer className="cms-footer">ADFLICK PLAYOUT CMS <span>·</span> BATCH 03 <span>·</span> Media uploads require configured S3 storage and authenticated API calls</footer>
    </main>
  );
}
