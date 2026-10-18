import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'apps/api/src/finance/providers/sandbox-provider.ts',
  'apps/api/src/finance/providers/reconciliation-match.ts',
  'apps/api/src/finance/providers/sandbox-provider.spec.ts',
  'apps/api/src/finance/providers/reconciliation-match.spec.ts',
  'docs/BATCH_19_SANDBOX_PROVIDER_RECONCILIATION.md'
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`Missing Batch 19 file: ${file}`);
    process.exitCode = 1;
  }
}
const prisma = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
if (!/provider\s*=\s*"mysql"/.test(prisma)) {
  console.error('Prisma datasource must remain MySQL.');
  process.exitCode = 1;
}
const adapter = fs.readFileSync(path.join(root, required[0]), 'utf8');
for (const token of ['timingSafeEqual', 'idempotencyKey', 'assertLiveTransfersDisabled']) {
  if (!adapter.includes(token)) {
    console.error(`Missing safety guard in sandbox provider: ${token}`);
    process.exitCode = 1;
  }
}
if (!process.exitCode) console.log('Batch 19 static checks passed.');
