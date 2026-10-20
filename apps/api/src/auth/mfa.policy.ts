import { UserRole } from '@prisma/client';

/** Existing elevated roles that perform platform, organization, operational or finance mutations. */
export const PRIVILEGED_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORGANIZATION_ADMIN,
  UserRole.OPERATIONS_MANAGER,
  UserRole.FINANCE_MANAGER,
];

export function hasPrivilegedRole(roles: readonly (UserRole | string)[]): boolean {
  return roles.some((role) => PRIVILEGED_ROLES.includes(role as UserRole));
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export const MFA_STEP_UP_TTL_SECONDS = integerEnv('MFA_STEP_UP_TTL_SECONDS', 600, 60, 3600);
export const MFA_CHALLENGE_TTL_SECONDS = integerEnv('MFA_CHALLENGE_TTL_SECONDS', 300, 30, 900);
export const MFA_CHALLENGE_MAX_ATTEMPTS = integerEnv('MFA_CHALLENGE_MAX_ATTEMPTS', 5, 1, 10);
export const MFA_ENROLLMENT_TTL_SECONDS = integerEnv('MFA_ENROLLMENT_TTL_SECONDS', 900, 60, 3600);
export const MFA_TOTP_STEP_SECONDS = integerEnv('MFA_TOTP_STEP_SECONDS', 30, 15, 120);
export const MFA_TOTP_WINDOW_STEPS = integerEnv('MFA_TOTP_WINDOW_STEPS', 1, 0, 2);
export const MFA_RECOVERY_CODE_COUNT = integerEnv('MFA_RECOVERY_CODE_COUNT', 10, 5, 20);
