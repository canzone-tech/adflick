// One-time local-only Organization Admin. No hardcoded credentials and no production accounts.
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { startPersistentDevMysql } from '../scripts/local-dev-db.mjs';

type AdminInput = { organization: string; displayName: string; email: string; password: string };
export function validateFirstAdmin(input: AdminInput) {
  const name = input.organization.trim(), display = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!name || name.length > 160 || !display || display.length > 160) throw new Error('Organization and name must be 1-160 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('A valid account email is required.');
  if (password.length < 12 || password.length > 128) throw new Error('Password length must be 12-128 characters.');
  if (/^\s+$/.test(password)) throw new Error('Password cannot be whitespace-only.');
  return { name, display, email, password };
}
export async function createFirstAdmin(prisma: PrismaClient, input: AdminInput) {
  const data = validateFirstAdmin(input);
  const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  return prisma.$transaction(async tx => {
    if (await tx.user.count() !== 0 || await tx.organization.count() !== 0) {
      throw new Error('Bootstrap is first-run only: users/organizations already exist. No account was changed.');
    }
    const organization = await tx.organization.create({ data: {
      name: data.name, slug: 'local-dev-' + (await import('node:crypto')).randomBytes(5).toString('hex'), isActive: true
    } });
    const user = await tx.user.create({ data: {
      email: data.email, displayName: data.display, passwordHash, status: 'ACTIVE', organizationId: organization.id,
      roleAssignments: { create: { role: 'ORGANIZATION_ADMIN' } }
    } });
    await tx.auditEvent.create({ data: {
      action: 'LOCAL_DEV_FIRST_ADMIN_CREATED', entityType: 'User', entityId: user.id,
      actorUserId: user.id, organizationId: organization.id
    } });
    return { id: user.id, email: user.email, organization: organization.name, role: 'ORGANIZATION_ADMIN' };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
