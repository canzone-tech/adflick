import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalLocalLoginUrl } from '../apps/web/lib/local-origin.ts';
const api = 'http://127.0.0.1:40977/api/v1';
test('local login canonicalizes localhost on same web port; preserves path and query', () => {
  assert.equal(canonicalLocalLoginUrl('http://localhost:45237/login', api), 'http://127.0.0.1:45237/login');
  assert.equal(canonicalLocalLoginUrl('http://localhost:45237/login?from=%2Fcms', api), 'http://127.0.0.1:45237/login?from=%2Fcms');
});
test('canonical address does not loop or adopt API port', () => {
  assert.equal(canonicalLocalLoginUrl('http://127.0.0.1:45237/login', api), null);
  assert.notEqual(canonicalLocalLoginUrl('http://localhost:45237/login', api), 'http://127.0.0.1:40977/login');
});
test('production, HTTPS, other hosts or non-API targets are unchanged', () => {
  for (const [url, backend] of [
    ['https://example.test/login', api],
    ['http://example.test/login', api],
    ['http://localhost.evil.test:45237/login', api],
    ['https://localhost:45237/login', api],
    ['http://localhost:45237/login', 'https://example.test/api/v1'],
    ['http://localhost:45237/login', 'http://localhost:40977/api/v1'],
    ['http://localhost:45237/login', 'http://127.0.0.1:40977/other'],
    ['http://localhost:45237/login', ''],
    ['http://localhost:45237/login', '%%%'],
  ]) assert.equal(canonicalLocalLoginUrl(url, backend), null);
});
