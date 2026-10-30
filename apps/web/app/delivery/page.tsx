'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage, formatAge } from '../../lib/api';
import './delivery.css';

type Screen = { id: string; name: string; platform: string; status: string; lastHeartbeatAt?: string|null; lastSyncAt?: string|null; lastPlayerError?: string|null };
type Summary = { screens: { total: number; online: number; offline: number; maintenance: number; unhealthy: number }; generatedAt: string };

export default function DeliveryPage() {
  const [rows, setRows] = useState<Screen[]>([]);
  const [summary, setSummary] = useState<Summary|null>(null);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [screens, health] = await Promise.all([
        apiRequest<Screen[]>('/fleet/screens'),
        apiRequest<Summary>('/fleet/health-summary'),
      ]);
      if (!Array.isArray(screens) || !health?.screens) throw new Error('Invalid fleet response.');
      setRows(screens); setSummary(health); setLive(true);
    } catch (e) {
      // Clear old tenant data and previous success if API auth/availability changes.
      setRows([]); setSummary(null); setLive(false); setError(errorMessage(e));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => rows.filter(r => filter === 'ALL' || r.status === filter), [rows, filter]);
  return <main className="delivery-shell">
    <Link className="delivery-back" href="/">← Back to overview</Link>
    <header className="delivery-head"><div><span className="delivery-eyebrow">PLAYER DELIVERY / LIVE FLEET</span><h1>Playback delivery engine</h1><p>Tenant-scoped device state from the authenticated MySQL fleet API.</p></div>
      <button type="button" disabled={loading} onClick={() => void load()}>{loading ? 'Loading…' : '↻ Refresh live data'}</button></header>
    <div className="delivery-alert" role={error ? 'alert' : 'status'} data-testid="delivery-api-state">
      <b>{loading ? 'Loading' : live ? 'Live API connected' : 'Data unavailable'}</b>
      <span>{error || (live ? 'Showing real registered screens. Device-secret-only manifests have NOT been requested; no media grant, campaign, asset or playback claim is inferred.' : 'No verified fleet data loaded.')}</span>
    </div>
    <section className="delivery-stats" aria-label="Live fleet summary">
      <div><small>REGISTERED SCREENS</small><strong>{summary?.screens.total ?? '—'}</strong></div>
      <div><small>ONLINE SCREENS</small><strong>{summary?.screens.online ?? '—'}</strong></div>
      <div><small>OFFLINE SCREENS</small><strong>{summary?.screens.offline ?? '—'}</strong></div>
      <div><small>NEEDS ATTENTION</small><strong>{summary ? summary.screens.unhealthy + summary.screens.offline : '—'}</strong></div>
    </section>
    <section className="delivery-panel"><div className="delivery-panel-head"><div><span className="delivery-eyebrow">REAL FLEET INVENTORY</span><h2>Screen delivery readiness</h2></div>
      <div className="delivery-filters">{[['ALL','All'],['ONLINE','Online'],['OFFLINE','Offline']].map(([v,l]) =>
        <button key={v} type="button" aria-pressed={filter === v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>{l}</button>)}</div></div>
      <div className="delivery-table"><div className="delivery-row delivery-th"><span>SCREEN</span><span>CONNECTION</span><span>PLAYER SYNC</span><span>MANIFEST</span></div>
        {visible.map(r => <div className="delivery-row" key={r.id}>
          <div><strong>{r.name}</strong><small>{r.id} · {r.platform}</small></div>
          <div><span className={'delivery-dot ' + r.status.toLowerCase()}/>{r.status}<small>Heartbeat {formatAge(r.lastHeartbeatAt)}</small></div>
          <div><strong>{r.lastSyncAt ? 'Reported sync' : 'Not reported'}</strong><small>{r.lastPlayerError || ('Last sync ' + formatAge(r.lastSyncAt))}</small></div>
          <div><span className="delivery-manifest stale">Not inspected</span><small>Requires paired device secret and authorized manifest request</small></div>
        </div>)}
        {!loading && live && visible.length === 0 && <p className="delivery-refresh" data-testid="delivery-empty">No registered screens match this filter.</p>}
      </div>
      <p className="delivery-refresh">Fleet read is not a media playback test or independently verified manifest status. No remote commands were issued.</p>
    </section>
    <section className="delivery-grid"><article><span>01</span><h3>Eligibility</h3><p>Device-specific manifest authorization is enforced by the API, not this staff dashboard.</p></article><article><span>02</span><h3>Media access</h3><p>Only the paired player can request time-bound authorized media URLs.</p></article><article><span>03</span><h3>Playback trust</h3><p>Self-reported playback remains distinct from independent physical screen verification.</p></article></section>
  </main>;
}
