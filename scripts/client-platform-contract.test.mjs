import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const matrix = readFileSync('docs/CLIENT-PLATFORM-SUPPORT.md', 'utf8');
const backlog = readFileSync('docs/SRS-V1-DELIVERY-BACKLOG.md', 'utf8');
const traceability = readFileSync('docs/SRS-V1-TRACEABILITY.md', 'utf8');
const fleet = readFileSync('apps/web/components/real-fleet-operations.tsx', 'utf8');

const required = [
  ['PLAT-01', 'Android phones and tablets', 'Android Mobile'],
  ['PLAT-02', 'Android TV', 'Android TV'],
  ['PLAT-03', 'iOS', 'iOS / iPadOS'],
  ['PLAT-04', 'Samsung', 'Samsung Tizen'],
  ['PLAT-05', 'LG', 'LG webOS'],
  ['PLAT-06', 'Windows', 'Windows Player'],
  ['PLAT-07', 'Linux', 'Linux Player'],
  ['PLAT-08', 'Roku TV', 'Roku TV'],
  ['PLAT-09', 'Fire TV OS', 'Fire TV OS'],
  ['PLAT-10', 'Titan OS', 'Titan OS'],
  ['PLAT-11', 'VIZIO SmartCast', 'VIZIO SmartCast'],
  ['PLAT-12', 'Xumo TV OS', 'Xumo TV OS'],
  ['PLAT-13', 'Apple tvOS', 'Apple tvOS'],
];

test('all thirteen client OS delivery groups remain mandatory and tracked', () => {
  for (const [id, label, fleetOption] of required) {
    assert.ok(matrix.split('\n').some(line =>
      line.startsWith('| ' + id + ' |') && line.includes(label) &&
      /PENDING|MISSING/.test(line)),
      id + ' must remain explicitly required and unaccepted pending platform UAT');
    assert.ok(fleet.includes("'" + fleetOption + "'"),
      'Fleet must expose required target: ' + fleetOption);
    assert.ok(backlog.includes(id), 'Backlog must track ' + id);
  }
  assert.ok(fleet.includes("'Android Tablet'"), 'Android tablet option must remain available');
  assert.ok(traceability.includes('PLAT-01…PLAT-13'), 'SRS traceability must cover all platform gates');
  assert.ok(fleet.includes("'Google TV'"), 'Google TV label must remain registered');
});

test('platform confirmation is not misrepresented as an original SRS quotation or native release', () => {
  assert.match(matrix, /project.owner.confirmed client scope/i);
  assert.match(matrix, /original DOCX was not accessible/i);
  assert.match(matrix, /Required ≠ built ≠ tested ≠ approved/);
  assert.match(matrix, /Flutter support does\s+(?:\*\*)?not(?:\*\*)?\s+establish an approved, working Tizen, webOS, Windows, Linux or iOS player/);
  assert.match(fleet, /Registration only records a platform in MySQL/);
});

test('all nine required Smart TV platforms remain explicitly unaccepted and traced', () => {
  for (const [id, family] of [
    ['PLAT-02','Google TV / Android TV'], ['PLAT-04','Tizen OS'],
    ['PLAT-05','webOS'], ['PLAT-08','Roku TV'],
    ['PLAT-09','Fire TV OS'], ['PLAT-10','Titan OS'],
    ['PLAT-11','SmartCast'], ['PLAT-12','Xumo TV OS'],
    ['PLAT-13','tvOS'],
  ]) {
    const row = matrix.split('\n').find(line => line.startsWith('| '+id+' |'));
    assert.ok(row && row.toLowerCase().includes(family.toLowerCase()), id + ' required TV target missing');
    assert.match(row, /MISSING|PENDING/, id + ' must not be called accepted');
    assert.ok(backlog.includes(id) && traceability.includes(id), id + ' must be in backlog/traceability');
  }
  assert.match(matrix, /Vega OS is a distinct runtime/);
  assert.match(matrix, /not permission to draw ads on top of third-party apps/);
  assert.match(matrix, /not a verified original SRS quotation/);
});
