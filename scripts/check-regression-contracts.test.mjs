import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_CONTRACT_GROUPS, runSourceContracts } from './check-regression-contracts.mjs';

test('all source contracts are unique, semantic and executed', () => {
  const calls = [];
  const expected = SOURCE_CONTRACT_GROUPS.flatMap(group => group.checks);
  const count = runSourceContracts({
    cwd: '/isolated',
    fileExists: () => true,
    run: (_cmd, args, options) => {
      calls.push({ path: args[0], options });
      return { status: 0, stdout: '', stderr: '' };
    },
    report: () => {},
  });
  assert.equal(count, expected.length);
  assert.equal(new Set(expected).size, expected.length);
  assert.ok(expected.every(path => /^scripts\/contracts\/[a-z-]+\.mjs$/.test(path)));
  assert.deepEqual(calls.map(call => call.path), expected.map(path => '/isolated/' + path));
  assert.ok(calls.every(call => call.options.shell === false && call.options.timeout > 0));
});

test('missing contract fails closed rather than skipping checks', () => {
  assert.throws(() => runSourceContracts({
    cwd: '/isolated', fileExists: () => false,
    report: () => {},
  }), /Missing source regression contract/);
});

test('failed contract blocks verification and exposes diagnostics', () => {
  assert.throws(() => runSourceContracts({
    cwd: '/isolated', fileExists: () => true,
    run: () => ({ status: 1, stdout: 'failed assertion', stderr: 'failure details' }),
    report: () => {},
  }), /Source contract failed:[\s\S]*failed assertion[\s\S]*failure details/);
});
