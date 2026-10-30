'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage, formatAge } from '../../lib/api';
import './scheduler.css';

type Screen = { id: string; name: string; status: string; lastSyncAt?: string|null };
type Assignment = { id: string; priority: number; isEnabled: boolean; startsAt?: string|null; endsAt?: string|null; playlist: { id: string; name: string; status: string } };
const when = (value?: string|null) => value ? new Date(value).toLocaleString() : 'Not restricted';
export default function SchedulerPage() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [screenLoading, setScreenLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const loadScreens = useCallback(async () => {
    setScreenLoading(true); setError('');
    try {
      const list = await apiRequest<Screen[]>('/fleet/screens');
      if (!Array.isArray(list)) throw new Error('Invalid fleet response.');
      setScreens(list); setLive(true);
      setSelectedId(current => current && list.some(s => s.id === current) ? current : (list[0]?.id ?? ''));
    } catch (e) {
      setScreens([]); setSelectedId(''); setRows([]); setLive(false); setError(errorMessage(e));
    } finally { setScreenLoading(false); }
  }, []);
  useEffect(() => { void loadScreens(); }, [loadScreens]);
  useEffect(() => {
    if (!live || !selectedId) { setRows([]); return; }
    let current = true;
    setRows([]); setAssignmentLoading(true);
    void apiRequest<Assignment[]>('/fleet/screens/' + encodeURIComponent(selectedId) + '/playlists')
      .then(list => {
        if (!Array.isArray(list)) throw new Error('Invalid playlist assignment response.');
        if (current) { setRows(list); setError(''); }
      })
      .catch(e => { if (current) { setRows([]); setError(errorMessage(e)); } })
      .finally(() => { if (current) setAssignmentLoading(false); });
    return () => { current = false; };
  }, [selectedId, live]);
  const visible = useMemo(() => rows.filter(r => filter === 'ALL' || (filter === 'ENABLED' ? r.isEnabled : !r.isEnabled)), [rows, filter]);
  const selected = screens.find(s => s.id === selectedId);
  return <main className="sched-shell">
    <Link className="sched-back" href="/">← Back to overview</Link>
    <header className="sched-head"><div><span className="sched-eyebrow">PLAYLISTS / REAL ASSIGNMENTS</span><h1>Scheduling & player sync</h1><p>Read-only tenant-scoped assignment inventory from the existing API. Changes are not simulated.</p></div>
      <button type="button" className="sched-primary" disabled={screenLoading || assignmentLoading} onClick={() => void loadScreens()}>{screenLoading ? 'Loading…' : '↻ Refresh screens'}</button></header>
    <div className="sched-notice" data-testid="scheduler-api-state" role={error ? 'alert' : 'status'}>
      <b>{screenLoading || assignmentLoading ? 'Loading' : error ? 'Data unavailable' : live ? 'Live API connected' : 'Not connected'}</b>
      <span>{error || 'Existing ACTIVE playlist assignments can be managed only through separately authorized API actions. This view never queues a device command.'}</span>
    </div>
    <section className="sched-metrics">
      <article><small>REGISTERED SCREENS</small><strong>{live ? screens.length : '—'}</strong></article>
      <article><small>SELECTED ASSIGNMENTS</small><strong>{live && !error && !assignmentLoading ? rows.length : '—'}</strong></article>
      <article><small>ENABLED ASSIGNMENTS</small><strong>{live && !error && !assignmentLoading ? rows.filter(r => r.isEnabled).length : '—'}</strong></article>
      <article><small>SELECTED LAST SYNC</small><strong style={{fontSize:14}}>{selected?.lastSyncAt ? formatAge(selected.lastSyncAt) : 'Not reported'}</strong></article>
    </section>
    <section className="sched-panel"><div className="sched-panel-head"><div><span className="sched-eyebrow">LIVE SCREEN ASSIGNMENTS</span><h2>Playlist assignment register</h2></div>
      <div className="sched-filters">{[['ALL','All'],['ENABLED','Enabled'],['DISABLED','Disabled']].map(([v,l]) =>
        <button type="button" key={v} aria-pressed={filter === v} className={filter === v ? 'selected' : ''} onClick={() => setFilter(v)}>{l}</button>)}</div></div>
      <label style={{display:'grid',maxWidth:460,gap:6,marginTop:16}}>Registered screen
        <select aria-label="Registered screen" value={selectedId} disabled={!live || screenLoading || screens.length === 0}
          onChange={e => setSelectedId(e.target.value)}>{screens.length ? screens.map(s => <option key={s.id} value={s.id}>{s.name} · {s.status}</option>) : <option value="">No registered screens</option>}</select>
      </label>
      <div className="sched-table"><div className="sched-row sched-th"><span>SCREEN / ID</span><span>ASSIGNED PLAYLIST</span><span>SCHEDULE WINDOW</span><span>PRIORITY</span><span>STATUS</span></div>
        {!assignmentLoading && !error && visible.map(r => <div className="sched-row" key={r.id}>
          <div><strong>{selected?.name ?? 'Screen'}</strong><small>{selectedId} · {r.id}</small></div>
          <div><strong>{r.playlist.name}</strong><small>Playlist {r.playlist.status}</small></div>
          <div><strong>{when(r.startsAt)}</strong><small>Until: {when(r.endsAt)}</small></div>
          <div><span className="sched-priority">{r.priority}</span></div>
          <div><span className={'sched-toggle ' + (r.isEnabled ? 'on' : '')}>{r.isEnabled ? 'Enabled' : 'Disabled'}</span></div>
        </div>)}
        {!assignmentLoading && live && !error && visible.length === 0 && <p className="sched-footnote" data-testid="scheduler-empty">No assignments match this screen and filter. Only independently ACTIVE playlists can be assigned by authorized operators.</p>}
      </div>
      <p className="sched-footnote">No demo toggles, auto-activation, or fake sync metrics. The API enforces ACTIVE playlist status, tenant scope and authorized assignment transitions.</p>
    </section>
    <section className="sched-cards"><article><span>01</span><h3>Server-side schedule</h3><p>Assignment validity and priority are evaluated by the paired-player delivery API.</p></article><article><span>02</span><h3>Authorization boundary</h3><p>Creating/disabling assignments requires an authorized role and an ACTIVE playlist.</p></article><article><span>03</span><h3>Player synchronization</h3><p>Only actual player heartbeats establish reported sync; this dashboard does not invent it.</p></article></section>
  </main>;
}
