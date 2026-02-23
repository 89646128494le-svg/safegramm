/**
 * Иерархия ролей SafeGram (5 уровней + пользователь).
 *
 * 1. Owner & Founder (Владелец) — Master Key, Sovereign Control Panel
 * 2. System Administrator (Тех. Админ / Разработчик) — логи, мониторинг, сервисы
 * 3. Safety Guardian (Служба безопасности) — Security Dashboard, сессии, IP, алерты ИИ
 * 4. Community Moderator (Модератор) — жалобы, баны/муты, модочередь
 * 5. Support Assistant (Техподдержка) — только чтение тикетов и ответы в чате поддержки
 * 0. User — без доступа в админку
 */

export const ROLE_LEVEL = {
  owner: 5,
  sysadmin: 4,
  safety: 3,
  moderator: 2,
  support: 1,
  user: 0,
} as const;

/** Обратная совместимость: admin на бэкенде = sysadmin, guardian = safety */
export const ROLE_ALIAS: Record<string, keyof typeof ROLE_LEVEL> = {
  admin: 'sysadmin',
  guardian: 'safety',
};

export type RoleName = keyof typeof ROLE_LEVEL;

/** Имя встроенного владельца (Lev / owner). */
export const SYSTEM_OWNER_USERNAME =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SYSTEM_OWNER_USERNAME) ||
  'owner';

export interface UserLike {
  id?: string;
  username?: string;
  roles?: string[] | string;
}

function normalizeRoles(roles: string[] | string | undefined): string[] {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
  return String(roles)
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
}

/** Уровень роли пользователя (максимальный из имеющихся). admin → sysadmin. */
export function getRoleLevel(user: UserLike | null | undefined): number {
  if (!user) return ROLE_LEVEL.user;
  const roles = normalizeRoles(user.roles);
  if (roles.includes('owner')) return ROLE_LEVEL.owner;
  if (roles.includes('sysadmin') || roles.includes('admin')) return ROLE_LEVEL.sysadmin;
  if (roles.includes('safety') || roles.includes('guardian')) return ROLE_LEVEL.safety;
  if (roles.includes('moderator')) return ROLE_LEVEL.moderator;
  if (roles.includes('support')) return ROLE_LEVEL.support;
  return ROLE_LEVEL.user;
}

/** Человекочитаемое название роли для UI. */
export function getRoleLabel(user: UserLike | null | undefined): string {
  const level = getRoleLevel(user);
  if (level >= ROLE_LEVEL.owner) return 'Владелец';
  if (level >= ROLE_LEVEL.sysadmin) return 'Тех. Админ';
  if (level >= ROLE_LEVEL.safety) return 'Служба безопасности';
  if (level >= ROLE_LEVEL.moderator) return 'Модератор';
  if (level >= ROLE_LEVEL.support) return 'Техподдержка';
  return '';
}

export function isSystemOwner(user: UserLike | null | undefined): boolean {
  if (!user?.username) return false;
  const u = user.username.trim().toLowerCase();
  const sys = SYSTEM_OWNER_USERNAME.trim().toLowerCase();
  if (u !== sys) return false;
  const roles = normalizeRoles(user.roles);
  return roles.includes('owner');
}

export function isOwner(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.owner;
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
  return getRoleLevel(user) >= ROLE_LEVEL.support;
}

/** Доступ в админку (любая роль от support и выше). */
export function hasAdminAccess(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.support;
}

/** Обратная совместимость: "админ или выше" для ссылки на админку. */
export function isAdmin(user: UserLike | null | undefined): boolean {
  return getRoleLevel(user) >= ROLE_LEVEL.sysadmin;
}

export function canBlockUser(actor: UserLike | null, target: UserLike | null): boolean {
  if (isSystemOwner(target)) return false;
  const actorLevel = getRoleLevel(actor);
  const targetLevel = getRoleLevel(target);
  return actorLevel > targetLevel;
}

export function canPromoteTo(actor: UserLike | null, targetRole: RoleName): boolean {
  const actorLevel = getRoleLevel(actor);
  const targetLevel = ROLE_LEVEL[targetRole];
  if (targetLevel >= ROLE_LEVEL.owner) return actorLevel >= ROLE_LEVEL.owner;
  if (targetLevel >= ROLE_LEVEL.sysadmin) return actorLevel >= ROLE_LEVEL.owner;
  if (targetLevel >= ROLE_LEVEL.safety) return actorLevel >= ROLE_LEVEL.sysadmin;
  if (targetLevel >= ROLE_LEVEL.moderator) return actorLevel >= ROLE_LEVEL.safety;
  if (targetLevel >= ROLE_LEVEL.support) return actorLevel >= ROLE_LEVEL.moderator;
  return actorLevel >= ROLE_LEVEL.support;
}

export function canDemoteUser(actor: UserLike | null, target: UserLike | null): boolean {
  if (isSystemOwner(target)) return false;
  const actorLevel = getRoleLevel(actor);
  const targetLevel = getRoleLevel(target);
  return actorLevel > targetLevel;
}

export function canDeleteUser(actor: UserLike | null, target: UserLike | null): boolean {
  if (isSystemOwner(target)) return false;
  return getRoleLevel(actor) >= ROLE_LEVEL.owner && getRoleLevel(actor) > getRoleLevel(target);
}

/** Вкладки админки и минимальная роль для доступа. */
export const ADMIN_TABS = [
  { id: 'sovereign' as const, label: '👑 Sovereign Control Panel', minRole: 'support' as const },
  { id: 'users' as const, label: '👥 Пользователи', minRole: 'sysadmin' as const },
  { id: 'analytics' as const, label: '📊 Аналитика', minRole: 'sysadmin' as const },
  { id: 'bans' as const, label: '🚫 Баны и муты', minRole: 'moderator' as const },
  { id: 'maintenance' as const, label: '🔧 Техработы', minRole: 'sysadmin' as const },
  { id: 'broadcast' as const, label: '📢 Рассылка', minRole: 'sysadmin' as const },
  { id: 'messages' as const, label: '✉️ Письма и тех. работы', minRole: 'sysadmin' as const },
  { id: 'logs' as const, label: '📋 Логи сервера', minRole: 'safety' as const },
  { id: 'monitor' as const, label: '📡 Мониторинг и нагрузка', minRole: 'sysadmin' as const },
  { id: 'security' as const, label: '🛡️ Security Dashboard', minRole: 'safety' as const },
  { id: 'mod' as const, label: '✅ Модочередь', minRole: 'moderator' as const },
  { id: 'reports' as const, label: '⚠️ Жалобы', minRole: 'moderator' as const },
  { id: 'feedback' as const, label: '💬 Фидбек', minRole: 'support' as const },
  { id: 'recruit' as const, label: '🧑‍💻 Набор (тестеры/хелперы)', minRole: 'support' as const },
  { id: 'premium_apps' as const, label: '⭐ Заявки на Premium', minRole: 'moderator' as const },
  { id: 'push' as const, label: '🔔 Уведомления', minRole: 'sysadmin' as const },
  { id: 'services' as const, label: '⚙️ Сервисы (супер-панель)', minRole: 'owner' as const },
  { id: 'database' as const, label: '📦 База данных (онлайн)', minRole: 'owner' as const },
  { id: 'webhook' as const, label: '🔗 Webhook', minRole: 'sysadmin' as const },
  { id: 'support' as const, label: '🎫 Поддержка (тикеты)', minRole: 'support' as const },
  { id: 'audit' as const, label: '📜 Аудит-лог', minRole: 'sysadmin' as const },
  { id: 'content_moderation' as const, label: '🔍 Контент и модерация', minRole: 'moderator' as const },
  { id: 'security_policy' as const, label: '🔐 Безопасность и политики', minRole: 'safety' as const },
  { id: 'communication' as const, label: '📧 Шаблоны и инвайты', minRole: 'sysadmin' as const },
  { id: 'system_integrations' as const, label: '🤖 Система и интеграции', minRole: 'sysadmin' as const },
  { id: 'analytics_reports' as const, label: '📈 Аналитика и отчёты', minRole: 'sysadmin' as const },
] as const;

export function canAccessAdminTab(
  user: UserLike | null,
  tabId: (typeof ADMIN_TABS)[number]['id']
): boolean {
  const level = getRoleLevel(user);
  const tab = ADMIN_TABS.find((t) => t.id === tabId);
  if (!tab) return false;
  const required = ROLE_LEVEL[tab.minRole];
  return level >= required;
}

/** Бейдж для списка чатов и сообщений: иконка + стиль (Telegram-like, неоновое свечение SafeGram). */
export type RoleBadge = { icon: string; label: string; color: string; glow?: string };

export function getRoleBadge(user: UserLike | null | undefined): RoleBadge | null {
  if (!user) return null;
  const roles = normalizeRoles(user.roles);
  if (roles.includes('owner')) return { icon: '👑', label: 'Владелец', color: '#fbbf24', glow: 'rgba(251,191,36,0.5)' };
  if (roles.includes('sysadmin') || roles.includes('admin')) return { icon: '🛡️', label: 'Админ', color: '#ef4444', glow: 'rgba(239,68,68,0.4)' };
  if (roles.includes('safety') || roles.includes('guardian')) return { icon: '🧿', label: 'Безопасность', color: '#3b82f6', glow: 'rgba(59,130,246,0.4)' };
  if (roles.includes('moderator')) return { icon: '🛡️', label: 'Модератор', color: '#22c55e', glow: 'rgba(34,197,94,0.35)' };
  if (roles.includes('support')) return { icon: '🎫', label: 'Поддержка', color: '#8b5cf6', glow: 'rgba(139,92,246,0.3)' };
  return null;
}

/** Стиль ника для админ-ролей: владелец — золотой градиент, админы — красный, модераторы — зелёный. */
export function getNicknameStyle(user: UserLike | null | undefined): Record<string, string | number> | null {
  if (!user) return null;
  const roles = normalizeRoles(user.roles);
  if (roles.includes('owner')) {
    return {
      background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      fontWeight: 600,
    };
  }
  if (roles.includes('sysadmin') || roles.includes('admin')) {
    return { color: '#ef4444', fontWeight: 600 };
  }
  if (roles.includes('moderator')) {
    return { color: '#22c55e', fontWeight: 600 };
  }
  if (roles.includes('safety') || roles.includes('guardian')) {
    return { color: '#3b82f6', fontWeight: 500 };
  }
  if (roles.includes('support')) {
    return { color: '#8b5cf6', fontWeight: 500 };
  }
  return null;
}
