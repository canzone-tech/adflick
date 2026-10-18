import test from 'node:test';
import assert from 'node:assert/strict';
import { auditMigrationSources } from './migration-fk-audit.mjs';
const migration = (name, sql) => ({ path: name + '/migration.sql', sql });
const parent = (collation) => 'CREATE TABLE \x60Organization\x60 (\x60id\x60 VARCHAR(30) NOT NULL) ' +
  'DEFAULT CHARACTER SET utf8mb4 COLLATE ' + collation + ';';
const child = (collation) => 'CREATE TABLE \x60Incident\x60 (' +
  '\x60id\x60 VARCHAR(30) NOT NULL, \x60organizationId\x60 VARCHAR(30) NOT NULL, ' +
  'CONSTRAINT \x60Incident_org_fkey\x60 FOREIGN KEY (\x60organizationId\x60) REFERENCES \x60Organization\x60(\x60id\x60)' +
  ') DEFAULT CHARACTER SET utf8mb4 COLLATE ' + collation + ';';
test('compatible parent and child collations pass', () => {
  const r = auditMigrationSources([migration('001', parent('utf8mb4_0900_ai_ci')), migration('002', child('utf8mb4_0900_ai_ci'))]);
  assert.equal(r.foreignKeys, 1);
  assert.deepEqual(r.findings, []);
});
test('incompatible source and destination collation fails', () => {
  const r = auditMigrationSources([migration('001', parent('utf8mb4_0900_ai_ci')), migration('010', child('utf8mb4_unicode_ci'))]);
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0], /incompatible FK charset\/collation/);
});
test('ALTER TABLE foreign keys are inspected', () => {
  const create = 'CREATE TABLE \x60Incident\x60 (\x60id\x60 VARCHAR(30) NOT NULL) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;';
  const alter = 'ALTER TABLE \x60Incident\x60 ADD COLUMN \x60organizationId\x60 VARCHAR(30) NULL, ' +
    'ADD CONSTRAINT \x60Incident_org_fkey\x60 FOREIGN KEY (\x60organizationId\x60) REFERENCES \x60Organization\x60(\x60id\x60);';
  const r = auditMigrationSources([migration('001', parent('utf8mb4_0900_ai_ci')),
    migration('002', create), migration('003', alter)]);
  assert.equal(r.foreignKeys, 1);
  assert.deepEqual(r.findings, []);
});
test('missing parent fails closed', () => {
  const r = auditMigrationSources([migration('010', child('utf8mb4_unicode_ci'))]);
  assert.match(r.findings.join('\n'), /FK table not found/);
});
