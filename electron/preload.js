const { ipcRenderer } = require('electron');

function API() {
  return document.getElementById('server').value.replace(/\/$/, '') + '/api';
}

const form = document.getElementById('form');
const savedServer = localStorage.getItem('safegram_server');
const savedToken = localStorage.getItem('safegram_token');
if (savedServer) document.getElementById('server').value = savedServer;
document.getElementById('tabLogin').onclick = () => showLogin();
document.getElementById('tabReg').onclick = () => showReg();
showLogin();

// Автовход, если уже есть токен
if (savedServer && savedToken) {
  ipcRenderer.send('auth-success', { token: savedToken, serverUrl: savedServer });
}

function showLogin() {
  form.innerHTML = `
    <input id="user" placeholder="Логин" class="mt">
    <input id="pass" type="password" placeholder="Пароль" class="mt">
    <button id="do" class="mt">Войти</button>
    <div id="err" class="mt bad"></div>`;
  document.getElementById('do').onclick = async () => {
    const serverUrl = document.getElementById('server').value || '';
    const body = { username: document.getElementById('user').value, password: document.getElementById('pass').value };
    try {
      const res = await fetch(API() + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
      if (res.error) { document.getElementById('err').textContent = res.error || 'Ошибка входа'; return; }
      localStorage.setItem('safegram_server', serverUrl);
      localStorage.setItem('safegram_token', res.token);
      ipcRenderer.send('auth-success', { token: res.token, serverUrl });
    } catch (e) { document.getElementById('err').textContent = e.message || 'network error'; }
  };
}

function showReg() {
  form.innerHTML = `
    <input id="user" placeholder="Логин" class="mt">
    <input id="pass" type="password" placeholder="Пароль" class="mt">
    <button id="do" class="mt">Зарегистрироваться</button>
    <div id="err" class="mt bad"></div>`;
  document.getElementById('do').onclick = async () => {
    const serverUrl = document.getElementById('server').value || '';
    const body = { username: document.getElementById('user').value, password: document.getElementById('pass').value };
    try {
      const res = await fetch(API() + '/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
      if (res.error) { document.getElementById('err').textContent = res.error || 'Ошибка регистрации'; return; }
      localStorage.setItem('safegram_server', serverUrl);
      localStorage.setItem('safegram_token', res.token);
      ipcRenderer.send('auth-success', { token: res.token, serverUrl });
    } catch (e) { document.getElementById('err').textContent = e.message || 'network error'; }
  };
}
