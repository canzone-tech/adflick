// One-time ADFLICK-only developer admin bootstrap. No secrets echoed, logged or stored in source.
import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { prepareFirstAdminDatabase } from './prepare-first-admin-db.mjs';
import { createFirstAdmin } from '../prisma/first-admin.mjs';
import { readHiddenPassword } from './read-hidden-password.mjs';
import process from 'node:process';

if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
  throw new Error('First-admin bootstrap needs a developer interactive terminal, never CI or production.');
}
let db, prisma;
try {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let organization, displayName, email;
  try {
    organization = await rl.question('Organization name (local development): ');
    displayName = await rl.question('First administrator display name: ');
    email = await rl.question('Administrator email: ');
  } finally {
    // IMPORTANT: readline itself echoes typed/pasted text. Closing (not pausing)
    // the interface is required before reading a secret with the TTY in raw mode.
    rl.close();
  }
  const password = await readHiddenPassword('Password (12-128 chars, hidden): ');
  const confirmation = await readHiddenPassword('Repeat password (hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match; no user created.');

  db = prepareFirstAdminDatabase();
  // The first admin must only be inserted into a fully migrated, owned development DB.
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
}
