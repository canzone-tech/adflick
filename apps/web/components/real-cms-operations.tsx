'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../lib/api';
import './real-operations.css';

type Identity = { roles: string[] };
type Zone = { id: number; name: string; x: number; y: number; width: number; height: number; type: string };
type Asset = { id: string; title: string; originalName: string; mimeType: string; status: string; sizeBytes: string };
type Playlist = { id: string; name: string; status: string; itemsJson: unknown };
type Layout = { id: string; name: string; status: string; version: number };
type UploadSession = { asset: Asset; uploadUrl: string; uploadMethod: 'PUT' };
const readerRoles = ['SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','CONTENT_MANAGER','OPERATIONS_MANAGER'];
const writerRoles = ['SUPER_ADMIN','ORGANIZATION_ADMIN','CONTENT_MANAGER'];

export function RealCmsOperations({ zones, layoutName }: { zones: Zone[]; layoutName: string }) {
  const [identity, setIdentity] = useState<Identity|null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [assetTitle, setAssetTitle] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('15');
  const [reloadKey, setReloadKey] = useState(0);
  const canRead = identity?.roles.some(role => readerRoles.includes(role)) ?? false;
  const canWrite = identity?.roles.some(role => writerRoles.includes(role)) ?? false;
  const canUpload = identity?.roles.some(role => [...writerRoles,'ADVERTISER'].includes(role)) ?? false;

  async function refresh() {
    const [nextAssets, nextPlaylists, nextLayouts] = await Promise.all([
      apiRequest<Asset[]>('/cms/assets'),
      apiRequest<Playlist[]>('/cms/playlists'),
      apiRequest<Layout[]>('/cms/layouts'),
    ]);
    setAssets(nextAssets); setPlaylists(nextPlaylists); setLayouts(nextLayouts);
  }
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setNotice(''); setIdentity(null);
    setAssets([]); setPlaylists([]); setLayouts([]);
    void (async () => {
      try {
        const me = await apiRequest<Identity>('/auth/me');
        if (!alive) return;
        setIdentity(me);
        if (me.roles.some(role => readerRoles.includes(role))) {
          const [a, p, t] = await Promise.all([
            apiRequest<Asset[]>('/cms/assets'),
            apiRequest<Playlist[]>('/cms/playlists'),
            apiRequest<Layout[]>('/cms/layouts'),
          ]);
          if (alive) { setAssets(a); setPlaylists(p); setLayouts(t); }
        }
      } catch (e) { if (alive) setError(errorMessage(e)); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !file || !assetTitle.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      // Presigned S3-compatible upload is an actual byte transfer, not a local mock.
      const session = await apiRequest<UploadSession>('/cms/assets', {
        method: 'POST',
        body: JSON.stringify({
          title: assetTitle.trim(), originalName: file.name,
          mimeType: file.type, sizeBytes: file.size,
        }),
      });
      const bytes = await file.arrayBuffer();
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map(value => value.toString(16).padStart(2, '0')).join('');
      const transferred = await fetch(session.uploadUrl, {
        method: session.uploadMethod, body: file, headers: { 'Content-Type': file.type },
      });
      if (!transferred.ok) throw new Error('Object storage PUT failed (' + transferred.status + '). Upload is not verified.');
      await apiRequest('/cms/assets/' + encodeURIComponent(session.asset.id) + '/complete-upload', {
        method: 'POST', body: JSON.stringify({ checksumSha256: checksum }),
      });
      setFile(null); setAssetTitle('');
      // A processing request is not trusted READY media until independent worker verification.
      setNotice('File transferred; verification requested. Asset remains PROCESSING until trusted media worker approval.');
      await refresh();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function saveLayout() {
    if (busy || !canWrite || !layoutName.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest('/cms/layouts', { method: 'POST', body: JSON.stringify({
        name: layoutName.trim(), canvasWidth: 1920, canvasHeight: 1080,
        zones: zones.map(zone => ({
          id: String(zone.id), name: zone.name, type: zone.type,
          x: Math.round(zone.x * 19.2), y: Math.round(zone.y * 10.8),
          width: Math.round(zone.width * 19.2), height: Math.round(zone.height * 10.8),
        })),
      }) });
      await refresh();
      setNotice('Layout DRAFT saved to tenant-scoped MySQL. It is not published or assigned.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function createPlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seconds = Number(durationSeconds);
    if (busy || !canWrite || !selectedAsset || !Number.isInteger(seconds) || seconds < 1 || seconds > 86400) {
      setError('Select a READY asset and a duration of 1–86400 seconds.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest('/cms/playlists', {
        method: 'POST', body: JSON.stringify({
          name: playlistName.trim(),
          items: [{ assetId: selectedAsset, durationMs: seconds * 1000, order: 0 }],
        }),
      });
      setPlaylistName(''); setSelectedAsset('');
      await refresh();
      setNotice('Playlist DRAFT saved to MySQL. No activation or scheduling was performed.');
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  return <section className="real-ops" data-testid="real-cms-operations" aria-label="Authenticated CMS records">
    <div className="real-ops-header">
      <div><p className="real-ops-kicker">SECURED API / LIVE TENANT DATA</p><h2>MySQL CMS operations</h2>
        <p>These records are separate from the browser-only design preview above.</p></div>
      <button type="button" disabled={busy || loading} onClick={() => setReloadKey(k => k + 1)}>Reload records</button>
    </div>
    {loading && <p role="status">Checking CMS access and loading stored records…</p>}
    {error && <p className="real-ops-error" role="alert">{error}</p>}
    {!loading && !identity && <p>Sign in via <Link href="/login">member/staff login</Link> for secured CMS access.</p>}
    {!loading && identity && !canRead && <p role="status">Your role has no CMS record access.</p>}
    {!loading && canRead && <>
      <div className="real-ops-grid">
        <div className="real-ops-panel"><h3>Stored media ({assets.length} latest)</h3>
          <p>Only independently verified READY assets can be used in campaigns or playlists.</p>
          {assets.length === 0 ? <p role="status">No media in this organization.</p> :
            <ul>{assets.map(a => <li key={a.id}><strong>{a.title}</strong><small>{a.originalName} · {a.mimeType} · {a.status}</small></li>)}</ul>}
          {canUpload && <form onSubmit={e => void upload(e)}>
            <label>Media title<input required maxLength={180} value={assetTitle} disabled={busy} onChange={e => setAssetTitle(e.target.value)}/></label>
            <label>Choose file (max 500 MiB)<input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg" disabled={busy}
              onChange={e => setFile(e.target.files?.[0] ?? null)}/></label>
            <button type="submit" disabled={busy || !file || !assetTitle.trim() || file.size > 524288000}>{busy ? 'Uploading…' : 'Upload file via secured API'}</button>
            <small>Requires configured S3 storage, compatible CORS and independent READY verification. No upload is simulated.</small>
          </form>}
        </div>
        <div className="real-ops-panel"><h3>Stored layout drafts ({layouts.length} latest)</h3>
          {layouts.length ? <ul>{layouts.map(item => <li key={item.id}><strong>{item.name}</strong><small>{item.status} · v{item.version}</small></li>)}</ul> : <p role="status">No layouts recorded.</p>}
          {canWrite && <button type="button" disabled={busy || !layoutName.trim() || !zones.length} onClick={() => void saveLayout()}>
            Save current canvas as real DRAFT
          </button>}
          <p>Layout save records draft geometry only. No player configuration is published.</p>
        </div>
        <div className="real-ops-panel"><h3>Stored playlist drafts ({playlists.length} latest)</h3>
          {playlists.length ? <ul>{playlists.map(item => <li key={item.id}><strong>{item.name}</strong><small>{item.status}</small></li>)}</ul> : <p role="status">No playlists recorded.</p>}
          {canWrite && <form onSubmit={e => void createPlaylist(e)}>
            <label>Playlist name<input required maxLength={180} value={playlistName} disabled={busy} onChange={e => setPlaylistName(e.target.value)}/></label>
            <label>Verified READY asset<select required value={selectedAsset} disabled={busy} onChange={e => setSelectedAsset(e.target.value)}>
              <option value="">Select an independently verified asset</option>
              {assets.filter(a => a.status === 'READY').map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select></label>
            <label>Duration (seconds)<input type="number" min={1} max={86400} step={1} required value={durationSeconds} disabled={busy} onChange={e => setDurationSeconds(e.target.value)}/></label>
            <button type="submit" disabled={busy || !playlistName.trim() || !assets.some(a => a.status === 'READY' && a.id === selectedAsset)}>Save playlist DRAFT</button>
          </form>}
        </div>
      </div>
    </>}
    {notice && <p className="real-ops-notice" role="status">{notice}</p>}
  </section>;
}
