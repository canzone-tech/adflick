'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest, errorMessage } from '../../lib/api';
import './playback.css';

type ScreenCount = { screenId: string; _count: { _all: number } };
type Report = { acceptedCompletedPlays: number; byScreen: ScreenCount[] };

export default function PlaybackPage() {
  const [report, setReport] = useState<Report|null>(null);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('');
    try {
      const result = await apiRequest<Report>('/reports/playback');
      if (!result || !Number.isSafeInteger(result.acceptedCompletedPlays) || !Array.isArray(result.byScreen) ||
          result.byScreen.some(r => typeof r.screenId !== 'string' || !Number.isSafeInteger(r._count?._all))) {
        throw new Error('Invalid accepted playback report response.');
      }
      setReport(result);
    } catch (e) { setReport(null); setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => (report?.byScreen ?? []).filter(r => r.screenId.toLowerCase().includes(search.toLowerCase())), [report, search]);
  function exportCsv() {
    if (!report) return;
    const q = (v: string) => '"' + v.replaceAll('"','""') + '"';
    const csv = ['screen_id,accepted_completed_plays', ...visible.map(r => q(r.screenId) + ',' + r._count._all)].join('\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    const a = document.createElement('a'); a.href = url; a.download = 'adflick-accepted-playback-by-screen.csv'; a.click();
    URL.revokeObjectURL(url);
    setNotice('Export contains API-accepted completion counts only; no screen-visibility or reward proof.');
  }
  return <main className="playback-shell">
    <header className="playback-header"><div><Link className="back-link" href="/">← Back to overview</Link><p className="eyebrow">PLAYBACK / TENANT-SCOPED REPORT</p><h1>Proof of Play</h1><p className="playback-lead">Real accepted PLAY_COMPLETED aggregates from the authenticated API, not illustrative event records.</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="export-button" type="button" disabled={loading} onClick={() => void load()}>{loading ? 'Loading…' : '↻ Refresh'}</button>
      <button className="export-button" type="button" disabled={!report || loading} onClick={exportCsv}>↓ Export accepted counts</button></div></header>
    <div className="playback-notice" role={error ? 'alert' : 'status'} data-testid="playback-api-state">
      {error || (loading ? 'Loading real report…' : report ? 'Live API connected · accepted completion aggregates only; individual rejected/duplicate events are not exposed by this report endpoint.' : 'Report unavailable.')}
    </div>
    <section className="playback-stats">
      <div><span>Accepted completions</span><strong>{report?.acceptedCompletedPlays ?? '—'}</strong><small>Server-accepted, self-reported events</small></div>
      <div><span>Screens with accepted plays</span><strong>{report?.byScreen.length ?? '—'}</strong><small>Top 100 grouped by API</small></div>
      <div><span>Rejected / duplicate totals</span><strong>—</strong><small>Not available in this endpoint</small></div>
      <div><span>External display verification</span><strong>—</strong><small>Not independently established</small></div>
    </section>
    <section className="playback-panel"><div className="playback-panel-head"><div><span className="eyebrow">ACCEPTED COMPLETION SUMMARY</span><h2>Playback by screen</h2></div><span className="demo-pill">LIVE API REPORT</span></div>
      <div className="playback-controls"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search screen ID…" aria-label="Search screen IDs"/></div>
      <div className="playback-table"><div className="playback-row playback-head"><span>SCREEN ID</span><span>ACCEPTED COMPLETIONS</span><span>REPORT SCOPE</span><span>ELIGIBILITY</span></div>
        {visible.map(r => <article className="playback-row" key={r.screenId}><div><strong>{r.screenId}</strong></div><div><strong>{r._count._all}</strong></div><span>PLAY_COMPLETED</span><div><span className="event-status accepted">Server accepted</span><small>Not automatic payout or physical proof</small></div></article>)}
        {!loading && report && visible.length === 0 && <div className="playback-empty" data-testid="playback-empty">No accepted plays match this filter. A zero report is not a playback failure.</div>}
      </div>
    </section>
    <section className="proof-note"><span>i</span><div><strong>Trust boundary</strong><p>Only server-accepted, device-reported PLAY_COMPLETED events appear here. This is not independent screen visibility, anti-fraud sign-off, live device certification, financial eligibility or payout authorization. Event-level rejected and duplicate counts need separate approved reporting API work.</p></div></section>
    {notice && <div className="playback-notice" role="status">{notice}</div>}
  </main>;
}
