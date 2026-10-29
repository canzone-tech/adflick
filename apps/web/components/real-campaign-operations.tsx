'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiRequest, errorMessage } from '../lib/api';
import './real-operations.css';

type Identity = { roles: string[] };
type Asset = { id: string; title: string; status: string };
type Campaign = {
  id: string; name: string; status: string; reviewNote: string|null;
  creatives: Array<{ assetId: string }>; screenTargets: Array<{ screenId: string }>;
  createdAt: string;
};
const readRoles = ['SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','CONTENT_MANAGER','OPERATIONS_MANAGER','FINANCE_MANAGER','AUDITOR_COMPLIANCE'];
const writeRoles = ['SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','CONTENT_MANAGER','OPERATIONS_MANAGER'];
const cmsReadRoles = ['SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','CONTENT_MANAGER','OPERATIONS_MANAGER'];

export function RealCampaignOperations() {
  const [identity, setIdentity] = useState<Identity|null>(null);
  const [rows, setRows] = useState<Campaign[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [name, setName] = useState('');
  const [assetId, setAssetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const canRead = identity?.roles.some(role => readRoles.includes(role)) ?? false;
  const canWrite = identity?.roles.some(role => writeRoles.includes(role)) ?? false;

  async function refresh(withAssets: boolean) {
    const [campaigns, media] = await Promise.all([
      apiRequest<Campaign[]>('/campaigns'),
      withAssets ? apiRequest<Asset[]>('/cms/assets') : Promise.resolve([] as Asset[]),
    ]);
    setRows(campaigns); setAssets(media);
  }
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setNotice(''); setIdentity(null); setRows([]); setAssets([]);
    void (async () => {
      try {
        const me = await apiRequest<Identity>('/auth/me');
        if (!alive) return;
        setIdentity(me);
        if (!me.roles.some(role => readRoles.includes(role))) return;
        const [campaigns, media] = await Promise.all([
          apiRequest<Campaign[]>('/campaigns'),
          me.roles.some(role => cmsReadRoles.includes(role)) ? apiRequest<Asset[]>('/cms/assets') : Promise.resolve([] as Asset[]),
        ]);
        if (alive) { setRows(campaigns); setAssets(media); }
      } catch (e) { if (alive) setError(errorMessage(e)); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [reloadKey]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canWrite || !assets.some(a => a.id === assetId && a.status === 'READY')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      // A draft has no approved delivery or budget commitment. Asset must
      // already be READY within the authenticated tenant.
      const result = await apiRequest<{id:string}>('/campaigns', {
        method: 'POST', body: JSON.stringify({ name: name.trim(), creativeAssetIds: [assetId] }),
      });
      setName(''); setAssetId('');
      try {
        await refresh(true);
        setNotice('Campaign DRAFT ' + result.id + ' saved and reloaded from MySQL. Not submitted, scheduled or live.');
      } catch (e) {
        setNotice('Campaign DRAFT ' + result.id + ' accepted by API. Check inventory before retrying.');
        setError('Refresh failed after successful creation: ' + errorMessage(e));
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function submit(id: string) {
    if (busy || !canWrite) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await apiRequest('/campaigns/' + encodeURIComponent(id) + '/submit', { method: 'POST' });
      try {
        await refresh(true);
        setNotice('Campaign submitted for independent review. Not approved, scheduled or live.');
      } catch (e) {
        setNotice('Submission accepted by API. Inspect records before repeating.');
        setError('Refresh failed after submission: ' + errorMessage(e));
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section className="real-ops" data-testid="real-campaign-operations" aria-label="Authenticated campaign records">
    <div className="real-ops-header"><div><p className="real-ops-kicker">SECURED API / LIVE TENANT DATA</p>
      <h2>MySQL campaign workflow</h2>
      <p>Separate from sample campaign cards above. No demo budgets are sent to the server.</p></div>
      <button type="button" disabled={loading || busy} onClick={() => setReloadKey(k => k + 1)}>Reload records</button>
    </div>
    {loading && <p role="status">Checking campaign access and stored records…</p>}
    {error && <p role="alert" className="real-ops-error">{error}</p>}
    {!loading && !identity && <p>Please <Link href="/login">sign in</Link> for real campaign records.</p>}
    {!loading && identity && !canRead && <p role="status">Your role cannot access campaign records.</p>}
    {!loading && canRead && <div className="real-ops-grid">
      <div className="real-ops-panel"><h3>Stored campaigns ({rows.length} latest)</h3>
        {rows.length === 0 ? <p role="status">No real campaigns recorded for this account.</p> :
          <ul>{rows.map(row => <li key={row.id}>
            <strong>{row.name}</strong>
            <small>{row.id} · {row.status} · {row.creatives.length} creatives · {row.screenTargets.length} screens</small>
            {row.reviewNote && <small>Reviewer note: {row.reviewNote}</small>}
            {canWrite && row.status === 'DRAFT' && <button type="button" disabled={busy} onClick={() => void submit(row.id)}>Submit for review</button>}
          </li>)}</ul>}
        <p>API enforces tenant visibility and campaign transitions. This panel does not approve, schedule, activate or pay for delivery.</p>
      </div>
      <div className="real-ops-panel"><h3>Create secured draft</h3>
        {canWrite ? <form onSubmit={e => void create(e)}>
          <label>Campaign name<input required maxLength={180} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label>
          <label>Verified READY creative<select required value={assetId} disabled={busy} onChange={e => setAssetId(e.target.value)}>
            <option value="">Select a READY media asset</option>
            {assets.filter(item => item.status === 'READY').map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select></label>
          <button type="submit" disabled={busy || !name.trim() || !assets.some(a => a.id === assetId && a.status === 'READY')}>Create real DRAFT</button>
        </form> : <p>Read-only role; no draft creation permission.</p>}
        <p>Draft creation requires independently verified media. S3 upload and trusted verification are separate prerequisites. No prices, commission or payment policies are inferred.</p>
      </div>
    </div>}
    {notice && <p className="real-ops-notice" role="status">{notice}</p>}
  </section>;
}
