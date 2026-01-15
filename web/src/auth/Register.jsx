
import React, { useState } from 'react';
import { api } from '../api';

export default function Register({ onSwitch }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/auth/register', 'POST', { username, email, password, age: Number(age) });
      alert('Аккаунт создан! Теперь войди.');
      onSwitch();
    } catch (e) {
      alert('Ошибка регистрации (уникальность/возраст/формат)');
    }
  };

  return (
    <div style={{maxWidth: 420, margin: '10vh auto'}}>
      <h2>Регистрация</h2>
      <form onSubmit={submit} className="row" style={{flexDirection: 'column', gap: 12}}>
        <input placeholder="Логин" value={username} onChange={e=>setUsername(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Пароль" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <input placeholder="Возраст (число, >= 7)" value={age} onChange={e=>setAge(e.target.value)} />
        <button type="submit">Создать</button>
      </form>
      <hr/>
      <button onClick={onSwitch}>У меня уже есть аккаунт</button>
    </div>
  );
}
