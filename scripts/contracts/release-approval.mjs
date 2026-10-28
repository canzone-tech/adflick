import fs from 'node:fs';
import path from 'node:path';
const required = [
  'apps/api/src/finance/providers/callback-validation.ts',
  'apps/api/src/finance/providers/callback-validation.spec.ts',
  'apps/api/src/finance/release/release-gate.ts',
  'apps/api/src/finance/release/release-gate.spec.ts',
  'docs/BATCH-HISTORY.md'
];
for (const f of required) if (!fs.existsSync(path.join(process.cwd(), f))) {
  console.error(`Missing Contract release-approval file: ${f}`); process.exitCode = 1;
}
const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(schema)) { console.error('Prisma provider must remain MySQL.'); process.exitCode = 1; }
const gate = fs.readFileSync(path.join(process.cwd(), required[2]), 'utf8');
for (const s of ['mysqlIntegrationPassed','providerSandboxPassed','financeApprovalPassed','liveTransfersExplicitlyEnabled']) {
  if (!gate.includes(s)) { console.error(`Release gate missing ${s}`); process.exitCode = 1; }
}
if (!process.exitCode) console.log('Contract release-approval static checks passed.');
