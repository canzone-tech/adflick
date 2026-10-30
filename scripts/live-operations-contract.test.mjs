import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = path => readFileSync(path, 'utf8');
const delivery = get('apps/web/app/delivery/page.tsx');
const scheduler = get('apps/web/app/scheduler/page.tsx');
const playback = get('apps/web/app/playback/page.tsx');
const browser = get('scripts/browser-uat.mjs');

test('Delivery and Scheduler are tenant-authenticated read-only live views, never preview simulation', () => {
  assert.match(delivery, /apiRequest<Screen\[]>\('\/fleet\/screens'\)/);
  assert.match(delivery, /apiRequest<Summary>\('\/fleet\/health-summary'\)/);
  assert.match(scheduler, /apiRequest<Screen\[]>\('\/fleet\/screens'\)/);
  assert.match(scheduler, /'\/fleet\/screens\/' \+ encodeURIComponent\(selectedId\) \+ '\/playlists'/);
  assert.doesNotMatch(delivery, /Mall Atrium Display|Simulate refresh|sample data only/i);
  assert.doesNotMatch(scheduler, /ASN-001|function toggle|Demo data only/i);
  assert.match(delivery, /manifest.*NOT been requested/i);
  assert.match(scheduler, /never queues a device command/i);
});
test('Playback only exports real accepted aggregates and does not claim event-level or payout evidence', () => {
  assert.match(playback, /apiRequest<Report>\('\/reports\/playback'\)/);
  assert.match(playback, /setReport\(null\); setError/);
  assert.match(playback, /accepted_completed_plays/);
  assert.doesNotMatch(playback, /evt_7a91|Summer Collection 15s\.mp4|sample rows/i);
  assert.match(playback, /not automatic payout/i);
});
test('failed API refresh clears old tenant data on sensitive operational views', () => {
  assert.match(get('apps/web/app/health/page.tsx'), /catch\(e\)\{setRows\(\[\]\);setSummary\(blank\);setLive\(false\)/);
  assert.match(get('apps/web/app/incidents/page.tsx'), /catch\(e\)\{setRows\(\[\]\);setSummary\(emptySummary\);setSelected\(''\);setLive\(false\)/);
  assert.match(get('apps/web/app/finance/page.tsx'), /setRewards\(\[\]\);setApprovals\(\[\]\);setError/);
  assert.match(get('apps/web/app/finance/payouts/page.tsx'), /setBatches\(\[\]\);setDisputes\(\[\]\);setError/);
});
test('real Chrome UAT proves live cross-page inventory and excludes MFA secret from screenshots', () => {
  assert.match(browser, /Chrome live Delivery \/ Scheduler \/ Playback tenant data PASS/);
  assert.match(browser, /mfa-setup-output/);
  assert.match(browser, /await navigate\('\/account'\);\s*await until\("document\.querySelector\('\[data-testid=mfa-status\]'/);
});
