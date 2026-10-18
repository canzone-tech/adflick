// CI-only, disposable schema research. NEVER edits committed migrations or production DBs.
// Compare a temporary normalized copy of migrations with the historical, original SQL.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { auditMigrationSources } from './migration-fk-audit.mjs';

if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.ADFLICK_DISPOSABLE_SCHEMA_EXPERIMENT !== '1') {
  throw new Error('Schema experiment is restricted to the isolated GitHub CI diagnostic job.');
}
const url = new URL(process.env.DATABASE_URL ?? '');
if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
    url.pathname !== '/adflick_diagnostic') {
  throw new Error('Refusing to run outside the dedicated local adflick_diagnostic test schema.');
}
const temp = mkdtempSync(join(process.cwd(), '.adflick-migration-research-'));
const originalRoot = resolve('prisma/migrations');
try {
  cpSync(resolve('prisma'), join(temp, 'prisma'), { recursive: true });
  // Resolve the existing Prisma CLI without contacting the registry.
  const prismaBinary = resolve('node_modules/.bin/prisma');
  const original = [];
  const modified = [];
  const folders = readdirSync(originalRoot, { withFileTypes: true })
    .filter(f => f.isDirectory()).map(f => f.name).sort();
  for (const name of folders) {
    const file = join('prisma', 'migrations', name, 'migration.sql');
    const from = readFileSync(resolve(file), 'utf8');
    original.push({ path: file, sql: from });
    const corrected = from.replaceAll('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_0900_ai_ci');
    if (corrected !== from) modified.push(name);
    writeFileSync(join(temp, file), corrected);
  }
  const historical = auditMigrationSources(original);
  const experimental = auditMigrationSources(original.map(x => ({
    path: x.path, sql: x.sql.replaceAll('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_0900_ai_ci')
  })));
  console.log('Historical FK findings: ' + historical.findings.length);
  console.log('Temporary diagnostic FK findings: ' + experimental.findings.length);
  console.log('Temporary SQL copies normalized in ' + modified.length + ' migration directories.');
  if (historical.findings.length < 1 || experimental.findings.length !== 0) {
    throw new Error('Schema experiment preflight differs from expected historical defect.');
  }
  // Resolve dependencies from root node_modules while keeping every modified SQL file outside the repository tree.
  writeFileSync(join(temp, 'prisma.config.ts'), [
    "import { defineConfig, env } from 'prisma/config';",
    "export default defineConfig({ schema: 'prisma/schema.prisma',",
    "  migrations: { path: 'prisma/migrations' }, datasource: { url: env('DATABASE_URL') } });",
    ''
  ].join('\n'));
  const result = spawnSync(prismaBinary, ['migrate', 'deploy'], {
    cwd: temp, env: process.env, stdio: 'inherit', timeout: 120000, shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Temporary schema migration failed: exit ' + result.status);
  // Prove the test did not modify any historical SQL bytes in the checked-out repository.
  for (const row of original) {
    if (readFileSync(resolve(row.path), 'utf8') !== row.sql) {
      throw new Error('Committed historical migration changed unexpectedly: ' + row.path);
    }
  }
  console.log('DIAGNOSTIC ONLY: temporary MySQL migration replay succeeded; historical migrations are still broken and unchanged.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
