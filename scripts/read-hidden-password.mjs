// Terminal-only hidden-password reader. Never use readline alongside raw input:
// readline echoes pasted characters even when the input stream is marked raw.
import process from 'node:process';

export function readHiddenPassword(label, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Password input requires a real interactive TTY.');
  }
  return new Promise((resolve, reject) => {
    let value = '';
    let finished = false;
    const wasRaw = Boolean(input.isRaw);
    const end = (error) => {
      if (finished) return;
      finished = true;
      input.off('data', onData);
      input.off('error', onError);
      try { input.setRawMode(wasRaw); } catch {}
      input.pause();
      output.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onError = (e) => end(e);
    const onData = (data) => {
      for (const ch of String(data)) {
        if (ch === '\r' || ch === '\n') { end(); return; }
        if (ch === '\u0003' || ch === '\u0004') { end(new Error('Cancelled by operator.')); return; }
        if (ch === '\b' || ch === '\u007f') { value = value.slice(0, -1); continue; }
        if (ch >= ' ' && ch !== '\u007f') {
          if (value.length < 128) value += ch;
          else { end(new Error('Password must contain at most 128 characters.')); return; }
        }
      }
    };
    try {
      input.setEncoding('utf8');
      input.setRawMode(true);
      output.write(label);
      input.on('error', onError);
      input.on('data', onData);
      input.resume();
    } catch (e) {
      end(e);
    }
  });
}
