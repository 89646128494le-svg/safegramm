
import React from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import { Link } from 'react-router-dom';

export default function Header({ user, onLogout }: any) {
  return (
    <div className="header">
      <div className="flex items-center gap-md">
        <div className="title">SafeGram</div>
        <span className="badge">BETA</span>
      </div>
      <div className="flex items-center gap-md">
        <ThemeSwitcher />
        {user ? (
          <>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {user.username}
            </div>
            {(() => {
              // Явная обработка ролей - сервер всегда отправляет массив
              let roles: string[] = [];
              if (Array.isArray(user.roles)) {
                roles = user.roles;
              } else if (user.roles) {
                roles = String(user.roles).split(',').map((r: string) => r.trim()).filter((r: string) => r);
              }
              const hasAccess = roles.includes('admin') || roles.includes('owner');
              return hasAccess && (
                <Link 
                  to="/app/admin" 
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  ⚙️ Панель управления
                </Link>
              );
            })()}
            <button onClick={onLogout} className="btn btn-ghost">Выйти</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost">Войти</Link>
            <Link to="/register" className="btn btn-primary">Регистрация</Link>
          </>
        )}
      </div>
    </div>
  );
}
