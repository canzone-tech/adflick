import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/playback/playback.authorization-consumption.spec.ts',
  'apps/api/src/payouts/payouts.service.ts',
  'docs/BATCH-HISTORY.md',
  'docs/BATCH-HISTORY.md',
  'scripts/contracts/authorization-consumption.mjs',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) {
  console.error(`[authorization-consumption] Missing required file: ${file}`); process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
const race = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of ['counts no more than one completed event', 'PLAYBACK_AUTHORIZATION_ALREADY_CONSUMED', 'countedForEligibility']) {
  if (!race.includes(token)) { console.error(`[authorization-consumption] Missing race assertion: ${token}`); process.exitCode = 1; }
}
const payout = fs.readFileSync(path.join(root, required[1]), 'utf8');
if (!payout.includes('include: { items: { where: { organizationId } } }') ||
    !payout.includes('where: { payoutBatchId: id, organizationId, status: PayoutItemStatus.PENDING }')) {
  console.error('[authorization-consumption] Export reads and state updates must constrain payout items by organization.'); process.exitCode = 1;
}
const matrix = fs.readFileSync(path.join(root, required[3]), 'utf8');
for (const id of ['SEC-032-01','SEC-032-03','SEC-032-06','SEC-032-07']) {
  if (!matrix.includes(id)) { console.error(`[authorization-consumption] Missing acceptance case: ${id}`); process.exitCode = 1; }
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['check:source']?.includes('check-regression-contracts.mjs')) {
  console.error('[authorization-consumption] check:source must include check-regression-contracts.mjs.'); process.exitCode = 1;
}
if (!process.exitCode) console.log('Contract authorization-consumption static checks passed: authorization single-consumption assertions, tenant-scoped payout export, and acceptance matrix.');
