// GitHub CI-only isolated replay of unchanged ADFLICK migrations.
// NOT a source migration rewrite, not a production authorisation or recovery procedure.
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditMigrationSources } from './migration-fk-audit.mjs';

if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.ADFLICK_DISPOSABLE_SCHEMA_EXPERIMENT !== '1') {
  throw new Error('Schema rehearsal only runs in its dedicated GitHub CI diagnostic job.');
}
const url = new URL(process.env.DATABASE_URL ?? '');
if (url.protocol !== 'mysql:' || !['localhost', '127.0.0.1', '::1'].includes(url.hostname) ||
    url.pathname !== '/adflick_diagnostic') {
  throw new Error('Refusing to use any database except dedicated localhost adflick_diagnostic.');
}
const temp = mkdtempSync(join(process.cwd(), '.adflick-migration-rehearsal-'));
const folders = readdirSync(resolve('prisma/migrations'), { withFileTypes: true })
  .filter(x => x.isDirectory()).map(x => x.name).sort();
const sources = folders.map(name => {
  const path = join('prisma', 'migrations', name, 'migration.sql');
  return { path, sql: readFileSync(resolve(path), 'utf8') };
});
try {
  const audit = auditMigrationSources(sources);
  console.log('Immutable migrations: ' + sources.length + ', FK findings: ' + audit.findings.length);
  for (const finding of audit.findings) console.error(finding);
  if (audit.findings.length !== 0) throw new Error('Original migration compatibility audit failed.');
  cpSync(resolve('prisma'), join(temp, 'prisma'), { recursive: true });
  writeFileSync(join(temp, 'prisma.config.ts'), [
    "import { defineConfig, env } from 'prisma/config';",
    "export default defineConfig({ schema: 'prisma/schema.prisma',",
    "  migrations: { path: 'prisma/migrations' }, datasource: { url: env('DATABASE_URL') } });",
    ''
  ].join('\n'));
  const prismaBinary = resolve('node_modules/.bin/prisma');
  const result = spawnSync(prismaBinary, ['migrate', 'deploy'], {
    cwd: temp, env: process.env, stdio: 'inherit', timeout: 120000, shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Unmodified schema rehearsal failed with exit ' + result.status);
  for (const item of sources) {
    const actual = readFileSync(resolve(item.path), 'utf8');
    const replay = readFileSync(join(temp, item.path), 'utf8');
    if (actual !== item.sql || replay !== item.sql) {
      throw new Error('Migration history modified during rehearsal: ' + item.path);
    }
  }
  console.log('PASS: identical original migration SQL applied on CI-only adflick_diagnostic; no historical source modifications.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
