export const PRODUCT_NAME = 'ADFLICK PLAYOUT CMS';

export const USER_ROLES = [
  'SUPER_ADMIN',
  'ORGANIZATION_ADMIN',
  'ADVERTISER',
  'SCREEN_OWNER',
  'CONTENT_MANAGER',
  'OPERATIONS_MANAGER',
  'FINANCE_MANAGER',
  'SUPPORT_AGENT',
  'AUDITOR_COMPLIANCE',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const SCREEN_STATUSES = [
  'PENDING_PAIRING',
  'ONLINE',
  'OFFLINE',
  'MAINTENANCE',
  'SUSPENDED',
] as const;

export type ScreenStatus = (typeof SCREEN_STATUSES)[number];
