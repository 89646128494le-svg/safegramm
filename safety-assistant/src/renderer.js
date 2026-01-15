class SafetyAI {
  constructor() {
    this.model = "gpt-4o-mini";
    this.chatUrl = "https://api.openai.com/v1/chat/completions";
    this.ttsUrl = "https://api.openai.com/v1/audio/speech";
    this.conversation = [];
    this.mode = "normal"; // normal | x
    this.busy = false;
    this.voice = window.localStorage.getItem("safety_voice") || "alloy";
  }

  get apiKey() {
    return window.localStorage.getItem("safety_openai_key") || "";
  }
  set apiKey(v) {
    window.localStorage.setItem("safety_openai_key", v || "");
  }
  setVoice(v) {
    this.voice = v || "alloy";
    window.localStorage.setItem("safety_voice", this.voice);
  }
  get enabled() { return !!this.apiKey; }

  setMode(mode) {
    this.mode = mode === "x" ? "x" : "normal";
  }

  getSystemPrompt() {
    if (this.mode === "x") {
      return [
        "You are Safety-X, the high-security AI sentinel of SafeGram.",
        "Tone: strict, concise, confident; focus on security, risks, mitigation, robustness.",
        "Answer in Russian by default unless user asks otherwise.",
        "Never assist illegal/unsafe actions; explain risks."
      ].join(" ");
    }
    return [
        "You are Safety, a friendly personal AI assistant inside SafeGram.",
        "Tone: warm, supportive, clear; concise answers in Russian unless asked otherwise.",
        "Help with coding, productivity, safe ways to earn, daily questions.",
        "Never assist illegal/unsafe actions; explain why it is unsafe."
    ].join(" ");
  }

  async chat(userText) {
    if (!this.enabled) throw new Error("Укажите OpenAI API key.");
    if (this.busy) throw new Error("Идёт запрос, подождите...");
    this.busy = true;

    const messages = [
      { role: "system", content: this.getSystemPrompt() },
      ...this.conversation,
      { role: "user", content: userText }
    ];

    const body = {
      model: this.model,
      messages,
      temperature: this.mode === "x" ? 0.2 : 0.4,
      max_tokens: 512
    };

    const rsp = await fetch(this.chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!rsp.ok) {
      const t = await rsp.text();
      this.busy = false;
      throw new Error(`OpenAI HTTP ${rsp.status}: ${t}`);
    }

    const data = await rsp.json();
    const choice = data.choices && data.choices[0];
    if (!choice || !choice.message || !choice.message.content) {
      this.busy = false;
      throw new Error("Пустой ответ от модели.");
    }

    const reply = choice.message.content.trim();
    this.conversation.push({ role: "user", content: userText });
    this.conversation.push({ role: "assistant", content: reply });
    this.busy = false;
    return reply;
  }

  async speak(text) {
    if (!this.enabled) throw new Error("Укажите OpenAI API key.");
    const voice = this.voice || (this.mode === "x" ? "onyx" : "alloy");
    const body = { model: "gpt-4o-mini-tts", voice, input: text };

    const rsp = await fetch(this.ttsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!rsp.ok) {
      const t = await rsp.text();
      throw new Error(`TTS HTTP ${rsp.status}: ${t}`);
    }
    const arrayBuffer = await rsp.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  }

  clearHistory() { this.conversation = []; }
}

const safetyAI = new SafetyAI();
const MODES = { NORMAL: "normal", X: "x" };
const STATES = { IDLE: "idle", LISTENING: "listening", SPEAKING: "speaking", TYPING: "typing", SLEEP: "sleep", ALERT: "alert" };
const TRIGGER = "сейфти";
const { shell } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

let currentMode = MODES.NORMAL;
let currentState = STATES.IDLE;

function setStatus(text) {
  const statusLabel = document.getElementById("status-label");
  if (statusLabel) statusLabel.textContent = text;
}

function updateAvatar() {
  const el = document.getElementById("safety-avatar");
  const modeLabel = document.getElementById("mode-label");
  const stateLabel = document.getElementById("state-label");
  if (!el) return;
  el.classList.remove("safety-mode-normal", "safety-mode-x");
  el.classList.add(currentMode === MODES.X ? "safety-mode-x" : "safety-mode-normal");
  Object.values(STATES).forEach(s => el.classList.remove("safety-state-" + s));
  el.classList.add("safety-state-" + currentState);
  if (modeLabel) modeLabel.textContent = currentMode === MODES.X ? "Safety-X" : "Safety";
  if (stateLabel) stateLabel.textContent = currentState;
}

function setMode(mode) { currentMode = mode === MODES.X ? MODES.X : MODES.NORMAL; safetyAI.setMode(currentMode); updateAvatar(); }
function setState(state) { currentState = state; updateAvatar(); }

function appendMessage(author, text) {
  const log = document.getElementById("chat-log");
  if (!log) return;
  const wrapper = document.createElement("div");
  wrapper.classList.add("chat-msg", author === "user" ? "user" : "safety");
  const a = document.createElement("div");
  a.classList.add("chat-msg-author");
  a.textContent = author === "user" ? "Вы" : (currentMode === MODES.X ? "Safety-X" : "Safety");
  const body = document.createElement("div");
  body.classList.add("chat-msg-text");
  body.textContent = text;
  wrapper.appendChild(a);
  wrapper.appendChild(body);
  log.appendChild(wrapper);
  log.scrollTop = log.scrollHeight;
}

function clearLog() { const log = document.getElementById("chat-log"); if (log) log.innerHTML = ""; safetyAI.clearHistory(); }

function setBusyUI(isBusy) {
  const sendBtn = document.getElementById("send-btn");
  const voiceBtn = document.getElementById("voice-btn");
  const listenBtn = document.getElementById("listen-btn");
  if (sendBtn) sendBtn.disabled = isBusy;
  if (voiceBtn) voiceBtn.disabled = isBusy;
  if (listenBtn) listenBtn.disabled = isBusy;
  setStatus(isBusy ? "Запрос к модели..." : "Готов");
}

function runLocalCommand(commandText) {
  const t = commandText.toLowerCase();
  if (t.includes("youtube")) { shell.openExternal("https://www.youtube.com"); return "Открываю YouTube"; }
  if (t.includes("гугл") || t.includes("google")) { shell.openExternal("https://www.google.com"); return "Открываю Google"; }
  if (t.includes("документ") || t.includes("documents") || t.includes("папку")) {
    const docs = path.join(os.homedir(), "Documents");
    shell.openPath(docs);
    return "Открываю папку Документы";
  }
  if (t.includes("замет") || t.includes("note")) {
    const docs = path.join(os.homedir(), "Documents", "SafetyNotes");
    fs.mkdirSync(docs, { recursive: true });
    const file = path.join(docs, `note_${Date.now()}.txt`);
    fs.writeFileSync(file, commandText, { encoding: "utf-8" });
    shell.openPath(file);
    return "Создал заметку в Документах";
  }
  return null;
}

function setupSTT(sendHandler) {
  const listenBtn = document.getElementById("listen-btn");
  if (!listenBtn) return;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    listenBtn.disabled = true;
    listenBtn.textContent = "STT не поддерживается";
    return;
  }
  const rec = new SpeechRec();
  rec.lang = "ru-RU";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  listenBtn.addEventListener("click", () => {
    try {
      setStatus("Слушаю...");
      rec.start();
    } catch (e) {
      console.error(e);
      alert("Не удалось запустить распознавание: " + e.message);
    }
  });

  rec.addEventListener("result", (event) => {
    const text = (event.results[0][0].transcript || "").trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (lower.startsWith(TRIGGER)) {
      const cmd = text.slice(TRIGGER.length).trim();
      const res = runLocalCommand(cmd);
      if (res) {
        appendMessage("user", text);
        appendMessage("safety", res);
        return;
      }
      sendHandler(cmd || text);
    } else {
      sendHandler(text);
    }
  });

  rec.addEventListener("error", (e) => {
    console.error(e);
    setStatus("Ошибка распознавания");
  });

  rec.addEventListener("end", () => {
    setStatus("Готов");
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const modeSelect = document.getElementById("mode-select");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const sendBtn = document.getElementById("send-btn");
  const voiceBtn = document.getElementById("voice-btn");
  const userInput = document.getElementById("user-input");
  const quickActions = document.querySelector(".quick-actions");
  const clearBtn = document.getElementById("clear-btn");
  const voiceSelect = document.getElementById("voice-select");

  if (apiKeyInput) apiKeyInput.value = safetyAI.apiKey || "";
  if (voiceSelect) voiceSelect.value = safetyAI.voice || "alloy";

  if (modeSelect) modeSelect.addEventListener("change", () => setMode(modeSelect.value === "x" ? MODES.X : MODES.NORMAL));
  if (voiceSelect) voiceSelect.addEventListener("change", () => safetyAI.setVoice(voiceSelect.value));

  if (saveKeyBtn && apiKeyInput) {
    saveKeyBtn.addEventListener("click", () => {
      safetyAI.apiKey = apiKeyInput.value.trim();
      alert("Ключ сохранён локально (localStorage).");
    });
  }

  if (userInput) {
    userInput.addEventListener("input", () => {
      const v = userInput.value.trim();
      setState(v ? STATES.TYPING : STATES.IDLE);
    });
  }

  const sendHandler = async (textOverride) => {
    if (!safetyAI.enabled) { alert("Укажите OpenAI API key."); return; }
    const text = (textOverride !== undefined ? textOverride : (userInput.value || "")).trim();
    if (!text) return;
    if (userInput && textOverride === undefined) userInput.value = "";
    appendMessage("user", text);
    setState(STATES.LISTENING);
    setBusyUI(true);
    try {
      const reply = await safetyAI.chat(text);
      setState(STATES.SPEAKING);
      appendMessage("safety", reply);
    } catch (e) {
      console.error(e);
      setMode(MODES.X);
      setState(STATES.ALERT);
      appendMessage("safety", "Ошибка: " + e.message);
      alert("Ошибка: " + e.message);
    } finally {
      setTimeout(() => { if (![STATES.ALERT, STATES.SLEEP].includes(currentState)) setState(STATES.IDLE); setBusyUI(false); }, 400);
    }
  };

  if (sendBtn) sendBtn.addEventListener("click", () => sendHandler());
  if (userInput) {
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHandler(); }
    });
  }

  if (voiceBtn) {
    voiceBtn.addEventListener("click", async () => {
      const log = document.getElementById("chat-log");
      if (!log) return;
      const msgs = Array.from(log.querySelectorAll(".chat-msg.safety .chat-msg-text"));
      if (!msgs.length) { alert("Нет ответа Safety для озвучки."); return; }
      const last = msgs[msgs.length - 1].textContent || "";
      try {
        setState(STATES.SPEAKING);
        await safetyAI.speak(last);
      } catch (e) {
        console.error(e);
        alert("Ошибка TTS: " + e.message);
      } finally {
        setTimeout(() => { if (![STATES.ALERT, STATES.SLEEP].includes(currentState)) setState(STATES.IDLE); }, 400);
      }
    });
  }

  if (quickActions) {
    quickActions.addEventListener("click", (e) => {
      const prompt = e.target?.getAttribute?.("data-prompt");
      if (prompt) sendHandler(prompt);
    });
  }

  if (clearBtn) clearBtn.addEventListener("click", () => { if (confirm("Очистить историю диалога?")) clearLog(); });

  setMode(MODES.NORMAL);
  setState(STATES.IDLE);
  setStatus("Готов");
  setupSTT(sendHandler);
});
