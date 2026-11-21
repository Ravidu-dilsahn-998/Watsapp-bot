/**
 * IP DILSAHN - shared helpers used by the core and every command
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import config from '../config.js';
import { settingsStore, statsStore } from './db.js';

export const execFileAsync = promisify(execFile);

/* ------------------------------- time ------------------------------ */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const now = () => new Date();

export const fmtDate = (date = new Date(), options = {}) =>
  date.toLocaleString(config.bot.locale, {
    timeZone: config.bot.timezone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    ...options,
  });

export const fmtTime = (date = new Date()) =>
  date.toLocaleTimeString(config.bot.locale, { timeZone: config.bot.timezone, hour12: true });

export const fmtDuration = (ms = 0) => {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
};

export const fmtBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/** Seconds -> 3:45 / 1:02:33 */
export const fmtSeconds = (sec = 0) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};

/* ------------------------------ strings ---------------------------- */

export const escapeHtml = (str = '') =>
  String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const truncate = (str = '', max = 120, suffix = '…') =>
  String(str).length > max ? String(str).slice(0, max - suffix.length).trimEnd() + suffix : String(str);

export const titleCase = (str = '') =>
  String(str).replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

export const capitalize = (str = '') => String(str).charAt(0).toUpperCase() + String(str).slice(1);

export const randomItem = (arr = []) => arr[Math.floor(Math.random() * arr.length)];

export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export const shuffle = (arr = []) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const chunk = (arr = [], size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const isUrl = (str = '') => /^(https?:\/\/|www\.)\S+$/i.test(String(str).trim());

export const normalizeUrl = (str = '') => {
  const s = String(str).trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
};

export const extractUrl = (text = '') => {
  const m = String(text).match(/https?:\/\/[^\s<>"']+/i) || String(text).match(/www\.[^\s<>"']+/i);
  return m ? normalizeUrl(m[0]) : '';
};

export const uuid = () => crypto.randomUUID();
export const shortId = (len = 6) => crypto.randomBytes(16).toString('hex').slice(0, len);

/* ------------------------------ numbers ---------------------------- */

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const safeInt = (value, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export const bytesToMb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

/* ------------------------------- files ----------------------------- */

export const tmpPath = (ext = '') => {
  const name = `dilsahn-${Date.now()}-${shortId(8)}${ext ? `.${ext.replace(/^\./, '')}` : ''}`;
  return path.join(config.paths.tmp, name);
};

export const ensureTmp = () => {
  try {
    fs.mkdirSync(config.paths.tmp, { recursive: true });
  } catch {
    /* ignore */
  }
  return config.paths.tmp;
};

export const cleanFile = (file) => {
  try {
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
};

export const cleanOldFiles = (maxAgeMs = 1000 * 60 * 60 * 2) => {
  try {
    ensureTmp();
    const nowMs = Date.now();
    for (const f of fs.readdirSync(config.paths.tmp)) {
      const p = path.join(config.paths.tmp, f);
      try {
        const st = fs.statSync(p);
        if (st.isFile() && nowMs - st.mtimeMs > maxAgeMs) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
};

export const fileSize = (file) => {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
};

/* ------------------------------- network --------------------------- */

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];

export const randomUA = () => randomItem(userAgents);

export const http = axios.create({
  timeout: 30000,
  maxRedirects: 6,
  headers: {
    'User-Agent': userAgents[0],
    'Accept-Language': 'en-US,en;q=0.9',
  },
  validateStatus: (s) => s >= 200 && s < 400,
});

export const getJson = async (url, options = {}) => {
  const { data } = await http.get(url, { ...options, headers: { ...options.headers, Accept: 'application/json' } });
  return data;
};

export const headInfo = async (url) => {
  try {
    const res = await axios.head(normalizeUrl(url), {
      timeout: 20000,
      maxRedirects: 8,
      headers: { 'User-Agent': randomUA() },
      validateStatus: () => true,
    });
    return {
      status: res.status,
      type: String(res.headers['content-type'] || ''),
      length: Number(res.headers['content-length'] || 0),
      url: res.request?.res?.responseUrl || normalizeUrl(url),
      headers: res.headers,
    };
  } catch (err) {
    return { status: 0, type: '', length: 0, error: err.message };
  }
};

/* ------------------------------- system ---------------------------- */

export const getUptime = () => process.uptime() * 1000;

export const getSystemInfo = () => {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model?.trim() || 'unknown',
    totalMem: total,
    freeMem: free,
    usedMem: total - free,
    memPercent: Math.round(((total - free) / total) * 100),
    processMem: process.memoryUsage().rss,
    uptime: getUptime(),
    node: process.version,
  };
};

/* ------------------------------ settings --------------------------- */

export const getPrefix = () => settingsStore.data.prefix || config.bot.prefix;

export const getBotName = () => settingsStore.data.botName || config.bot.name;

export const isPublic = () => settingsStore.data.public ?? config.bot.public;

export const featureOn = (name) => !!settingsStore.data.features?.[name];

/* -------------------------------- stats ---------------------------- */

export const recordCommand = (command, sender) => {
  const s = statsStore.data;
  s.totalCommands = (s.totalCommands || 0) + 1;
  s.perCommand[command] = (s.perCommand[command] || 0) + 1;
  if (sender) s.perUser[sender] = (s.perUser[sender] || 0) + 1;
  s.lastCommandAt = new Date().toISOString();
};

export const topCommands = (limit = 10) =>
  Object.entries(statsStore.data.perCommand || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

/* ------------------------------- misc ------------------------------ */

/** Run a promise with a hard timeout */
export const withTimeout = (promise, ms, label = 'Operation') =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });

/** Format an error for WhatsApp replies */
export const errorText = (err) => {
  const msg = String(err?.message || err || 'Unknown error');
  return msg.length > 300 ? `${msg.slice(0, 300)}…` : msg;
};

/** Build `*text*` WhatsApp bold */
export const bold = (t) => `*${t}*`;
export const italic = (t) => `_${t}_`;
export const mono = (t) => `\`\`\`${t}\`\`\``;

/** Progress bar for downloads */
export const progressBar = (percent, size = 12) => {
  const filled = Math.round(clamp(percent, 0, 100) / (100 / size));
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
};

/** Points at a random line in a numeric file? (kept simple + readable) */
export const jsonPreview = (obj) => JSON.stringify(obj, null, 2).slice(0, 1500);
