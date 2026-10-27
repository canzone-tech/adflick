#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const historyPath = path.join(root, 'docs/BATCH-HISTORY.md');
const errors = [];
if (!fs.existsSync(historyPath)) errors.push('Consolidated batch history is missing.');
const history = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '';
for (const token of [
  'Live transfers remain disabled', 'Live transfers stay disabled',
  'Tenant predicates', 'disposable local MySQL 8.4',
  'create or enable live payouts', 'runtime tests are not implied by static checks',
  'BATCH_50_FILE_MANIFEST.txt', 'docs/BATCH_21_ROLE_PERMISSION_REGRESSION_MATRIX.csv',
  'docs/BATCH_47_RELEASE_GATE.md',
]) if (!history.includes(token)) errors.push('Missing historical policy/evidence marker: ' + token);
for (const role of ['SUPER_ADMIN','ORGANIZATION_ADMIN','ADVERTISER','SCREEN_OWNER','CONTENT_MANAGER','OPERATIONS_MANAGER','FINANCE_MANAGER','SUPPORT_AGENT','AUDITOR_COMPLIANCE']) {
  if (!history.includes('\n'+role+',')) errors.push('Missing original role acceptance row: '+role);
}
for (const id of ['TEN-001','TEN-010','TEN-017','TEN-020','TEN-028-01','TEN-028-06','TEN-028-07','TEN-028-11','SEC-029-01','SEC-030-01','SEC-031-01','REL-001']) {
  if (!history.includes('\n'+id+',')) errors.push('Missing original test case: '+id);
}
const isLegacy = name => /^BATCH_\d+_(?:FILE_MANIFEST|SOURCE_FILE_LIST|MIGRATION_SHA256)\.txt$/.test(name) || /^BATCH[_-]\d/.test(name);
for (const directory of [root,path.join(root,'docs'),path.join(root,'docs/recovery')]) {
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory)) {
    if (isLegacy(name)) errors.push('Legacy per-batch file reintroduced: '+path.relative(root,path.join(directory,name)));
  }
}
if (fs.existsSync(path.join(root, 'docs/MILESTONE_REGISTER_001_150.csv'))) errors.push('Legacy milestone register must be kept in Git history only.');
if (errors.length) {
  for (const message of errors) console.error('FAIL: '+message);
  process.exitCode=1;
} else {
  console.log('Consolidated batch history checks passed: historical role/test evidence preserved; no per-batch docs reintroduced.');
}
