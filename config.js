/**
 * IP DILSAHN - central configuration
 * ------------------------------------------------------------------
 * Everything here is overridable through environment variables so the
 * same code can run on Koyeb / Render / Railway / a VPS or Termux.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = process.env;

/** Parse "94712345678,94776543210" -> ["94712345678", "94776543210"] */
const numberList = (value) =>
  String(value || '')
    .split(/[,;\s]+/)
    .map((n) => n.replace(/[^0-9]/g, ''))
    .filter(Boolean);

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
};

const int = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

const DATA_DIR = path.resolve(env.DATA_DIR || path.join(__dirname, 'data'));
const AUTH_DIR = path.resolve(env.AUTH_DIR || path.join(__dirname, 'auth'));
const SESSION_DIR = path.resolve(env.SESSION_DIR || path.join(__dirname, 'session'));
const TMP_DIR = path.resolve(env.TMP_DIR || path.join(__dirname, '.tmp'));

for (const dir of [DATA_DIR, AUTH_DIR, SESSION_DIR, TMP_DIR]) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ignore - folder may be read-only on some hosts */
  }
}

/* ------------------------------------------------------------------ */
/* Bot identity                                                        */
/* ------------------------------------------------------------------ */

const config = {
  bot: {
    name: env.BOT_NAME || 'IP DILSAHN',
    shortName: env.BOT_SHORT_NAME || 'DILSAHN',
    version: '1.0.0',
    creator: env.BOT_CREATOR || 'IP DILSAHN',
    prefix: env.BOT_PREFIX || '.',
    /** Extra command prefixes, e.g. ". , /" - first entry is the "main" one */
    extraPrefixes: String(env.BOT_EXTRA_PREFIXES || ',')
      .split('')
      .filter(Boolean),
    timezone: env.BOT_TIMEZONE || 'Asia/Colombo',
    locale: env.BOT_LOCALE || 'en-GB',
    public: bool(env.BOT_PUBLIC, true),
    /** React with an emoji on every command (empty string disables) */
    commandReaction: env.BOT_INFO_REACTION ?? '⚡',
    /** Send a "typing / recording" presence while processing commands */
    typingPresence: bool(env.BOT_TYPING_PRESENCE, true),
  },

  owner: {
    /** Numbers that always have full control (owner level) */
    numbers: numberList(env.OWNER_NUMBER || ''),
    /** Optional longer owner name shown in menus */
    name: env.OWNER_NAME || 'IP DILSAHN Owner',
  },

  server: {
    port: int(env.PORT, 3000),
    host: env.HOST || '0.0.0.0',
    /** Protect the dashboard + pairing endpoint */
    password: env.DASHBOARD_PASSWORD || '',
    /** Optional API key for /api endpoints (falls back to dashboard password) */
    apiKey: env.API_KEY || '',
    trustProxy: bool(env.TRUST_PROXY, true),
  },

  paths: {
    root: __dirname,
    data: DATA_DIR,
    auth: AUTH_DIR,
    session: SESSION_DIR,
    tmp: TMP_DIR,
    assets: path.join(__dirname, 'assets'),
    public: path.join(__dirname, 'public'),
    commands: path.join(__dirname, 'commands'),
  },

  files: {
    settings: path.join(DATA_DIR, 'settings.json'),
    users: path.join(DATA_DIR, 'users.json'),
    groups: path.join(DATA_DIR, 'groups.json'),
    stats: path.join(DATA_DIR, 'stats.json'),
    triggers: path.join(DATA_DIR, 'auto-replies.json'),
  },

  limits: {
    /** Largest file a downloader command may produce (MB) */
    maxDownloadMb: int(env.MAX_DOWNLOAD_MB, 120),
    /** Largest remote file .fetch may stream (MB) */
    maxFetchMb: int(env.MAX_FETCH_MB, 100),
    /** Command timeout in seconds */
    commandTimeout: int(env.COMMAND_TIMEOUT, 180),
    /** How many commands a single user can run per minute (0 = off) */
    ratePerMinute: int(env.RATE_LIMIT_PER_MINUTE, 45),
    /** Cooldown for heavy downloader commands in seconds */
    downloadCooldown: int(env.DOWNLOAD_COOLDOWN, 8),
  },

  session: {
    /** Reconnect backoff (ms) */
    reconnectDelay: int(env.RECONNECT_DELAY, 5000),
    /** Max auth folder size before warning (MB) */
    maxAuthSizeMb: 1.5,
    /** Print a terminal QR as backup when no pairing code is requested */
    terminalQr: bool(env.TERMINAL_QR, true),
  },

  logLevel: env.LOG_LEVEL || 'info',
};

export default config;
export { numberList, bool, int };
