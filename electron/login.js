const { ipcRenderer } = require('electron');

function getServer(){ return document.getElementById('server').value.replace(/\/$/,''); }
function getWeb(){ return document.getElementById('web').value.replace(/\/$/,''); }
function API(){ return getServer() + '/api'; }

const form = document.getElementById('form');
document.getElementById('tabLogin').onclick = () => showLogin();
document.getElementById('tabReg').onclick = () => showReg();
showLogin();

function showLogin(){
  form.innerHTML = `
    <input id="user" placeholder="Имя пользователя" class="mt">
    <input id="pass" type="password" placeholder="Пароль" class="mt">
    <button id="do" class="mt">Войти</button>
    <div id="err" class="mt bad"></div>
  `;
  document.getElementById('do').onclick = async () => {
    const body = { username: document.getElementById('user').value, password: document.getElementById('pass').value };
    try {
      const res = await fetch(API() + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r=>r.json());
      if (res.error) { document.getElementById('err').textContent = JSON.stringify(res); return; }
      ipcRenderer.send('auth-success', { token: res.token, serverUrl: getServer(), webUrl: getWeb() });
    } catch (e) { document.getElementById('err').textContent = e.message; }
  };
}
function showReg(){
  form.innerHTML = `
    <input id="user" placeholder="Ник" class="mt">
    <input id="pass" type="password" placeholder="Пароль" class="mt">
    <button id="do" class="mt">Создать аккаунт</button>
    <div id="err" class="mt bad"></div>
  `;
  document.getElementById('do').onclick = async () => {
    const body = { username: document.getElementById('user').value, password: document.getElementById('pass').value };
    try {
      const res = await fetch(API() + '/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r=>r.json());
      if (res.error) { document.getElementById('err').textContent = JSON.stringify(res); return; }
      ipcRenderer.send('auth-success', { token: res.token, serverUrl: getServer(), webUrl: getWeb() });
    } catch (e) { document.getElementById('err').textContent = e.message; }
  };
}
