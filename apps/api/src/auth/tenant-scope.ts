/**
 * Fail-closed helpers for organization-scoped service methods.
 *
 * These helpers do not apply authorization automatically. Call them at service
 * boundaries before constructing Prisma where clauses or accepting resource IDs.
 */
export interface OrganizationScopedUser {
  sub: string;
  organizationId: string | null;
  roles: string[];
}

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantScopeError';
  }
}

/** Require an authenticated organization context; never infer a tenant from input. */
export function requireOrganizationId(user: OrganizationScopedUser | null | undefined): string {
  const organizationId = user?.organizationId?.trim();
  if (!organizationId) {
    throw new TenantScopeError('An organization context is required for this operation.');
  }
  return organizationId;
}

/** Build a mandatory tenant predicate to merge into Prisma where clauses. */
export function organizationWhere<T extends Record<string, unknown>>(
  user: OrganizationScopedUser | null | undefined,
  where: T,
): T & { organizationId: string } {
  const organizationId = requireOrganizationId(user);
  if (Object.prototype.hasOwnProperty.call(where, 'organizationId')
      && where.organizationId !== organizationId) {
    throw new TenantScopeError('The requested organization does not match the authenticated tenant.');
  }
  return { ...where, organizationId };
}

/** Verify an already-loaded row belongs to the authenticated tenant. */
export function assertSameOrganization(
  user: OrganizationScopedUser | null | undefined,
  resource: { organizationId?: string | null } | null | undefined,
): void {
  const organizationId = requireOrganizationId(user);
  if (!resource?.organizationId || resource.organizationId !== organizationId) {
    // Deliberately avoid revealing whether another tenant's resource exists.
    throw new TenantScopeError('Resource not found.');
  }
}
