
import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ onDone, onSwitch }) {
  const [usernameOrEmail, setU] = useState('');
  const [password, setP] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await api('/api/auth/login', 'POST', { usernameOrEmail, password });
      localStorage.setItem('token', res.token);
      onDone(res.user);
    } catch (e) {
      alert('Ошибка входа');
    }
  };
  return (
    <div style={{maxWidth: 420, margin: '10vh auto'}}>
      <h2>Войти в SafeGram</h2>
      <form onSubmit={submit} className="row" style={{flexDirection: 'column', gap: 12}}>
        <input placeholder="Email или логин" value={usernameOrEmail} onChange={e=>setU(e.target.value)} />
        <input placeholder="Пароль" type="password" value={password} onChange={e=>setP(e.target.value)} />
        <button type="submit">Войти</button>
      </form>
      <hr/>
      <button onClick={onSwitch}>Создать аккаунт</button>
    </div>
  );
}
