
import React from 'react';
export default function ThemeSwitcher() {
  const setTheme = (t: string) => {
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
    location.reload();
  };
  return (
    <div className="row">
      <select defaultValue={localStorage.getItem('theme') || 'dark'} onChange={(e)=>setTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="hardcore">Red & Black (Hardcore)</option>
      </select>
    </div>
  );
}
