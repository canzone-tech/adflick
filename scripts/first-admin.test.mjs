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
