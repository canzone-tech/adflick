import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { startPersistentDevMysql } from './local-dev-db.mjs';
import { createFirstAdmin } from '../prisma/first-admin.ts';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
  throw new Error('First-admin bootstrap needs a developer interactive terminal, never CI or production.');
}
function secret(label) {
  return new Promise((resolve, reject) => {
    let value = '';
    const stdin = process.stdin;
    process.stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    const onData = chunk => {
      for (const ch of String(chunk)) {
        if (ch === '\r' || ch === '\n') {
          stdin.off('data', onData); stdin.setRawMode(false); process.stdout.write('\n');
          resolve(value); return;
        }
        if (ch === '\u0003') {
          stdin.off('data', onData); stdin.setRawMode(false); process.stdout.write('\n');
          reject(new Error('Cancelled by operator.')); return;
        }
        if (ch === '\b' || ch === '\u007f') { value = value.slice(0, -1); continue; }
        if (ch >= ' ' && value.length < 128) value += ch;
      }
    };
    stdin.on('data', onData);
  });
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
let db, prisma;
try {
  const organization = await rl.question('Organization name (local development): ');
  const displayName = await rl.question('First administrator display name: ');
  const email = await rl.question('Administrator email: ');
  rl.pause();
  // readline is paused while password fields are handled with non-echo raw TTY.
  const password = await secret('Password (12-128 chars, hidden): ');
  const confirmation = await secret('Repeat password (hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match; no user created.');
  db = startPersistentDevMysql();
  process.env.DATABASE_URL = db.url;
  prisma = new PrismaClient();
  const created = await createFirstAdmin(prisma, { organization, displayName, email, password });
  console.log('Local-only first administrator created:', created.email, 'role:', created.role);
  console.log('No SUPER_ADMIN or finance role granted. Start local:dev:up and sign in.');
} catch (e) {
  console.error('Bootstrap failed:', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
  db?.stop();
  rl.close();
}
