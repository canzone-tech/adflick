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


test('append-only FK bridge reconciles child and parent ID collation without touching table defaults', () => {
  const bridge = [
    'ALTER TABLE \x60Incident\x60 DROP FOREIGN KEY \x60Incident_org_fkey\x60;',
    'ALTER TABLE \x60Incident\x60 MODIFY COLUMN \x60organizationId\x60 VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;',
    'ALTER TABLE \x60Organization\x60 MODIFY COLUMN \x60id\x60 VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;',
    'ALTER TABLE \x60Incident\x60 ADD CONSTRAINT \x60Incident_org_fkey\x60 FOREIGN KEY (\x60organizationId\x60) REFERENCES \x60Organization\x60(\x60id\x60);'
  ].join('\n');
  const result = auditMigrationSources([migration('001', parent('utf8mb4_0900_ai_ci')),
    migration('002', child('utf8mb4_0900_ai_ci')), migration('009z', bridge),
    migration('010', 'CREATE TABLE \x60NotificationOutbox\x60 (' +
      '\x60id\x60 VARCHAR(30) NOT NULL, \x60organizationId\x60 VARCHAR(30) NOT NULL, ' +
      'CONSTRAINT \x60NotificationOutbox_org_fkey\x60 FOREIGN KEY (\x60organizationId\x60) REFERENCES \x60Organization\x60(\x60id\x60)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;')]);
  assert.equal(result.foreignKeys, 2);
  assert.deepEqual(result.findings, []);
});

test('composite org/member FK verifies both columns and rejects incompatible second column', () => {
  const parent = migration('001', 'CREATE TABLE `Member` (`id` VARCHAR(30) NOT NULL, `organizationId` VARCHAR(30) NOT NULL) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  const child = migration('002', 'CREATE TABLE `Child` (`organizationId` VARCHAR(30) NOT NULL, `memberId` VARCHAR(30) NOT NULL, CONSTRAINT `Child_member_fkey` FOREIGN KEY (`organizationId`,`memberId`) REFERENCES `Member`(`organizationId`,`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  const good = auditMigrationSources([parent, child]);
  assert.equal(good.foreignKeys, 1);
  assert.deepEqual(good.findings, []);
  const bad = migration('001', 'CREATE TABLE `Member` (`id` INT NOT NULL, `organizationId` VARCHAR(30) NOT NULL) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  assert.match(auditMigrationSources([bad, child]).findings.join('\n'), /incompatible FK column categories/);
});
