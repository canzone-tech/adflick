import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { auditMigrationSources } from './migration-fk-audit.mjs';
const directory = path.resolve('prisma/migrations');
const sources = readdirSync(directory, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()
  .map(name => ({ path: 'prisma/migrations/' + name + '/migration.sql',
    sql: readFileSync(path.join(directory, name, 'migration.sql'), 'utf8') }));
const result = auditMigrationSources(sources);
console.log('FK compatibility audit: ' + result.tables + ' tables, ' + result.foreignKeys +
  ' foreign keys, ' + result.findings.length + ' findings.');
for (const message of result.findings) console.error('MIGRATION CONTRACT FAIL: ' + message);
if (result.findings.length) {
  console.error('Historical migration SQL unchanged. Do not bypass a failed Prisma migrate deploy.');
  process.exitCode = 1;
}
