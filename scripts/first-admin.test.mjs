import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFirstAdmin, createFirstAdmin } from '../prisma/first-admin.mjs';

const valid = { organization: ' ADFLICK Test ', displayName: ' Operator ', email: ' ADMIN@EXAMPLE.COM ',
  password: 'LocalDevLongPassword42!' };
test('first admin validates identity, normalizes email and enforces password length', () => {
  assert.deepEqual(validateFirstAdmin(valid), {
    name: 'ADFLICK Test', display: 'Operator', email: 'admin@example.com', password: valid.password
  });
  assert.throws(() => validateFirstAdmin({ ...valid, password: 'short' }), /12-128/);
  assert.throws(() => validateFirstAdmin({ ...valid, email: 'invalid' }), /email/);
  assert.throws(() => validateFirstAdmin({ ...valid, organization: '' }), /Organization/);
});
test('bootstrap writes only org admin with Argon2 and is one-time only', async () => {
  const store = { users: 0, orgs: 0, created: null };
  const prisma = { $transaction: async fn => fn({
    user: {
      count: async () => store.users,
      create: async ({ data }) => {
        assert.equal(data.status, 'ACTIVE');
        assert.equal(data.roleAssignments.create.role, 'ORGANIZATION_ADMIN');
        assert.notEqual(data.passwordHash, valid.password);
        assert.match(data.passwordHash, /^\$argon2id\$/);
        store.users += 1;
        store.created = data;
        return { id: 'user-1', email: data.email };
      }
    },
    organization: {
      count: async () => store.orgs,
      create: async ({ data }) => { store.orgs += 1; return { id: 'org-1', ...data }; }
    },
    auditEvent: { create: async ({ data }) => { assert.equal(data.action, 'LOCAL_DEV_FIRST_ADMIN_CREATED'); } }
  }) };
  const result = await createFirstAdmin(prisma, valid);
  assert.equal(result.role, 'ORGANIZATION_ADMIN');
  assert.equal(store.created.organizationId, 'org-1');
  await assert.rejects(() => createFirstAdmin(prisma, valid), /first-run only/);
});

import { prepareFirstAdminDatabase } from '../scripts/prepare-first-admin-db.mjs';
test('CLI and CI bootstrap share migrate-before-user preflight against the owned DB only', () => {
  const calls = [];
  const db = { url: 'mysql://adflick_dev:local@127.0.0.1:45001/adflick_development',
    stop: () => calls.push('stop') };
  const out = prepareFirstAdminDatabase({
    startDatabase: () => { calls.push('start'); return db; },
    migrate: (command, args, opts) => {
      assert.equal(command, 'node_modules/.bin/prisma');
      assert.deepEqual(args, ['migrate', 'deploy']);
      assert.equal(opts.env.DATABASE_URL, db.url);
      assert.equal(opts.shell, false);
      assert.equal(opts.timeout, 120000);
      calls.push('migrate');
      return { status: 0 };
    }, env: { NODE_ENV: 'test' }
  });
  assert.equal(out, db);
  assert.deepEqual(calls, ['start', 'migrate']);
});
test('migration failure prevents bootstrap and stops only the owned test DB', () => {
  const calls = [];
  assert.throws(() => prepareFirstAdminDatabase({
    startDatabase: () => ({ url: 'mysql://local.test', stop: () => calls.push('stop') }),
    migrate: () => { calls.push('fail migrate'); return { status: 1 }; }
  }), /first admin was NOT created/);
  assert.deepEqual(calls, ['fail migrate', 'stop']);
});
