export const ROLE_LEVEL = {
  user: 0,
  support_l1: 1,
  support_lead: 2,
  moderator: 3,
  risk_analyst: 4,
  safety: 5,
  billing_manager: 6,
  release_manager: 7,
  sysadmin: 8,
  owner: 9,
} as const;

export const ROLE_ALIAS: Record<string, keyof typeof ROLE_LEVEL> = {
  admin: 'sysadmin',
  guardian: 'safety',
  support: 'support_lead',
};

export type RoleName = keyof typeof ROLE_LEVEL;
export type StaffRoleName = Exclude<RoleName, 'user'>;
export type StaffSectionId =
  | 'support'
  | 'moderation'
  | 'risk'
  | 'safety'
  | 'billing'
  | 'release'
  | 'sysadmin'
  | 'owner';

export interface UserLike {
  username?: string;
  roles?: string[] | string;
}

export interface StaffSection {
  id: StaffSectionId;
  label: string;
  minRole: StaffRoleName;
}

const SECTION_ROLE_ORDER: StaffSection[] = [
  { id: 'support', label: 'Support', minRole: 'support_l1' },
  { id: 'moderation', label: 'Moderation', minRole: 'moderator' },
  { id: 'risk', label: 'Risk', minRole: 'risk_analyst' },
  { id: 'safety', label: 'Safety', minRole: 'safety' },
  { id: 'billing', label: 'Billing', minRole: 'billing_manager' },
  { id: 'release', label: 'Release', minRole: 'release_manager' },
  { id: 'sysadmin', label: 'Sysadmin', minRole: 'sysadmin' },
  { id: 'owner', label: 'Owner', minRole: 'owner' },
];

const ROLE_LABELS: Record<RoleName, string> = {
  user: 'User',
  support_l1: 'Support L1',
  support_lead: 'Support Lead',
  moderator: 'Moderator',
  risk_analyst: 'Risk Analyst',
  safety: 'Safety',
  billing_manager: 'Billing Manager',
  release_manager: 'Release Manager',
  sysadmin: 'System Admin',
  owner: 'Owner',
};

export function normalizeRole(role: string): RoleName | null {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return null;
  const aliased = ROLE_ALIAS[normalized] || normalized;
  if (aliased in ROLE_LEVEL) return aliased as RoleName;
  return null;
}

export function normalizeRoles(roles?: string[] | string): RoleName[] {
  if (!roles) return [];
  const source = Array.isArray(roles)
    ? roles
    : String(roles)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
  const unique = new Set<RoleName>();
  source.forEach((role) => {
    const normalized = normalizeRole(role);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique).sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a]);
}

export function getPrimaryRole(user?: UserLike | null): RoleName {
  return normalizeRoles(user?.roles)[0] || 'user';
}

export function getRoleLabel(user?: UserLike | null): string {
  return ROLE_LABELS[getPrimaryRole(user)];
}

export function hasStaffAccess(user?: UserLike | null): boolean {
  return ROLE_LEVEL[getPrimaryRole(user)] > ROLE_LEVEL.user;
}

export function hasRoleAtLeast(user: UserLike | null | undefined, role: StaffRoleName): boolean {
  return ROLE_LEVEL[getPrimaryRole(user)] >= ROLE_LEVEL[role];
}

export function getAvailableStaffSections(user?: UserLike | null): StaffSection[] {
  return SECTION_ROLE_ORDER.filter((section) => hasRoleAtLeast(user, section.minRole));
}

export function getDefaultStaffSection(user?: UserLike | null): StaffSectionId {
  const primary = getPrimaryRole(user);
  if (primary === 'owner') return 'owner';
  if (primary === 'sysadmin') return 'sysadmin';
  if (primary === 'release_manager') return 'release';
  if (primary === 'billing_manager') return 'billing';
  if (primary === 'safety') return 'safety';
  if (primary === 'risk_analyst') return 'risk';
  if (primary === 'moderator') return 'moderation';
  return 'support';
}
