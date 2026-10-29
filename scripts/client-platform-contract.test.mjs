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
];

test('all seven project-owner-confirmed client OS targets remain mandatory and tracked', () => {
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
  assert.ok(traceability.includes('PLAT-01…PLAT-07'), 'SRS traceability must cover all platform gates');
});

test('platform confirmation is not misrepresented as an original SRS quotation or native release', () => {
  assert.match(matrix, /project.owner.confirmed client scope/i);
  assert.match(matrix, /original DOCX was not accessible/i);
  assert.match(matrix, /Required ≠ built ≠ tested ≠ approved/);
  assert.match(matrix, /does not establish an approved, working Tizen, webOS, Windows, Linux or iOS player/);
  assert.match(fleet, /Registration only records a platform in MySQL/);
});
