import { assertSameOrganization, organizationWhere, requireOrganizationId, TenantScopeError } from './tenant-scope';

describe('tenant-scope helpers', () => {
  const actor = { sub: 'user-a', organizationId: 'org-a', roles: ['ORGANIZATION_ADMIN'] };

  it('requires authenticated organization context and fails closed for null or blank values', () => {
    expect(requireOrganizationId(actor)).toBe('org-a');
    expect(() => requireOrganizationId({ ...actor, organizationId: null })).toThrow(TenantScopeError);
    expect(() => requireOrganizationId({ ...actor, organizationId: '  ' })).toThrow(TenantScopeError);
  });

  it('overwrites no caller data and always adds the authenticated tenant predicate', () => {
    expect(organizationWhere(actor, { id: 'resource-a' })).toEqual({ id: 'resource-a', organizationId: 'org-a' });
  });

  it('rejects a caller-supplied conflicting tenant predicate (conflicting organization ID)', () => {
    expect(() => organizationWhere(actor, { id: 'resource-b', organizationId: 'org-b' }))
      .toThrow(TenantScopeError);
  });

  it('does not mutate or disclose a cross-tenant resource', () => {
    expect(() => assertSameOrganization(actor, { organizationId: 'org-b' })).toThrow('Resource not found.');
    expect(() => assertSameOrganization(actor, null)).toThrow('Resource not found.');
  });
});
