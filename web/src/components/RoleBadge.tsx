import React from 'react';
import { getRoleBadge as getBadge, getNicknameStyle, type UserLike } from '../utils/roles';

const badgeStyle = (color: string, glow: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '18px',
  height: '18px',
  borderRadius: '4px',
  background: `linear-gradient(135deg, ${color}22, ${color}11)`,
  color,
  border: `1px solid ${color}44`,
  boxShadow: `0 0 8px ${glow}`,
  fontSize: '11px',
  lineHeight: 1,
  flexShrink: 0,
});

interface RoleBadgeProps {
  user: UserLike | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

export default function RoleBadge({ user, className = '', size = 'sm' }: RoleBadgeProps) {
  const badge = getBadge(user);
  if (!badge) return null;
  const dim = size === 'md' ? 22 : 18;
  return (
    <span
      className={className}
      title={badge.label}
      style={{
        ...badgeStyle(badge.color, badge.glow || badge.color + '40'),
        width: dim,
        height: dim,
        fontSize: size === 'md' ? 12 : 11,
      }}
    >
      {badge.icon}
    </span>
  );
}

/** Имя пользователя с бейджем и цветом ника (список чатов / сообщения). */
export function UsernameWithRole({
  user,
  username,
  showBadge = true,
  showColor = true,
  className = '',
  style = {},
}: {
  user: UserLike | null | undefined;
  username: string;
  showBadge?: boolean;
  showColor?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const badge = getBadge(user);
  const nicknameStyle = showColor ? getNicknameStyle(user) : null;
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}>
      {showBadge && badge && (
        <span title={badge.label} style={badgeStyle(badge.color, badge.glow || badge.color + '40')}>
          {badge.icon}
        </span>
      )}
      <span style={nicknameStyle || undefined}>{username}</span>
    </span>
  );
}
