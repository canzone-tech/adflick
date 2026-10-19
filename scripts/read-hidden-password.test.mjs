import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readHiddenPassword } from './read-hidden-password.mjs';

function terminal() {
  const input = new EventEmitter();
  input.isTTY = true;
  input.isRaw = false;
  input.setEncoding = () => {};
  input.setRawMode = flag => { input.isRaw = flag; };
  input.resume = () => {};
  input.pause = () => {};
  let written = '';
  const output = { isTTY: true, write: chunk => { written += String(chunk); } };
  return { input, output, printed: () => written };
}
test('hidden-password reader does not echo any typed or pasted characters', async () => {
  const t = terminal();
  const p = readHiddenPassword('Secret: ', t);
  t.input.emit('data', 'HighEntropyPassword!');
  t.input.emit('data', '\r');
  assert.equal(await p, 'HighEntropyPassword!');
  assert.equal(t.printed(), 'Secret: \n');
  assert.equal(t.input.isRaw, false);
});
test('masked backspace is supported without revealing characters', async () => {
  const t = terminal();
  const p = readHiddenPassword('Password: ', t);
  t.input.emit('data', 'abcd\u007fxy\n');
  assert.equal(await p, 'abcxy');
  assert.equal(t.printed(), 'Password: \n');
});
test('Ctrl+C cancels and always restores raw terminal state', async () => {
  const t = terminal();
  const p = readHiddenPassword('Secret: ', t);
  t.input.emit('data', '\u0003');
  await assert.rejects(p, /Cancelled/);
  assert.equal(t.input.isRaw, false);
  assert.equal(t.printed(), 'Secret: \n');
});
test('non-terminal input fails closed', () => {
  const t = terminal();
  t.input.isTTY = false;
  assert.throws(() => readHiddenPassword('Secret: ', t), /real interactive TTY/);
});
