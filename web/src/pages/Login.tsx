
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import '../styles/globals.css';

export default function Login({ onDone }: any) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  const submit = async (e: any) => {
    e.preventDefault();
    setErr('');
    try {
      const res = await api('/api/auth/login', 'POST', { username, password });
      console.log('Login response:', res);
      if (res && res.token) {
        localStorage.setItem('token', res.token);
        // Обновляем состояние авторизации перед навигацией
        if (onDone) {
          onDone(res.user);
        }
        // Навигация происходит после обновления состояния
        nav('/app');
      } else {
        console.error('No token in response:', res);
        setErr('Токен не получен от сервера');
      }
    } catch (e: any) {
      console.error('Login error:', e);
      setErr(e?.message || 'Ошибка входа');
    }
  };
  
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-lg)'
    }}>
      <div className="modal-content" style={{ maxWidth: '420px', width: '100%' }}>
        <h2 style={{marginBottom: 'var(--spacing-lg)', textAlign: 'center', fontSize: '28px'}}>
          Войти в SafeGram
        </h2>
        <form onSubmit={submit} style={{display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)'}}>
          <input 
            placeholder="Логин" 
            type="text"
            autoComplete="username"
            value={username} 
            onChange={e=>setU(e.target.value)} 
            required
          />
          <input 
            placeholder="Пароль" 
            type="password" 
            autoComplete="current-password"
            value={password} 
            onChange={e=>setP(e.target.value)} 
            required
          />
          <button 
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            Войти
          </button>
          {err && (
            <div className="toast toast-error" style={{ position: 'relative', top: 0, right: 0 }}>
              {err}
            </div>
          )}
        </form>
        <hr style={{margin: 'var(--spacing-lg) 0', borderColor: 'var(--border-color)'}}/>
        <button 
          onClick={()=>nav('/register')}
          className="btn btn-secondary"
          style={{ width: '100%' }}
        >
          Создать аккаунт
        </button>
      </div>
    </div>
  );
}
