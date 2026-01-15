(function(){const l=document.createElement("link").relList;if(l&&l.supports&&l.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))d(r);new MutationObserver(r=>{for(const c of r)if(c.type==="childList")for(const u of c.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&d(u)}).observe(document,{childList:!0,subtree:!0});function i(r){const c={};return r.integrity&&(c.integrity=r.integrity),r.referrerPolicy&&(c.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?c.credentials="include":r.crossOrigin==="anonymous"?c.credentials="omit":c.credentials="same-origin",c}function d(r){if(r.ep)return;r.ep=!0;const c=i(r);fetch(r.href,c)}})();var k;const I=(((k=window.SAFEGRAM)==null?void 0:k.API_BASE)||"http://localhost:8080").replace(/\/$/,"");var A;const U=(((A=window.SAFEGRAM)==null?void 0:A.SOCKET_BASE)||I).replace(/\/$/,""),m=I+"/api";function a(e,l=document){return l.querySelector(e)}function j(e,l=document){return[...l.querySelectorAll(e)]}function f(e,...l){return e.map((i,d)=>i+(l[d]??"")).join("")}function $(e){return new Date(e).toLocaleString()}function y(){return localStorage.getItem("token")||""}function w(e){localStorage.setItem("token",e)}function v(){return{Authorization:"Bearer "+y(),"Content-Type":"application/json"}}async function T(){try{if(!("serviceWorker"in navigator)||!("PushManager"in window)||await Notification.requestPermission()!=="granted")return;const l=await navigator.serviceWorker.ready,i=await fetch(m+"/push/public_key").then(c=>c.json()),d=B(i.publicKey),r=await l.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:d});await fetch(m+"/push/subscribe",{method:"POST",headers:v(),body:JSON.stringify(r)}),alert("Push включён")}catch(e){console.warn("push sub failed",e)}}function B(e){const l="=".repeat((4-e.length%4)%4),i=(e+l).replace(/-/g,"+").replace(/_/g,"/"),d=atob(i),r=new Uint8Array(d.length);for(let c=0;c<d.length;c++)r[c]=d.charCodeAt(c);return r}function L(){var d,r;document.body.innerHTML=f`<div class="auth"><div class="pane card">
    <div class="brand">SafeGram <small>Voice</small></div>
    <div class="row">
      <button id="btnLogin" class="grow">Войти</button>
      <button id="btnRegister" class="ghost">Регистрация</button>
    </div>
    <div id="form"></div>
  </div></div>`;const e=a("#form"),l=()=>e.innerHTML=f`
    <div style="margin-top:16px; display:grid; gap:10px">
      <input id="loginUser" placeholder="Имя пользователя" />
      <input id="loginPass" type="password" placeholder="Пароль" />
      <button id="doLogin">Войти</button>
      <small>admin / admin123 (для первого входа)</small>
      <div id="authError" class="bad"></div>
    </div>`,i=()=>e.innerHTML=f`
    <div style="margin-top:16px; display:grid; gap:10px">
      <input id="regUser" placeholder="Ник" />
      <input id="regPass" type="password" placeholder="Пароль" />
      <button id="doReg">Создать аккаунт</button>
      <div id="authError" class="bad"></div>
    </div>`;a("#btnLogin").onclick=l,a("#btnRegister").onclick=i,l(),(d=a("#doLogin"))==null||d.addEventListener("click",async()=>{const c={username:a("#loginUser").value,password:a("#loginPass").value},u=await fetch(m+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c)}).then(s=>s.json());if(u.error){a("#authError").textContent=JSON.stringify(u);return}w(u.token),C()}),(r=a("#doReg"))==null||r.addEventListener("click",async()=>{const c={username:a("#regUser").value,password:a("#regPass").value},u=await fetch(m+"/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(c)}).then(s=>s.json());if(u.error){a("#authError").textContent=JSON.stringify(u);return}w(u.token),C()})}function C(){document.body.innerHTML=f`<div class="app">
    <div class="sidebar">
      <div class="me">
        <img id="meAvatar" class="avatar" />
        <div><div id="meName">—</div><small><span id="onlineCount">0</span> онлайн</small></div>
        <div style="margin-left:auto; display:flex; gap:8px">
          <button id="btnSettings" class="ghost">Настройки</button>
          <button id="btnLogout" class="ghost">Выйти</button>
        </div>
      </div>
      <div class="search">
        <input id="searchUsers" placeholder="Поиск людей…" />
        <div id="searchResults"></div>
      </div>
      <div class="list" id="chatsList"></div>
    </div>
    <div class="main">
      <div class="topbar">
        <div id="chatTitle">Выберите чат</div>
        <div style="display:flex; gap:8px; align-items:center">
          <button id="btnCall" class="ghost" title="Голосовой звонок">📞 Call</button>
          <input id="searchMessages" placeholder="Поиск по сообщениям…" style="min-width:260px"/>
        </div>
      </div>
      <div id="pinnedBar" class="pinned"></div>
      <div class="messages" id="messages"></div>
      <div class="inputbar">
        <input id="msgInput" placeholder="Напишите сообщение…" />
        <div style="display:flex; gap:8px">
          <label class="attach"><input id="fileInput" type="file" style="display:none"/>📎 Прикрепить</label>
          <button id="sendBtn">Отправить</button>
        </div>
      </div>
    </div>
  </div>
  <div class="callbar" id="callBar">
    <div><b>Звонок</b> <span id="callStatus">ожидание…</span></div>
    <div class="row" style="margin-top:8px; gap:8px">
      <button id="btnMute" class="ghost">🔇 Микрофон</button>
      <button id="btnHang" class="ghost">❌ Завершить</button>
    </div>
    <audio id="remoteAudio" autoplay></audio>
  </div>`;const e={me:null,chats:[],currentChat:null,messages:[],typing:new Set};fetch(m+"/users/me",{headers:v()}).then(t=>t.json()).then(t=>{e.me=t,a("#meName").textContent=t.username,a("#meAvatar").src=t.avatarUrl||"https://via.placeholder.com/64x64?text=SG"}).catch(()=>L()),a("#btnLogout").onclick=()=>{localStorage.removeItem("token"),location.hash="",location.reload()};const l=()=>new Promise(t=>{(function n(){window.io?t():setTimeout(n,50)})()});let i=null;l().then(()=>{i=io(U,{transports:["websocket"]}),i.on("connect",()=>i.emit("authenticate",y())),i.on("presence",({online:n})=>a("#onlineCount").textContent=n.length),i.on("message",n=>{e.currentChat&&n.chatId===e.currentChat.id&&(e.messages.push(n),u());const o=e.chats.findIndex(h=>h.id===n.chatId);o>=0&&(e.chats[o].lastMessage=n,r())}),i.on("message_update",n=>{if(!e.currentChat||e.currentChat.id!==n.chatId)return;const o=e.messages.findIndex(h=>h.id===n.id);o>=0&&(e.messages[o]=n,u())}),i.on("typing",({userId:n,isTyping:o})=>{e.currentChat&&(o?e.typing.add(n):e.typing.delete(n))}),i.on("webrtc:offer",async({chatId:n,from:o,sdp:h})=>{if(!e.currentChat||e.currentChat.id!==n)return;await x(),await s.setRemoteDescription(new RTCSessionDescription(h));const g=await s.createAnswer();await s.setLocalDescription(g),i.emit("webrtc:answer",{chatId:n,sdp:s.localDescription}),b("В звонке")}),i.on("webrtc:answer",async({chatId:n,sdp:o})=>{!e.currentChat||e.currentChat.id!==n||(await s.setRemoteDescription(new RTCSessionDescription(o)),b("В звонке"))}),i.on("webrtc:ice",async({chatId:n,candidate:o})=>{if(!(!e.currentChat||e.currentChat.id!==n))try{await s.addIceCandidate(o)}catch(h){console.warn("ice err",h)}}),i.on("webrtc:hangup",({chatId:n})=>{e.currentChat&&e.currentChat.id===n&&S(!0)}),d();let t=null;a("#msgInput").addEventListener("input",()=>{var n;clearTimeout(t),i.emit("typing",{chatId:(n=e.currentChat)==null?void 0:n.id,isTyping:!0}),t=setTimeout(()=>{var o;return i.emit("typing",{chatId:(o=e.currentChat)==null?void 0:o.id,isTyping:!1})},800)}),a("#sendBtn").onclick=async()=>{if(!e.currentChat)return;const n=a("#msgInput").value.trim();let o=null;const h=a("#fileInput").files[0];if(h){const g=new FormData;g.append("file",h),o=(await fetch(m+`/chats/${e.currentChat.id}/attach`,{method:"POST",headers:{Authorization:"Bearer "+y()},body:g}).then(O=>O.json())).url,a("#fileInput").value=""}!n&&!o||(i.emit("message",{chatId:e.currentChat.id,text:n,attachmentUrl:o}),a("#msgInput").value="")},a("#btnCall").onclick=P,a("#btnMute").onclick=E,a("#btnHang").onclick=()=>S(!1),T()});async function d(){const t=await fetch(m+"/chats",{headers:v()}).then(n=>n.json());e.chats=t.chats||[],r()}function r(){a("#chatsList").innerHTML=e.chats.map(t=>f`
      <div class="chat-item" data-id="${t.id}">
        <div style="font-weight:700">${t.type==="dm"?"Диалог":t.type==="group"?t.name||"Группа":"📣 "+(t.name||"Канал")}</div>
        <small class="muted">${t.lastMessage?t.lastMessage.text||"📎 Вложение":"пусто"}</small>
      </div>`).join(""),j(".chat-item").forEach(t=>t.onclick=()=>c(t.dataset.id))}async function c(t){var o,h;e.currentChat=e.chats.find(g=>g.id===t),a("#chatTitle").textContent=((o=e.currentChat)==null?void 0:o.name)||(((h=e.currentChat)==null?void 0:h.type)==="dm"?"Диалог":"Чат");const n=await fetch(m+`/chats/${t}/messages`,{headers:v()}).then(g=>g.json());e.messages=n.messages||[],u()}function u(){a("#messages").innerHTML=e.messages.map(t=>{var n;return f`
      <div class="msg" id="m_${t.id}">
        <img class="avatar" src="${t.senderId===((n=e.me)==null?void 0:n.id)?e.me.avatarUrl||"https://via.placeholder.com/64x64?text=SG":"https://via.placeholder.com/64x64?text=U"}" />
        <div class="bubble">
          ${t.text?`<div>${t.text}</div>`:""}
          ${t.attachmentUrl?`<div style="margin-top:6px"><a target="_blank" href="${t.attachmentUrl}">📎 Вложение</a></div>`:""}
          <div class="meta">${$(t.createdAt)}</div>
        </div>
      </div>`}).join(""),a("#messages").scrollTop=a("#messages").scrollHeight}let s=null,p=null;async function x(){if(s)return s;if(s=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:global.stun.twilio.com:3478?transport=udp"}]}),s.onicecandidate=t=>{t.candidate&&i.emit("webrtc:ice",{chatId:e.currentChat.id,candidate:t.candidate})},s.ontrack=t=>{const n=a("#remoteAudio");n.srcObject=t.streams[0]},!p)try{p=await navigator.mediaDevices.getUserMedia({audio:!0})}catch(t){throw alert("Нет доступа к микрофону: "+t.message),t}return p.getTracks().forEach(t=>s.addTrack(t,p)),s}async function P(){if(!e.currentChat||e.currentChat.type!=="dm"){alert("Звонки доступны в личных диалогах");return}await x();const t=await s.createOffer();await s.setLocalDescription(t),b("Ожидание ответа…"),i.emit("webrtc:offer",{chatId:e.currentChat.id,sdp:s.localDescription})}function b(t){a("#callStatus").textContent=t,a("#callBar").style.display="block"}function M(){a("#callBar").style.display="none"}function E(){if(!p)return;const t=p.getAudioTracks().every(n=>n.enabled);p.getAudioTracks().forEach(n=>n.enabled=!t),a("#btnMute").textContent=t?"🎙 Включить":"🔇 Микрофон"}function S(t){var n;try{(n=s==null?void 0:s.getSenders())==null||n.forEach(o=>o.track&&o.track.stop())}catch{}try{s==null||s.close()}catch{}s=null,p=null,M(),!t&&e.currentChat&&i.emit("webrtc:hangup",{chatId:e.currentChat.id})}a("#btnSettings").onclick=()=>{const t=document.createElement("div");t.className="card center",t.style.position="fixed",t.style.right="16px",t.style.top="16px",t.style.zIndex="30",t.style.width="320px",t.innerHTML=`<h3>Настройки</h3>
      <div style="display:grid;gap:10px">
        <button id="btnPush" class="ghost">Включить push‑уведомления</button>
        <button id="close" class="ghost">Закрыть</button>
      </div>`,document.body.appendChild(t),a("#btnPush",t).onclick=()=>T(),a("#close",t).onclick=()=>t.remove()}}(function(){const i=new URLSearchParams(location.hash.slice(1)).get("token");i&&(w(i),location.hash=""),y()?C():L()})();
