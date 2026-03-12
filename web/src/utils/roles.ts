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

export const SYSTEM_OWNER_USERNAME =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SYSTEM_OWNER_USERNAME) ||
  'owner';

export interface UserLike {
  id?: string;
  username?: string;
  roles?: string[] | string;
}

export type AdminSectionId =
  | 'support_l1_role'
  | 'support_lead_role'
  | 'moderator_role'
  | 'risk_role'
  | 'safety_role'
  | 'billing_role'
  | 'release_role'
  | 'sysadmin_role'
  | 'owner_role';

export type AdminTabDefinition = {
  id:
    | 'support_l1_overview'
    | 'support_l1_tickets'
    | 'support_lead_overview'
    | 'support_lead_feedback'
    | 'support_lead_recruit'
    | 'moderator_overview'
    | 'moderator_queue'
    | 'moderator_reports'
    | 'moderator_bans'
    | 'moderator_content'
    | 'risk_overview'
    | 'risk_dashboard'
    | 'safety_overview'
    | 'safety_dashboard'
    | 'safety_policy'
    | 'safety_logs'
    | 'billing_overview'
    | 'billing_apps'
    | 'billing_analytics'
    | 'release_overview'
    | 'release_messages'
    | 'release_maintenance'
    | 'release_communication'
    | 'sysadmin_overview'
    | 'sysadmin_users'
    | 'sysadmin_support_chat'
    | 'sysadmin_services'
    | 'sysadmin_monitor'
    | 'sysadmin_webhook'
    | 'sysadmin_push'
    | 'sysadmin_audit'
    | 'sysadmin_integrations'
    | 'sysadmin_analytics'
    | 'owner_overview'
    | 'sovereign'
    | 'services'
    | 'database';
  label: string;
  section: AdminSectionId;
  allowedRoles: StaffRoleName[];
};

const STAFF_ROLE_ORDER: StaffRoleName[] = [
  'owner',
  'sysadmin',
  'release_manager',
  'billing_manager',
  'safety',
  'risk_analyst',
  'moderator',
  'support_lead',
  'support_l1',
];

const ROLE_DISPLAY: Record<RoleName, string> = {
  user: '',
  support_l1: 'Техподдержка L1',
  support_lead: 'Старшая техподдержка',
  moderator: 'Модератор',
  risk_analyst: 'Риск-аналитик',
  safety: 'Служба безопасности',
  billing_manager: 'Биллинг',
  release_manager: 'Релиз-менеджер',
  sysadmin: 'Тех. админ',
  owner: 'Владелец',
};

const SECTION_ACCESS = {
  supportBase: ['support_l1', 'support_lead', 'sysadmin', 'owner'],
  supportLead: ['support_lead', 'sysadmin', 'owner'],
  moderation: ['moderator', 'safety', 'sysadmin', 'owner'],
  risk: ['risk_analyst', 'safety', 'sysadmin', 'owner'],
  safety: ['safety', 'sysadmin', 'owner'],
  billing: ['billing_manager', 'sysadmin', 'owner'],
  release: ['release_manager', 'sysadmin', 'owner'],
  sysadmin: ['sysadmin', 'owner'],
  owner: ['owner'],
} as const satisfies Record<string, StaffRoleName[]>;

function normalizeRole(role: string): RoleName | null {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return null;
  const aliased = ROLE_ALIAS[normalized] || normalized;
  if (aliased in ROLE_LEVEL) return aliased as RoleName;
  return null;
}

function normalizeRoles(roles: string[] | string | undefined): RoleName[] {
  if (!roles) return [];
  const raw = Array.isArray(roles)
    ? roles
    : String(roles)
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

  const unique = new Set<RoleName>();
  raw.forEach((role) => {
    const normalized = normalizeRole(role);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique).sort((a, b) => ROLE_LEVEL[b] - ROLE_LEVEL[a]);
}

export function getPrimaryRoleName(user: UserLike | null | undefined): RoleName {
  const roles = normalizeRoles(user?.roles);
  return roles[0] || 'user';
}

export function getRoleLevel(user: UserLike | null | undefined): number {
  return ROLE_LEVEL[getPrimaryRoleName(user)];
}

export function getRoleLabel(user: UserLike | null | undefined): string {
  return ROLE_DISPLAY[getPrimaryRoleName(user)];
}

export function isSystemOwner(user: UserLike | null | undefined): boolean {
  if (!user?.username) return false;
  return user.username.trim().toLowerCase() === SYSTEM_OWNER_USERNAME.trim().toLowerCase() && getPrimaryRoleName(user) === 'owner';
}

export function isOwner(user: UserLike | null | undefined): boolean {
  return getPrimaryRoleName(user) === 'owner';
}

export function isSysadmin(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.sysadmin;
}

export function isSafety(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.safety;
}

export function isModerator(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.moderator;
}

export function isSupport(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.support_l1;
}

export function hasAdminAccess(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) > ROLE_LEVEL.user;
}

export function isAdmin(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.sysadmin;
}

export function canBlockUser(actor: UserLike | null, target: UserLike | null): boolean {
  if (isSystemOwner(target) || getPrimaryRoleName(target) === 'owner') return false;
  return getRoleLevel(actor) > getRoleLevel(target) && hasAdminAccess(actor);
}

export function canPromoteTo(actor: UserLike | null, targetRole: RoleName | string): boolean {
  const normalized = normalizeRole(targetRole) || 'user';
  const actorLevel = getRoleLevel(actor);
  if (normalized === 'owner') return actorLevel >= ROLE_LEVEL.owner;
  if (normalized === 'sysadmin') return actorLevel >= ROLE_LEVEL.owner;
  if (normalized === 'release_manager' || normalized === 'billing_manager' || normalized === 'safety') {
    return actorLevel >= ROLE_LEVEL.sysadmin;
  }
  if (normalized === 'risk_analyst' || normalized === 'moderator') {
    return actorLevel >= ROLE_LEVEL.safety;
  }
  if (normalized === 'support_lead') {
    return actorLevel >= ROLE_LEVEL.moderator;
  }
  if (normalized === 'support_l1') {
    return actorLevel >= ROLE_LEVEL.support_lead;
  }
  return actorLevel >= ROLE_LEVEL.support_lead;
}

export function canDemoteUser(actor: UserLike | null, target: UserLike | null): boolean {
  if (isSystemOwner(target) || getPrimaryRoleName(target) === 'owner') return false;
  return getRoleLevel(actor) > getRoleLevel(target);
}

export function canDeleteUser(actor: UserLike | null, target: UserLike | null): boolean {
  if (isSystemOwner(target) || getPrimaryRoleName(target) === 'owner') return false;
  return getRoleLevel(actor) >= ROLE_LEVEL.owner && getRoleLevel(actor) > getRoleLevel(target);
}

export const ADMIN_SECTIONS = [
  { id: 'support_l1_role', label: 'Техподдержка L1', order: 1 },
  { id: 'support_lead_role', label: 'Старшая техподдержка', order: 2 },
  { id: 'moderator_role', label: 'Модерация', order: 3 },
  { id: 'risk_role', label: 'Риск и антиабуз', order: 4 },
  { id: 'safety_role', label: 'Безопасность', order: 5 },
  { id: 'billing_role', label: 'Биллинг', order: 6 },
  { id: 'release_role', label: 'Релизы и коммуникации', order: 7 },
  { id: 'sysadmin_role', label: 'Тех. администрирование', order: 8 },
  { id: 'owner_role', label: 'Владелец', order: 9 },
] as const satisfies ReadonlyArray<{ id: AdminSectionId; label: string; order: number }>;

export const ADMIN_TABS = [
  { id: 'support_l1_overview', label: 'Обзор роли', section: 'support_l1_role', allowedRoles: SECTION_ACCESS.supportBase },
  { id: 'support_l1_tickets', label: 'Тикеты', section: 'support_l1_role', allowedRoles: SECTION_ACCESS.supportBase },

  { id: 'support_lead_overview', label: 'Обзор роли', section: 'support_lead_role', allowedRoles: SECTION_ACCESS.supportLead },
  { id: 'support_lead_feedback', label: 'Фидбек', section: 'support_lead_role', allowedRoles: SECTION_ACCESS.supportLead },
  { id: 'support_lead_recruit', label: 'Набор тестеров', section: 'support_lead_role', allowedRoles: SECTION_ACCESS.supportLead },

  { id: 'moderator_overview', label: 'Обзор роли', section: 'moderator_role', allowedRoles: SECTION_ACCESS.moderation },
  { id: 'moderator_queue', label: 'Модоочередь', section: 'moderator_role', allowedRoles: SECTION_ACCESS.moderation },
  { id: 'moderator_reports', label: 'Жалобы', section: 'moderator_role', allowedRoles: SECTION_ACCESS.moderation },
  { id: 'moderator_bans', label: 'Баны и муты', section: 'moderator_role', allowedRoles: SECTION_ACCESS.moderation },
  { id: 'moderator_content', label: 'Контент', section: 'moderator_role', allowedRoles: SECTION_ACCESS.moderation },

  { id: 'risk_overview', label: 'Обзор роли', section: 'risk_role', allowedRoles: SECTION_ACCESS.risk },
  { id: 'risk_dashboard', label: 'Риск-панель', section: 'risk_role', allowedRoles: SECTION_ACCESS.risk },

  { id: 'safety_overview', label: 'Обзор роли', section: 'safety_role', allowedRoles: SECTION_ACCESS.safety },
  { id: 'safety_dashboard', label: 'Security Dashboard', section: 'safety_role', allowedRoles: SECTION_ACCESS.safety },
  { id: 'safety_policy', label: 'Политики', section: 'safety_role', allowedRoles: SECTION_ACCESS.safety },
  { id: 'safety_logs', label: 'Логи', section: 'safety_role', allowedRoles: SECTION_ACCESS.safety },

  { id: 'billing_overview', label: 'Обзор роли', section: 'billing_role', allowedRoles: SECTION_ACCESS.billing },
  { id: 'billing_apps', label: 'Заявки Premium', section: 'billing_role', allowedRoles: SECTION_ACCESS.billing },
  { id: 'billing_analytics', label: 'Премиум-аналитика', section: 'billing_role', allowedRoles: SECTION_ACCESS.billing },

  { id: 'release_overview', label: 'Обзор роли', section: 'release_role', allowedRoles: SECTION_ACCESS.release },
  { id: 'release_messages', label: 'Письма и баннеры', section: 'release_role', allowedRoles: SECTION_ACCESS.release },
  { id: 'release_maintenance', label: 'Техработы', section: 'release_role', allowedRoles: SECTION_ACCESS.release },
  { id: 'release_communication', label: 'Шаблоны и инвайты', section: 'release_role', allowedRoles: SECTION_ACCESS.release },

  { id: 'sysadmin_overview', label: 'Обзор роли', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_users', label: 'Пользователи', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_support_chat', label: 'Чат техподдержки', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_services', label: 'Сервисы', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_monitor', label: 'Мониторинг', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_webhook', label: 'Webhook', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_push', label: 'Уведомления', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_audit', label: 'Аудит-лог', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_integrations', label: 'Интеграции', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },
  { id: 'sysadmin_analytics', label: 'Аналитика', section: 'sysadmin_role', allowedRoles: SECTION_ACCESS.sysadmin },

  { id: 'owner_overview', label: 'Обзор роли', section: 'owner_role', allowedRoles: SECTION_ACCESS.owner },
  { id: 'sovereign', label: 'Sovereign Control', section: 'owner_role', allowedRoles: SECTION_ACCESS.owner },
  { id: 'services', label: 'Критические сервисы', section: 'owner_role', allowedRoles: SECTION_ACCESS.owner },
  { id: 'database', label: 'База данных', section: 'owner_role', allowedRoles: SECTION_ACCESS.owner },
] as const satisfies ReadonlyArray<AdminTabDefinition>;

export function canAccessAdminTab(user: UserLike | null, tabId: AdminTabDefinition['id']): boolean {
  const tab = ADMIN_TABS.find((item) => item.id === tabId);
  if (!tab) return false;
  const roles = normalizeRoles(user?.roles);
  return roles.some((role) => tab.allowedRoles.includes(role as StaffRoleName));
}

export function getDefaultAdminTab(user: UserLike | null | undefined): AdminTabDefinition['id'] | null {
  switch (getPrimaryRoleName(user)) {
    case 'owner':
      return 'owner_overview';
    case 'sysadmin':
      return 'sysadmin_overview';
    case 'release_manager':
      return 'release_overview';
    case 'billing_manager':
      return 'billing_overview';
    case 'safety':
      return 'safety_overview';
    case 'risk_analyst':
      return 'risk_overview';
    case 'moderator':
      return 'moderator_overview';
    case 'support_lead':
      return 'support_lead_overview';
    case 'support_l1':
      return 'support_l1_overview';
    default:
      return null;
  }
}

export type RoleBadge = { icon: string; label: string; color: string; glow?: string };

export function getRoleBadge(user: UserLike | null | undefined): RoleBadge | null {
  switch (getPrimaryRoleName(user)) {
    case 'owner':
      return { icon: '👑', label: 'Владелец', color: '#fbbf24', glow: 'rgba(251,191,36,0.45)' };
    case 'sysadmin':
      return { icon: '⚙️', label: 'Тех. админ', color: '#a78bfa', glow: 'rgba(167,139,250,0.35)' };
    case 'release_manager':
      return { icon: '🚀', label: 'Релиз-менеджер', color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' };
    case 'billing_manager':
      return { icon: '💳', label: 'Биллинг', color: '#34d399', glow: 'rgba(52,211,153,0.35)' };
    case 'safety':
      return { icon: '🧿', label: 'Безопасность', color: '#3b82f6', glow: 'rgba(59,130,246,0.35)' };
    case 'risk_analyst':
      return { icon: '📡', label: 'Риск-аналитик', color: '#38bdf8', glow: 'rgba(56,189,248,0.35)' };
    case 'moderator':
      return { icon: '🛡️', label: 'Модератор', color: '#22c55e', glow: 'rgba(34,197,94,0.35)' };
    case 'support_lead':
      return { icon: '🎧', label: 'Старшая техподдержка', color: '#c084fc', glow: 'rgba(192,132,252,0.35)' };
    case 'support_l1':
      return { icon: '🎫', label: 'Техподдержка L1', color: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' };
    default:
      return null;
  }
}

export function getNicknameStyle(user: UserLike | null | undefined): Record<string, string | number> | null {
  switch (getPrimaryRoleName(user)) {
    case 'owner':
      return {
        background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontWeight: 700,
      };
    case 'sysadmin':
      return { color: '#a78bfa', fontWeight: 600 };
    case 'release_manager':
      return { color: '#60a5fa', fontWeight: 600 };
    case 'billing_manager':
      return { color: '#34d399', fontWeight: 600 };
    case 'safety':
      return { color: '#3b82f6', fontWeight: 600 };
    case 'risk_analyst':
      return { color: '#38bdf8', fontWeight: 600 };
    case 'moderator':
      return { color: '#22c55e', fontWeight: 600 };
    case 'support_lead':
      return { color: '#c084fc', fontWeight: 600 };
    case 'support_l1':
      return { color: '#8b5cf6', fontWeight: 500 };
    default:
      return null;
  }
}

export function getEffectiveRoles(user: UserLike | null | undefined): RoleName[] {
  return normalizeRoles(user?.roles);
}

export function getRoleHierarchy(): RoleName[] {
  return ['owner', 'sysadmin', 'release_manager', 'billing_manager', 'safety', 'risk_analyst', 'moderator', 'support_lead', 'support_l1', 'user'];
}

export function getStaffRoleOptions(): Array<{ value: RoleName; label: string }> {
  return getRoleHierarchy().map((role) => ({ value: role, label: ROLE_DISPLAY[role] || 'Пользователь' }));
}
