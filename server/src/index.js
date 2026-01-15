import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import { createServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import morgan from 'morgan';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== Конфигурация ==========
const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Проверка JWT_SECRET в production
if (NODE_ENV === 'production' && (!JWT_SECRET || JWT_SECRET === 'dev-secret-change-in-production')) {
  console.error('ERROR: JWT_SECRET must be set in production!');
  process.exit(1);
}

const dataDir = path.join(__dirname, '..', 'data');
const publicDir = path.join(__dirname, '..', 'public');
const uploadsDir = path.join(publicDir, 'uploads');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

// Helper function for safe debug logging
// Disabled to prevent server startup issues - can be re-enabled later if needed
function safeDebugLog(location, message, data, hypothesisId) {
  // Temporarily disabled - just return without logging
  // This prevents ENOENT errors during server startup
  return;
  /*
  try {
    // In Docker: __dirname = /app/src, so /app/src/../.cursor = /app/.cursor
    const logDir = path.join(__dirname, '..', '.cursor');
    const logPath = path.join(logDir, 'debug.log');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logEntry = JSON.stringify({location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId})+'\n';
    fs.appendFileSync(logPath, logEntry, {flag: 'a'});
  } catch (e) {
    // Silently fail - don't break the server if logging fails
  }
  */
}

const dbFile = path.join(dataDir, 'db.json');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// TLS options (optional)
const HTTPS_KEY = process.env.HTTPS_KEY || '';
const HTTPS_CERT = process.env.HTTPS_CERT || '';
const FORCE_HTTP = (process.env.FORCE_HTTP || '').toLowerCase() === 'true';
const USE_HTTPS = !FORCE_HTTP && !!(HTTPS_KEY && HTTPS_CERT);

const DEV_CORS = (process.env.CORS_ALLOW_ALL || '').toLowerCase() === 'true';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(',');
const ALLOW_UNSAFE_EVAL = (process.env.ALLOW_UNSAFE_EVAL || '').toLowerCase() === 'true';
const ENABLE_CSP = (process.env.ENABLE_CSP || 'true').toLowerCase() === 'true';

// ========== База данных ==========
let DB = {};

function encryptJson(obj) {
  if (!ENCRYPTION_KEY) return JSON.stringify(obj);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(JSON.stringify(obj), 'utf-8');
  enc = Buffer.concat([enc, cipher.final()]);
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + enc.toString('hex');
}

function decryptJson(str) {
  if (!ENCRYPTION_KEY) return JSON.parse(str);
  const parts = str.split(':');
  if (parts.length !== 3) return JSON.parse(str);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const enc = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let dec = decipher.update(enc);
  dec = Buffer.concat([dec, decipher.final()]);
  return JSON.parse(dec.toString('utf-8'));
}

function ensureArrays() {
  DB.users = DB.users || [];
  DB.chats = DB.chats || [];
  DB.messages = DB.messages || [];
  DB.blocks = DB.blocks || [];
  DB.reactions = DB.reactions || [];
  DB.saved = DB.saved || [];
  DB.pins = DB.pins || [];
  DB.polls = DB.polls || [];
  DB.pollVotes = DB.pollVotes || [];
  DB.settings = DB.settings || [];
  DB.attachments = DB.attachments || [];
  DB.roles = DB.roles || [];
  DB.mutes = DB.mutes || [];
  DB.invites = DB.invites || [];
  DB.messageStats = DB.messageStats || [];
  DB.secretChats = DB.secretChats || [];
  DB.themes = DB.themes || [];
  DB.userThemes = DB.userThemes || [];
  DB.locations = DB.locations || [];
  DB.payments = DB.payments || [];
  DB.readReceipts = DB.readReceipts || [];
  DB.threads = DB.threads || [];
  DB.channels = DB.channels || [];
  DB.channelSubscriptions = DB.channelSubscriptions || [];
  DB.voiceRooms = DB.voiceRooms || [];
  DB.stories = DB.stories || [];
  DB.storyViews = DB.storyViews || [];
  DB.storyReactions = DB.storyReactions || [];
  DB.emails = DB.emails || [];
  DB.servers = DB.servers || [];
  DB.serverMembers = DB.serverMembers || [];
}

function loadFileDB() {
  if (!fs.existsSync(dbFile)) {
    const initial = {
      users: [],
      chats: [],
      messages: [],
      blocks: [],
      reactions: [],
      saved: [],
      pins: [],
      polls: [],
      pollVotes: [],
      settings: [],
      attachments: [],
      roles: [],
      mutes: [],
      invites: [],
      messageStats: [],
      secretChats: [],
      themes: [],
      userThemes: [],
      locations: [],
      payments: [],
      readReceipts: [],
      threads: [],
      channels: [],
      channelSubscriptions: [],
      voiceRooms: [],
      stories: [],
      storyViews: [],
      storyReactions: [],
      emails: [],
      servers: [],
      serverMembers: []
    };
    fs.writeFileSync(dbFile, encryptJson(initial), 'utf-8');
    return initial;
  }
  const raw = fs.readFileSync(dbFile, 'utf-8');
  try {
  return decryptJson(raw);
  } catch (e) {
    console.error('Failed to decrypt DB, using empty DB');
    return {
      users: [], chats: [], messages: [], blocks: [], reactions: [], saved: [], pins: [],
      polls: [], pollVotes: [], settings: [], attachments: [], roles: [], mutes: [],
      invites: [], messageStats: [], secretChats: [], themes: [], userThemes: [],
      locations: [], payments: [], readReceipts: [], threads: [], channels: [],
      channelSubscriptions: [], voiceRooms: [], stories: [], storyViews: [], storyReactions: [], emails: [],
      servers: [], serverMembers: []
    };
  }
}

function saveFileDB() {
  fs.writeFileSync(dbFile, encryptJson(DB), 'utf-8');
}

DB = loadFileDB();
ensureArrays();

// ========== Утилиты ==========
function scryptHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyHash(password, hash, salt) {
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
}

function verifyPassword(password, hash, salt) {
  try {
    return verifyHash(password, hash, salt);
  } catch {
    return false;
  }
}

function isStrongPassword(pwd) {
  const s = String(pwd || '');
  return s.length >= 4;
}

// ========== Планы ==========
const PLAN_LIMITS = {
  free: { dailyMessages: null, maxUploadMb: 20, label: 'Free' },
  lite: { dailyMessages: null, maxUploadMb: 50, label: 'Lite' },
  pro: { dailyMessages: null, maxUploadMb: 200, label: 'Pro' },
  team: { dailyMessages: null, maxUploadMb: 500, label: 'Team' }
};
const DEFAULT_PLAN = (process.env.DEFAULT_PLAN || 'free').toLowerCase();

function normalizePlan(plan) {
  const key = String(plan || '').toLowerCase();
  return PLAN_LIMITS[key] ? key : DEFAULT_PLAN;
}

// ========== TOTP/2FA ==========
function generateTotpSecret() {
  return crypto.randomBytes(20).toString('base32');
}

function verifyTotp(secret, code) {
  try {
    const key = Buffer.from(secret, 'base32');
    const counter = Math.floor(Date.now() / 30000);
    for (let i = -1; i <= 1; i++) {
      const buf = Buffer.alloc(8);
      buf.writeUInt32BE(counter + i, 4);
      const hmac = crypto.createHmac('sha1', key).update(buf).digest();
      const offset = hmac[19] & 0xf;
      const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
      const otp = binary % 1000000;
      if (String(otp).padStart(6, '0') === String(code)) return true;
    }
    return false;
  } catch {
  return false;
}
}

function hashRecovery(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// ========== Express App ==========
const app = express();

// Security middleware
if (ENABLE_CSP) {
  app.use(helmet({
    contentSecurityPolicy: ALLOW_UNSAFE_EVAL ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", ...(ALLOW_UNSAFE_EVAL ? ["'unsafe-eval'"] : [])],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"]
      }
    }
  }));
}

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS
if (DEV_CORS) {
  app.use(cors({ origin: true, credentials: true }));
  // #region agent log
  safeDebugLog('index.js:270', 'CORS enabled - DEV_CORS mode', {devCors:true}, 'D');
  // #endregion
} else {
  app.use(cors({
    origin: (origin, callback) => {
      // #region agent log
      safeDebugLog('index.js:274', 'CORS check', {origin,allowedOrigins:ALLOWED_ORIGINS,isAllowed:!origin || ALLOWED_ORIGINS.includes(origin)}, 'D');
      // #endregion
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }));
}

// Logging
if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts, please try again later'
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100
});

// File upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

// Static files
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(publicDir));

// API request logging middleware
app.use('/api', (req, res, next) => {
  // #region agent log
  safeDebugLog('index.js:316', 'API request received', {path:req.path,method:req.method,origin:req.headers.origin,hasAuth:!!req.headers.authorization}, 'C');
  // #endregion
  next();
});

// ========== Аутентификация ==========
function auth(req, res, next) {
  // #region agent log
  safeDebugLog('index.js:318', 'auth middleware entry', {path:req.path,method:req.method,hasAuthHeader:!!req.headers.authorization}, 'E');
  // #endregion
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // #region agent log
    safeDebugLog('index.js:322', 'auth failed - no token', {path:req.path}, 'E');
    // #endregion
    return res.status(401).json({ error: 'unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    // #region agent log
    safeDebugLog('index.js:328', 'auth success', {path:req.path,userId:decoded.sub}, 'E');
    // #endregion
    next();
  } catch {
    // #region agent log
    safeDebugLog('index.js:330', 'auth failed - invalid token', {path:req.path}, 'E');
    // #endregion
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Rate limiting для auth endpoints
const authAttempts = new Map();
function getClientKey(req, username) {
  return req.ip + ':' + username;
}

function isBlocked(key) {
  const attempts = authAttempts.get(key) || { count: 0, resetAt: Date.now() + 60000 };
  if (Date.now() > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = Date.now() + 60000;
  }
  return attempts.count >= 10;
}

function addFail(key) {
  const attempts = authAttempts.get(key) || { count: 0, resetAt: Date.now() + 60000 };
  if (Date.now() > attempts.resetAt) {
    attempts.count = 0;
    attempts.resetAt = Date.now() + 60000;
  }
  attempts.count++;
  authAttempts.set(key, attempts);
}

// ========== Health Check ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'alive' });
});

app.get('/health/ready', (req, res) => {
  res.json({ status: 'ready' });
});

// ========== Регистрация и Логин ==========
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, password, email, emailCode, needsCloudCode } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'bad_request', detail: 'Нужны логин и пароль' });
    }
    if (String(username).length < 3) {
      return res.status(400).json({ error: 'username_short', detail: 'Логин должен содержать минимум 3 символа' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'weak_password', detail: 'Пароль должен содержать минимум 4 символа' });
    }
    if (DB.users.find(u => u.username.toLowerCase() === String(username).toLowerCase())) {
      return res.status(400).json({ error: 'user_exists', detail: 'Пользователь с таким логином уже существует' });
    }

    // Проверка email кода если нужен
    if (needsCloudCode && email) {
      if (!emailCode) {
        return res.status(400).json({ error: 'email_code_required' });
      }
      const emailRecord = DB.emails.find(e => e.email === email && e.code === String(emailCode));
      if (!emailRecord || Date.now() > emailRecord.expiresAt) {
        return res.status(400).json({ error: 'invalid_email_code' });
      }
    }

  const { hash, salt } = scryptHash(password);
  const user = {
    id: uuidv4(),
      username: String(username).slice(0, 32),
    passhash: hash,
    salt,
      email: email || null,
    roles: ['user'],
    plan: DEFAULT_PLAN,
    createdAt: Date.now(),
    avatarUrl: null,
    about: '',
    status: 'online',
    lastSeen: null,
    showBio: true,
    showAvatar: true,
      profileColor: '#3b82f6',
    twofaSecret: null,
    pending2faSecret: null,
    recoveryCodes: [],
    pinHash: null,
    pinSalt: null
  };
    DB.users.push(user);
    saveFileDB();

    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl, status: user.status } });
  } catch (e) {
    console.error('[register]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/auth/register/email', authLimiter, (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 минут
  DB.emails = DB.emails || [];
  DB.emails.push({ email, code, expiresAt, createdAt: Date.now() });
  saveFileDB();
  // В реальном приложении здесь должна быть отправка email
  console.log(`[EMAIL CODE] ${email}: ${code}`);
  res.json({ ok: true, message: 'Код отправлен на email' });
});

app.post('/api/auth/register/verify-email', authLimiter, (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) {
    return res.status(400).json({ error: 'bad_request' });
  }
  const emailRecord = DB.emails.find(e => e.email === email && e.code === String(code));
  if (!emailRecord || Date.now() > emailRecord.expiresAt) {
    return res.status(400).json({ error: 'invalid_code' });
  }
  res.json({ ok: true });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  try {
    const { username, password, code, recoveryCode, pin } = req.body || {};
    const key = getClientKey(req, username || '');
    if (isBlocked(key)) return res.status(429).json({ error: 'too_many_attempts' });
    if (!username || !password) {
      addFail(key);
      return res.status(400).json({ error: 'bad_request', detail: 'Нужны логин и пароль' });
    }

    const user = DB.users.find(u => u.username.toLowerCase() === String(username).toLowerCase());
    if (!user || !verifyPassword(password, user.passhash, user.salt)) {
        addFail(key);
        return res.status(400).json({ error: 'bad_creds' });
    }

    if (user.pinHash) {
      if (!pin) return res.status(401).json({ error: 'pin_required' });
      if (!verifyHash(pin, user.pinHash, user.pinSalt)) return res.status(401).json({ error: 'pin_invalid' });
    }

    if (user.twofaSecret) {
      let ok = false;
      if (recoveryCode) {
        const hashed = hashRecovery(recoveryCode);
        const idx = (user.recoveryCodes || []).findIndex(r => r === hashed);
        if (idx >= 0) {
          user.recoveryCodes.splice(idx, 1);
          ok = true;
          saveFileDB();
        }
      } else if (code && verifyTotp(user.twofaSecret, code)) {
        ok = true;
      }
      if (!ok) return res.status(401).json({ error: '2fa_required' });
    }

    user.lastSeen = Date.now();
    saveFileDB();

    const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl, status: user.status } });
  } catch (e) {
    console.error('[login]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// ========== Пользователи ==========
app.get('/api/users/me', auth, (req, res) => {
  // #region agent log
  try{const logPath=path.join('/app','.cursor','debug.log');if(!fs.existsSync(path.dirname(logPath)))fs.mkdirSync(path.dirname(logPath),{recursive:true});fs.appendFileSync(logPath,JSON.stringify({location:'index.js:557',message:'/api/users/me handler entry',data:{userId:req.user?.sub,hasAuth:!!req.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){console.error('Log error:',e.message);}
  // #endregion
  const me = DB.users.find(u => u.id === req.user.sub);
  // #region agent log
  try{const logPath=path.join('/app','.cursor','debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'index.js:561',message:'user lookup result',data:{found:!!me,userId:req.user?.sub,dbUsersCount:DB.users?.length||0,username:me?.username,roles:me?.roles},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){console.error('Log error:',e.message);}
  // #endregion
  if (!me) {
    // #region agent log
    try{const logPath=path.join('/app','.cursor','debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'index.js:565',message:'user not found, returning 404',data:{userId:req.user?.sub},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){console.error('Log error:',e.message);}
    // #endregion
    return res.status(404).json({ error: 'not_found' });
  }
  const limits = PLAN_LIMITS[me.plan] || PLAN_LIMITS[DEFAULT_PLAN];
  const today = new Date().toISOString().slice(0, 10);
  const stat = (DB.messageStats || []).find(s => s.userId === me.id && s.day === today);
  const dailyUsed = stat?.count || 0;
  const responseData = {
    id: me.id,
    username: me.username,
    roles: Array.isArray(me.roles) ? me.roles : (me.roles ? [me.roles] : []),
    plan: me.plan,
    planLimits: limits,
    dailyMessagesUsed: dailyUsed,
    dailyMessagesRemaining: limits.dailyMessages != null ? Math.max(0, limits.dailyMessages - dailyUsed) : null,
    avatarUrl: me.avatarUrl,
    about: me.about,
    status: me.status || 'online',
    profileColor: me.profileColor,
    showBio: me.showBio !== false,
    showAvatar: me.showAvatar !== false,
    lastSeen: me.lastSeen || null
  };
  // #region agent log
  try{const logPath=path.join('/app','.cursor','debug.log');if(!fs.existsSync(path.dirname(logPath)))fs.mkdirSync(path.dirname(logPath),{recursive:true});fs.appendFileSync(logPath,JSON.stringify({location:'index.js:590',message:'sending user response',data:{userId:responseData.id,username:responseData.username,roles:responseData.roles,rolesType:typeof responseData.roles,rolesIsArray:Array.isArray(responseData.roles)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})+'\n');}catch(e){console.error('Log error:',e.message);}
  // #endregion
  res.json(responseData);
});

app.get('/api/users', auth, (req, res) => {
  const list = (DB.users || []).map(u => ({
    id: u.id,
    username: u.username,
    avatarUrl: u.avatarUrl,
    status: u.status || 'online'
  }));
  res.json({ users: list });
});

app.get('/api/users/search', auth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 1) return res.json({ users: [] });
  const results = (DB.users || [])
    .filter(u => u.username.toLowerCase().includes(q))
    .slice(0, 20)
    .map(u => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      status: u.status || 'online'
    }));
  res.json({ users: results });
});

app.get('/api/users/:id', auth, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const isOwn = user.id === req.user.sub;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      status: user.status,
      bio: user.about || user.bio,
      email: isOwn ? user.email : undefined,
      lastSeen: user.lastSeen,
      createdAt: user.createdAt
    }
  });
});

const updateUserMe = (req, res) => {
  const user = DB.users.find(u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (req.body.bio !== undefined) user.about = user.bio = String(req.body.bio || '').slice(0, 500);
  if (req.body.about !== undefined) user.about = user.bio = String(req.body.about || '').slice(0, 500);
  if (req.body.status !== undefined) {
    const validStatuses = ['online', 'offline', 'away', 'busy', 'invisible'];
    if (validStatuses.includes(req.body.status)) user.status = req.body.status;
  }
  saveFileDB();
  res.json({ ok: true, user: { id: user.id, username: user.username, avatarUrl: user.avatarUrl, status: user.status, bio: user.about || user.bio } });
};

app.patch('/api/users/me', auth, updateUserMe);
app.post('/api/users/me', auth, updateUserMe);

app.post('/api/users/me/avatar', auth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const user = DB.users.find(u => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const ext = path.extname(req.file.filename).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    return res.status(400).json({ error: 'invalid_file_type' });
  }
  user.avatarUrl = `/uploads/${req.file.filename}`;
  saveFileDB();
  res.json({ ok: true, avatarUrl: user.avatarUrl });
});

app.post('/api/users/me/status', auth, (req, res) => {
  const { status } = req.body || {};
  if (!['online', 'busy', 'invisible', 'away', 'offline'].includes(status)) return res.status(400).json({ error: 'bad_status' });
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  me.status = status;
  saveFileDB();
  broadcastPresence();
  res.json({ ok: true });
});

// ========== Настройки ==========
app.get('/api/users/me/notifications', auth, (req, res) => {
  const userId = req.user.sub;
  const userSettings = (DB.settings || []).find(s => s.userId === userId) || {};
  const defaultNotif = {
    pushEnabled: true,
    soundEnabled: true,
    desktopEnabled: true,
    mentionsOnly: false,
    previewEnabled: true,
    groupsEnabled: true,
    channelsEnabled: true,
    soundVolume: 80
  };
  res.json({ ...defaultNotif, ...(userSettings.notifications || {}) });
});

app.post('/api/users/me/notifications', auth, (req, res) => {
  const userId = req.user.sub;
  const notifications = req.body || {};
  let userSettings = (DB.settings || []).find(s => s.userId === userId);
  if (!userSettings) {
    userSettings = { userId, notifications: {}, privacy: {} };
    DB.settings.push(userSettings);
  }
  userSettings.notifications = { ...userSettings.notifications, ...notifications };
  saveFileDB();
  res.json({ ok: true, notifications: userSettings.notifications });
});

app.get('/api/users/me/privacy', auth, (req, res) => {
  const userId = req.user.sub;
  const user = DB.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const userSettings = (DB.settings || []).find(s => s.userId === userId) || {};
  const defaultPrivacy = {
    showBio: user.showBio !== false,
    showAvatar: user.showAvatar !== false,
    showLastSeen: true,
    showReadReceipts: true,
    allowGroupInvites: true,
    profileColor: user.profileColor || '#3b82f6'
  };
  res.json({ ...defaultPrivacy, ...(userSettings.privacy || {}) });
});

app.post('/api/users/me/privacy', auth, (req, res) => {
  const userId = req.user.sub;
  const user = DB.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'not_found' });
  const privacy = req.body || {};
  let userSettings = (DB.settings || []).find(s => s.userId === userId);
  if (!userSettings) {
    userSettings = { userId, notifications: {}, privacy: {} };
    DB.settings.push(userSettings);
  }
  userSettings.privacy = { ...userSettings.privacy, ...privacy };
  if (privacy.showBio !== undefined) user.showBio = !!privacy.showBio;
  if (privacy.showAvatar !== undefined) user.showAvatar = !!privacy.showAvatar;
  if (privacy.profileColor) user.profileColor = String(privacy.profileColor).slice(0, 16);
  saveFileDB();
  res.json({ ok: true, privacy: userSettings.privacy });
});

// ========== Безопасность ==========
app.post('/api/users/me/password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  if (!verifyPassword(oldPassword || '', me.passhash, me.salt)) return res.status(400).json({ error: 'bad_old' });
  if (!isStrongPassword(newPassword || '')) return res.status(400).json({ error: 'weak_password' });
  const { hash, salt } = scryptHash(newPassword || '');
  me.passhash = hash;
  me.salt = salt;
  saveFileDB();
  res.json({ ok: true });
});

app.post('/api/users/me/2fa/generate', auth, (req, res) => {
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  const secret = generateTotpSecret();
  me.pending2faSecret = secret;
  saveFileDB();
  const otpauth = `otpauth://totp/SafeGram:${me.username}?secret=${secret}&issuer=SafeGram`;
  res.json({ secret, otpauth });
});

app.post('/api/users/me/2fa/enable', auth, (req, res) => {
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  const secret = me.pending2faSecret || me.twofaSecret;
  if (!secret) return res.status(400).json({ error: 'no_secret' });
  const { code } = req.body || {};
  if (!verifyTotp(secret, code)) return res.status(400).json({ error: 'invalid_code' });
  me.twofaSecret = secret;
  me.pending2faSecret = null;
  saveFileDB();
  res.json({ ok: true });
});

app.post('/api/users/me/2fa/disable', auth, (req, res) => {
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  if (!me.twofaSecret) return res.status(400).json({ error: 'not_enabled' });
  const { code, recoveryCode } = req.body || {};
  let ok = false;
  if (recoveryCode) {
    const hashed = hashRecovery(recoveryCode);
    const idx = (me.recoveryCodes || []).findIndex(r => r === hashed);
    if (idx >= 0) {
      me.recoveryCodes.splice(idx, 1);
      ok = true;
    }
  } else if (code && verifyTotp(me.twofaSecret, code)) {
    ok = true;
  }
  if (!ok) return res.status(400).json({ error: 'invalid_code' });
  me.twofaSecret = null;
  me.pending2faSecret = null;
  saveFileDB();
  res.json({ ok: true });
});

app.post('/api/users/me/recovery', auth, (req, res) => {
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(hashRecovery(code));
  }
  me.recoveryCodes = codes;
  saveFileDB();
  res.json({ ok: true, remaining: me.recoveryCodes.length });
});

app.post('/api/users/me/pin', auth, (req, res) => {
  const me = DB.users.find(u => u.id === req.user.sub);
  if (!me) return res.status(404).json({ error: 'not_found' });
  const { pin } = req.body || {};
  const p = String(pin || '').trim();
  if (!p) {
    me.pinHash = null;
    me.pinSalt = null;
    saveFileDB();
    return res.json({ ok: true, cleared: true });
  }
  if (p.length < 4 || p.length > 12) return res.status(400).json({ error: 'bad_pin' });
  const { hash, salt } = scryptHash(p);
  me.pinHash = hash;
  me.pinSalt = salt;
  saveFileDB();
  res.json({ ok: true });
});

// ========== Чаты ==========
app.get('/api/chats', auth, (req, res) => {
  // #region agent log
  try{const logPath=path.join('/app','.cursor','debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'index.js:833',message:'/api/chats handler entry',data:{userId:req.user?.sub},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){console.error('Log error:',e.message);}
  // #endregion
  const userId = req.user.sub;
  const chats = (DB.chats || []).filter(c => c.members.includes(userId));
  // #region agent log
  try{const logPath=path.join('/app','.cursor','debug.log');fs.appendFileSync(logPath,JSON.stringify({location:'index.js:836',message:'chats filtered',data:{userId,totalChats:DB.chats?.length||0,filteredChats:chats.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})+'\n');}catch(e){console.error('Log error:',e.message);}
  // #endregion
  res.json({ chats });
});

app.post('/api/chats', auth, (req, res) => {
  const { type, name, members } = req.body || {};
  if (!type || !['dm', 'group', 'channel'].includes(type)) {
    return res.status(400).json({ error: 'bad_request' });
  }
  const chat = {
    id: uuidv4(),
    type,
    name: name || null,
    members: type === 'dm' ? [req.user.sub, ...(members || [])].slice(0, 2) : [req.user.sub, ...(members || [])],
    createdAt: Date.now()
  };
  DB.chats.push(chat);
  saveFileDB();
  res.json({ chat });
});

app.get('/api/chats/:id', auth, (req, res) => {
  const chat = DB.chats.find(c => c.id === req.params.id);
  if (!chat || !chat.members.includes(req.user.sub)) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json({ chat });
});

// ========== Сообщения ==========
app.get('/api/chats/:id/messages', auth, (req, res) => {
  const chat = DB.chats.find(c => c.id === req.params.id);
  if (!chat || !chat.members.includes(req.user.sub)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const messages = (DB.messages || []).filter(m => m.chatId === req.params.id && !m.deletedForSender).slice(-100);
  const reactions = (DB.reactions || []).filter(r => messages.some(m => m.id === r.messageId));
  res.json({ messages, reactions });
});

app.post('/api/chats/:id/messages', auth, apiLimiter, (req, res) => {
  const chat = DB.chats.find(c => c.id === req.params.id);
  if (!chat || !chat.members.includes(req.user.sub)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const { text, attachmentUrl, replyTo, forwardFrom, threadId, stickerId } = req.body || {};
  const message = {
    id: uuidv4(),
    chatId: req.params.id,
    senderId: req.user.sub,
    text: text || '',
    attachmentUrl: attachmentUrl || null,
    replyTo: replyTo || null,
    forwardFrom: forwardFrom || null,
    threadId: threadId || null,
    stickerId: stickerId || null,
    createdAt: Date.now()
  };
  DB.messages.push(message);
  saveFileDB();
  
  // Обновляем lastMessage в чате
  chat.lastMessage = message;
  saveFileDB();
  
  // Отправляем через Socket.IO
  io.emit('message', message);
  
  res.json({ message });
});

// Редактирование сообщения
app.post('/api/messages/:id/edit', auth, (req, res) => {
  const message = DB.messages.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'not_found' });
  if (message.senderId !== req.user.sub && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'bad_request' });
  message.text = String(text).trim();
  message.editedAt = Date.now();
  saveFileDB();
  io.emit('message_update', message);
  res.json({ message });
});

// Удаление сообщения
app.post('/api/messages/:id/delete', auth, (req, res) => {
  const message = DB.messages.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'not_found' });
  const { deleteForAll } = req.body || {};
  if (message.senderId !== req.user.sub && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (deleteForAll) {
    message.deletedAt = Date.now();
    message.text = '';
    message.attachmentUrl = null;
  } else {
    // Мягкое удаление - только для отправителя
    message.deletedForSender = true;
  }
  saveFileDB();
  io.emit('message_delete', { messageId: message.id, deleteForAll: !!deleteForAll });
  res.json({ ok: true });
});

// Реакция на сообщение
app.post('/api/messages/:id/react', auth, (req, res) => {
  const message = DB.messages.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'not_found' });
  const { emoji } = req.body || {};
  if (!emoji) return res.status(400).json({ error: 'bad_request' });
  
  DB.reactions = DB.reactions || [];
  const existing = DB.reactions.find(r => r.messageId === req.params.id && r.userId === req.user.sub && r.emoji === emoji);
  if (existing) {
    // Удаляем реакцию, если она уже есть
    DB.reactions = DB.reactions.filter(r => !(r.messageId === req.params.id && r.userId === req.user.sub && r.emoji === emoji));
  } else {
    // Добавляем реакцию
    DB.reactions.push({
      id: uuidv4(),
      messageId: req.params.id,
      userId: req.user.sub,
      emoji: String(emoji).slice(0, 10),
      createdAt: Date.now()
    });
  }
  saveFileDB();
  io.emit('reaction', { messageId: req.params.id, userId: req.user.sub, emoji });
  res.json({ ok: true });
});

// Геолокация сообщения
app.post('/api/messages/:id/location', auth, (req, res) => {
  const message = DB.messages.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'not_found' });
  if (message.senderId !== req.user.sub) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { lat, lng, address } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'bad_request' });
  }
  message.location = { lat, lng, address: address || null };
  saveFileDB();
  io.emit('message_update', message);
  res.json({ ok: true });
});

// Создание треда
app.post('/api/chats/:id/threads', auth, (req, res) => {
  const chat = DB.chats.find(c => c.id === req.params.id);
  if (!chat || !chat.members.includes(req.user.sub)) {
    return res.status(404).json({ error: 'not_found' });
  }
  const { rootMessageId, name } = req.body || {};
  if (!rootMessageId) return res.status(400).json({ error: 'bad_request' });
  
  DB.threads = DB.threads || [];
  const thread = {
    id: uuidv4(),
    chatId: req.params.id,
    rootMessageId: rootMessageId,
    name: name ? String(name).slice(0, 100) : null,
    createdAt: Date.now()
  };
  DB.threads.push(thread);
  saveFileDB();
  res.json({ thread });
});

// Получение тредов чата
app.get('/api/chats/:id/threads', auth, (req, res) => {
  const chat = DB.chats.find(c => c.id === req.params.id);
  if (!chat || !chat.members.includes(req.user.sub)) {
    return res.status(404).json({ error: 'not_found' });
  }
  DB.threads = DB.threads || [];
  const threads = DB.threads.filter(t => t.chatId === req.params.id).map(t => {
    const threadMessages = (DB.messages || []).filter(m => m.threadId === t.id);
    return {
      ...t,
      messageCount: threadMessages.length,
      lastMessage: threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : null
    };
  });
  res.json({ threads });
});

// Получение сообщений треда
app.get('/api/threads/:id/messages', auth, (req, res) => {
  const thread = (DB.threads || []).find(t => t.id === req.params.id);
  if (!thread) return res.status(404).json({ error: 'not_found' });
  const chat = DB.chats.find(c => c.id === thread.chatId);
  if (!chat || !chat.members.includes(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const messages = (DB.messages || []).filter(m => m.threadId === req.params.id).slice(-100);
  const reactions = (DB.reactions || []).filter(r => messages.some(m => m.id === r.messageId));
  res.json({ messages, reactions });
});

// ========== Стикеры ==========
DB.stickerPacks = DB.stickerPacks || [];
DB.stickers = DB.stickers || [];

// Получение наборов стикеров
app.get('/api/sticker-packs', auth, (req, res) => {
  const packs = (DB.stickerPacks || []).map(pack => ({
    ...pack,
    stickerCount: (DB.stickers || []).filter(s => s.packId === pack.id).length
  }));
  res.json({ packs });
});

// Получение стикеров из набора
app.get('/api/sticker-packs/:packId/stickers', auth, (req, res) => {
  const stickers = (DB.stickers || []).filter(s => s.packId === req.params.packId);
  res.json({ stickers });
});

// ========== Файлы ==========
app.post('/api/chats/:id/attach', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ========== Админ и Владелец ==========
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'owner';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'owner-secure-password-change-me';

// Создание владельца при первом запуске
function ensureOwner() {
  let owner = DB.users.find(u => u.roles?.includes('owner'));
  if (!owner) {
    owner = DB.users.find(u => u.username.toLowerCase() === OWNER_USERNAME.toLowerCase());
    if (!owner) {
      const { hash, salt } = scryptHash(OWNER_PASSWORD);
      owner = {
        id: 'owner-' + uuidv4(),
        username: OWNER_USERNAME,
        passhash: hash,
        salt,
        roles: ['owner', 'admin', 'user'],
        plan: 'team',
        createdAt: Date.now(),
        avatarUrl: null,
        about: 'Владелец SafeGram',
        status: 'online',
        lastSeen: Date.now(),
        showBio: true,
        showAvatar: true,
        profileColor: '#ff6b6b',
        twofaSecret: null,
        pending2faSecret: null,
        recoveryCodes: [],
        pinHash: null,
        pinSalt: null
      };
      DB.users.push(owner);
      saveFileDB();
      console.log(`[OWNER] Created owner account: ${OWNER_USERNAME}`);
    } else {
      owner.roles = ['owner', 'admin', 'user'];
      saveFileDB();
    }
  }
}

ensureOwner();

function isOwner(userId) {
  const user = DB.users.find(u => u.id === userId);
  return user?.roles?.includes('owner');
}

function isAdmin(userId) {
  const user = DB.users.find(u => u.id === userId);
  return user?.roles?.includes('admin') || user?.roles?.includes('owner');
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden', detail: 'Требуются права администратора' });
  }
  next();
}

function requireOwner(req, res, next) {
  if (!isOwner(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden', detail: 'Требуются права владельца' });
  }
  next();
}

// Админ: Список всех пользователей
app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
  const users = DB.users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email || null,
    roles: u.roles || ['user'],
    plan: u.plan,
    status: u.status || 'online',
    createdAt: u.createdAt,
    lastSeen: u.lastSeen,
    avatarUrl: u.avatarUrl
  }));
  res.json({ users });
});

// Админ: Блокировка пользователя
app.post('/api/admin/users/:id/block', auth, requireAdmin, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (isOwner(user.id)) return res.status(403).json({ error: 'cannot_block_owner' });
  
  user.status = 'banned';
  user.roles = user.roles?.filter(r => r !== 'admin') || ['user'];
  saveFileDB();
  
  // Отключаем все сессии
  const userSocket = userSockets.get(user.id);
  if (userSocket) {
    userSocket.emit('banned');
    userSocket.disconnect();
  }
  
  res.json({ ok: true });
});

// Админ: Разблокировка пользователя
app.post('/api/admin/users/:id/unblock', auth, requireAdmin, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  user.status = 'online';
  saveFileDB();
  res.json({ ok: true });
});

// Владелец/Админ: Назначение администратора
app.post('/api/admin/users/:id/promote', auth, requireAdmin, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (!user.roles) user.roles = ['user'];
  if (!user.roles.includes('admin')) {
    user.roles.push('admin');
    saveFileDB();
  }
  res.json({ ok: true, roles: user.roles });
});

// Владелец/Админ: Снятие администратора
app.post('/api/admin/users/:id/demote', auth, requireAdmin, (req, res) => {
  const user = DB.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'not_found' });
  if (isOwner(user.id)) return res.status(403).json({ error: 'cannot_demote_owner' });
  if (user.roles) {
    user.roles = user.roles.filter(r => r !== 'admin');
    saveFileDB();
  }
  res.json({ ok: true, roles: user.roles });
});

// Админ: Статистика
app.get('/api/admin/stats', auth, requireAdmin, (req, res) => {
  const stats = {
    users: DB.users.length,
    chats: DB.chats.length,
    messages: DB.messages.length,
    online: onlineUsers.size,
    servers: (DB.servers || []).length,
    channels: (DB.channels || []).length,
    groups: (DB.chats || []).filter(c => c.type === 'group').length
  };
  res.json({ stats });
});

// ========== Серверы (Discord-подобные) ==========
DB.servers = DB.servers || [];
DB.serverMembers = DB.serverMembers || [];

// Создание сервера
app.post('/api/servers', auth, (req, res) => {
  const { name, description } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'bad_request', detail: 'Название сервера должно содержать минимум 2 символа' });
  }
  
  const server = {
    id: uuidv4(),
    name: String(name).slice(0, 100),
    description: description ? String(description).slice(0, 500) : null,
    ownerId: req.user.sub,
    iconUrl: null,
    createdAt: Date.now()
  };
  
  DB.servers.push(server);
  
  // Автоматически добавляем владельца как участника
  const member = {
    id: uuidv4(),
    serverId: server.id,
    userId: req.user.sub,
    role: 'owner',
    joinedAt: Date.now()
  };
  DB.serverMembers.push(member);
  
  // Создаем системный канал по умолчанию
  const defaultChannel = {
    id: uuidv4(),
    serverId: server.id,
    name: 'general',
    type: 'text',
    position: 0,
    createdAt: Date.now()
  };
  DB.channels = DB.channels || [];
  DB.channels.push(defaultChannel);
  
  saveFileDB();
  res.json({ server });
});

// Список серверов пользователя
app.get('/api/servers', auth, (req, res) => {
  const userId = req.user.sub;
  const memberServerIds = (DB.serverMembers || []).filter(m => m.userId === userId).map(m => m.serverId);
  const servers = (DB.servers || []).filter(s => memberServerIds.includes(s.id));
  res.json({ servers });
});

// Получить сервер
app.get('/api/servers/:id', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'not_found' });
  
  const member = (DB.serverMembers || []).find(m => m.serverId === server.id && m.userId === req.user.sub);
  if (!member && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  res.json({ server });
});

// Участники сервера
app.get('/api/servers/:id/members', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'not_found' });
  
  const member = (DB.serverMembers || []).find(m => m.serverId === server.id && m.userId === req.user.sub);
  if (!member && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  const members = (DB.serverMembers || []).filter(m => m.serverId === req.params.id);
  const users = members.map(m => {
    const user = DB.users.find(u => u.id === m.userId);
    return {
      id: user?.id,
      username: user?.username,
      avatarUrl: user?.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt
    };
  }).filter(u => u.id);
  
  res.json({ members: users });
});

// Присоединиться к серверу
app.post('/api/servers/:id/join', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'not_found' });
  
  const existing = (DB.serverMembers || []).find(m => m.serverId === req.params.id && m.userId === req.user.sub);
  if (existing) return res.status(400).json({ error: 'already_member' });
  
  const member = {
    id: uuidv4(),
    serverId: req.params.id,
    userId: req.user.sub,
    role: 'member',
    joinedAt: Date.now()
  };
  DB.serverMembers.push(member);
  saveFileDB();
  
  res.json({ ok: true });
});

// Покинуть сервер
app.post('/api/servers/:id/leave', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: 'not_found' });
  
  if (server.ownerId === req.user.sub) {
    return res.status(400).json({ error: 'cannot_leave_own_server' });
  }
  
  DB.serverMembers = (DB.serverMembers || []).filter(m => !(m.serverId === req.params.id && m.userId === req.user.sub));
  saveFileDB();
  
  res.json({ ok: true });
});

// ========== Каналы (в серверах) ==========
DB.channels = DB.channels || [];

// Создать канал в сервере
app.post('/api/servers/:serverId/channels', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.serverId);
  if (!server) return res.status(404).json({ error: 'server_not_found' });
  
  const member = (DB.serverMembers || []).find(m => m.serverId === req.params.serverId && m.userId === req.user.sub);
  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    if (server.ownerId !== req.user.sub && !isAdmin(req.user.sub)) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }
  
  const { name, type } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'bad_request' });
  }
  
  const channels = (DB.channels || []).filter(c => c.serverId === req.params.serverId);
  const maxPosition = channels.length > 0 ? Math.max(...channels.map(c => c.position || 0)) : -1;
  
  const channel = {
    id: uuidv4(),
    serverId: req.params.serverId,
    name: String(name).slice(0, 100),
    type: type || 'text', // text, voice
    position: maxPosition + 1,
    createdAt: Date.now()
  };
  
  DB.channels.push(channel);
  saveFileDB();
  
  res.json({ channel });
});

// Список каналов сервера
app.get('/api/servers/:serverId/channels', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.serverId);
  if (!server) return res.status(404).json({ error: 'not_found' });
  
  const member = (DB.serverMembers || []).find(m => m.serverId === req.params.serverId && m.userId === req.user.sub);
  if (!member && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  const channels = (DB.channels || []).filter(c => c.serverId === req.params.serverId)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  
  res.json({ channels });
});

// Удалить канал
app.delete('/api/servers/:serverId/channels/:channelId', auth, (req, res) => {
  const server = DB.servers.find(s => s.id === req.params.serverId);
  if (!server) return res.status(404).json({ error: 'server_not_found' });
  
  const member = (DB.serverMembers || []).find(m => m.serverId === req.params.serverId && m.userId === req.user.sub);
  if (server.ownerId !== req.user.sub && member?.role !== 'owner' && member?.role !== 'admin' && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  DB.channels = (DB.channels || []).filter(c => c.id !== req.params.channelId);
  saveFileDB();
  
  res.json({ ok: true });
});

// ========== Группы (Telegram-подобные) ==========
// Группы уже есть в системе чатов, но добавим улучшенные функции

// Создать группу
app.post('/api/groups', auth, (req, res) => {
  const { name, description, isPublic } = req.body || {};
  
  const group = {
    id: uuidv4(),
    type: 'group',
    name: name ? String(name).slice(0, 100) : null,
    description: description ? String(description).slice(0, 500) : null,
    ownerId: req.user.sub,
    members: [req.user.sub],
    isPublic: !!isPublic,
    requiresReview: false,
    approved: true,
    createdAt: Date.now()
  };
  
  DB.chats.push(group);
  saveFileDB();
  
  res.json({ chat: group });
});

// Присоединиться к группе
app.post('/api/groups/:id/join', auth, (req, res) => {
  const group = DB.chats.find(c => c.id === req.params.id && c.type === 'group');
  if (!group) return res.status(404).json({ error: 'not_found' });
  
  if (!group.isPublic && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'group_is_private' });
  }
  
  if (group.members.includes(req.user.sub)) {
    return res.status(400).json({ error: 'already_member' });
  }
  
  group.members.push(req.user.sub);
  saveFileDB();
  
  res.json({ ok: true });
});

// Покинуть группу
app.post('/api/groups/:id/leave', auth, (req, res) => {
  const group = DB.chats.find(c => c.id === req.params.id && c.type === 'group');
  if (!group) return res.status(404).json({ error: 'not_found' });
  
  if (group.ownerId === req.user.sub) {
    return res.status(400).json({ error: 'cannot_leave_own_group' });
  }
  
  group.members = group.members.filter(id => id !== req.user.sub);
  saveFileDB();
  
  res.json({ ok: true });
});

// Добавить участника в группу
app.post('/api/groups/:id/members', auth, (req, res) => {
  const group = DB.chats.find(c => c.id === req.params.id && c.type === 'group');
  if (!group) return res.status(404).json({ error: 'not_found' });
  
  if (group.ownerId !== req.user.sub && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  const { userId } = req.body || {};
  if (!userId || group.members.includes(userId)) {
    return res.status(400).json({ error: 'bad_request' });
  }
  
  group.members.push(userId);
  saveFileDB();
  
  res.json({ ok: true });
});

// Удалить участника из группы
app.delete('/api/groups/:id/members/:userId', auth, (req, res) => {
  const group = DB.chats.find(c => c.id === req.params.id && c.type === 'group');
  if (!group) return res.status(404).json({ error: 'not_found' });
  
  if (group.ownerId !== req.user.sub && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  group.members = group.members.filter(id => id !== req.params.userId);
  saveFileDB();
  
  res.json({ ok: true });
});

// Обновить группу
app.patch('/api/groups/:id', auth, (req, res) => {
  const group = DB.chats.find(c => c.id === req.params.id && c.type === 'group');
  if (!group) return res.status(404).json({ error: 'not_found' });
  
  if (group.ownerId !== req.user.sub && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  const { name, description, isPublic } = req.body || {};
  if (name !== undefined) group.name = name ? String(name).slice(0, 100) : null;
  if (description !== undefined) group.description = description ? String(description).slice(0, 500) : null;
  if (isPublic !== undefined) group.isPublic = !!isPublic;
  
  saveFileDB();
  res.json({ chat: group });
});

// ========== Каналы (Telegram-подобные) ==========
DB.channels = DB.channels || [];
DB.channelSubscriptions = DB.channelSubscriptions || [];

// Создать канал (публичный канал как в Telegram)
app.post('/api/channels', auth, (req, res) => {
  const { name, description, isPublic } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'bad_request' });
  }
  
  const channel = {
      id: uuidv4(),
    type: 'channel',
    name: String(name).slice(0, 100),
    description: description ? String(description).slice(0, 500) : null,
    ownerId: req.user.sub,
    members: [req.user.sub],
    isPublic: !!isPublic,
    requiresReview: false,
    approved: true,
    subscribers: 1,
    createdAt: Date.now()
  };
  
  DB.chats.push(channel);
  DB.channelSubscriptions.push({
    id: uuidv4(),
    channelId: channel.id,
    userId: req.user.sub,
    subscribedAt: Date.now()
  });
  saveFileDB();
  
  res.json({ chat: channel });
});

// Подписаться на канал
app.post('/api/channels/:id/subscribe', auth, (req, res) => {
  const channel = DB.chats.find(c => c.id === req.params.id && c.type === 'channel');
  if (!channel) return res.status(404).json({ error: 'not_found' });
  
  const existing = DB.channelSubscriptions.find(s => s.channelId === req.params.id && s.userId === req.user.sub);
  if (existing) return res.status(400).json({ error: 'already_subscribed' });
  
  DB.channelSubscriptions.push({
    id: uuidv4(),
    channelId: req.params.id,
    userId: req.user.sub,
    subscribedAt: Date.now()
  });
  
  channel.subscribers = (channel.subscribers || 0) + 1;
  if (!channel.members.includes(req.user.sub)) {
    channel.members.push(req.user.sub);
  }
  saveFileDB();
  
  res.json({ ok: true });
});

// Отписаться от канала
app.post('/api/channels/:id/unsubscribe', auth, (req, res) => {
  const channel = DB.chats.find(c => c.id === req.params.id && c.type === 'channel');
  if (!channel) return res.status(404).json({ error: 'not_found' });
  
  if (channel.ownerId === req.user.sub) {
    return res.status(400).json({ error: 'cannot_unsubscribe_own_channel' });
  }
  
  DB.channelSubscriptions = DB.channelSubscriptions.filter(s => !(s.channelId === req.params.id && s.userId === req.user.sub));
  channel.subscribers = Math.max(0, (channel.subscribers || 1) - 1);
  saveFileDB();
  
  res.json({ ok: true });
});

// Обновить канал
app.patch('/api/channels/:id', auth, (req, res) => {
  const channel = DB.chats.find(c => c.id === req.params.id && c.type === 'channel');
  if (!channel) return res.status(404).json({ error: 'not_found' });
  
  if (channel.ownerId !== req.user.sub && !isAdmin(req.user.sub)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  
  const { name, description, isPublic } = req.body || {};
  if (name !== undefined) channel.name = name ? String(name).slice(0, 100) : null;
  if (description !== undefined) channel.description = description ? String(description).slice(0, 500) : null;
  if (isPublic !== undefined) channel.isPublic = !!isPublic;
  
  saveFileDB();
  res.json({ chat: channel });
});

// ========== Socket.IO ==========
let server;
if (USE_HTTPS && HTTPS_KEY && HTTPS_CERT) {
  const keyPath = path.isAbsolute(HTTPS_KEY) ? HTTPS_KEY : path.join(__dirname, '..', HTTPS_KEY);
  const certPath = path.isAbsolute(HTTPS_CERT) ? HTTPS_CERT : path.join(__dirname, '..', HTTPS_CERT);
  try {
    const key = fs.readFileSync(keyPath);
    const cert = fs.readFileSync(certPath);
    server = createServer({ key, cert }, app);
  } catch (e) {
    console.warn('HTTPS certificate error, falling back to HTTP:', e.message);
    server = createHttpServer(app);
  }
    } else {
  server = createHttpServer(app);
}

const io = new Server(server, {
  cors: DEV_CORS ? { origin: true, credentials: true } : { origin: ALLOWED_ORIGINS, credentials: true }
});

const onlineUsers = new Set();
const userSockets = new Map();

function broadcastPresence() {
  io.emit('presence', { online: Array.from(onlineUsers) });
}

io.on('connection', (socket) => {
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.sub;
      onlineUsers.add(decoded.sub);
      userSockets.set(decoded.sub, socket);
      broadcastPresence();
      socket.emit('authenticated');
    } catch {
      socket.emit('auth_err');
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      userSockets.delete(socket.userId);
      broadcastPresence();
    }
  });

  socket.on('message', (data) => {
    if (!socket.userId) return;
    const { chatId, text, attachmentUrl, replyTo, forwardFrom, threadId, stickerId } = data || {};
    const chat = DB.chats.find(c => c.id === chatId && c.members.includes(socket.userId));
    if (!chat) return;
    
    const message = {
      id: uuidv4(),
      chatId,
      senderId: socket.userId,
      text: text || '',
      attachmentUrl: attachmentUrl || null,
      replyTo: replyTo || null,
      forwardFrom: forwardFrom || null,
      threadId: threadId || null,
      stickerId: stickerId || null,
      createdAt: Date.now()
    };
    
    DB.messages.push(message);
    chat.lastMessage = message;
    saveFileDB();
    
    io.emit('message', message);
  });

  socket.on('typing', (data) => {
    if (!socket.userId) return;
    socket.broadcast.emit('typing', { chatId: data.chatId, userId: socket.userId, isTyping: data.isTyping });
  });
});

// ========== Запуск сервера ==========
server.listen(PORT, () => {
  // #region agent log
  safeDebugLog('index.js:1475', 'Server started', {port:PORT,https:USE_HTTPS,env:NODE_ENV}, 'B');
  // #endregion
  console.log(`Server running on ${USE_HTTPS ? 'https' : 'http'}://localhost:${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  if (NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-change-in-production') {
    console.warn('WARNING: Using default JWT_SECRET in production!');
  }
});
