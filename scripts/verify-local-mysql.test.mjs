import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDockerPort } from './verify-local-mysql.mjs';

test('accepts exactly one loopback TCP published port', () => {
  assert.equal(parseDockerPort('127.0.0.1:49152\n'), 49152);
});
test('rejects public bindings, multiple entries and invalid ports', () => {
  for (const candidate of ['0.0.0.0:49152', ':::49152', '127.0.0.1:33', '127.0.0.1:70000',
    '127.0.0.1:49152\n127.0.0.1:49153']) {
    assert.throws(() => parseDockerPort(candidate));
  }
});
