import React from 'react';
import { useTranslation } from '../i18n';
import { Locale } from '../i18n';

export default function LanguageSelector() {
  const { t, locale, changeLocale } = useTranslation();

  const languages: { code: Locale; name: string; flag: string }[] = [
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'en', name: 'English', flag: '🇬🇧' }
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '8px',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <select
        value={locale}
        onChange={(e) => changeLocale(e.target.value as Locale)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          fontSize: '14px',
          cursor: 'pointer',
          outline: 'none',
          padding: '4px 8px'
        }}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
