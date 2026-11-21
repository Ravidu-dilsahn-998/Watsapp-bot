/**
 * IP DILSAHN - tiny JSON database
 * ------------------------------------------------------------------
 * Zero native dependencies, safe writes (write temp file + rename),
 * automatic defaults, and deep-merge of the settings document so new
 * options always appear even on old data folders.
 */

import fs from 'fs';
import path from 'path';
import config from '../config.js';

const readJson = (file, fallback) => {
  try {
    if (!fs.existsSync(file)) return structuredClone(fallback);
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return { ...structuredClone(fallback), ...parsed };
    return structuredClone(fallback);
  } catch (err) {
    console.log(`⚠️  Could not read ${path.basename(file)}: ${err.message}`);
    return structuredClone(fallback);
  }
};

const writeJson = (file, data) => {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.log(`⚠️  Could not write ${path.basename(file)}: ${err.message}`);
    return false;
  }
};

/* ------------------------------------------------------------------ */
/* Default documents                                                   */
/* ------------------------------------------------------------------ */

export const defaultSettings = {
  botName: config.bot.name,
  prefix: config.bot.prefix,
  ownerNumbers: config.owner.numbers,
  ownerName: config.owner.name,
  public: config.bot.public,
  features: {
    autoReply: true,
    autoRead: false,
    autoViewStatus: false,
    autoReactStatus: false,
    antiLink: false,
    antiSpam: false,
    antiDelete: false,
    welcome: true,
    goodbye: true,
    antiCall: false,
    keepOnline: false,
    autoSticker: false,
    chatBot: false,
  },
  moderation: {
    /** 'delete' | 'warn' | 'kick' */
    antiLinkAction: 'delete',
    /** Domains allowed even when antiLink is on (e.g. your own site) */
    linkWhitelist: ['chat.whatsapp.com'],
    warnLimit: 3,
  },
  messages: {
    welcome:
      '👋 Welcome @user to *@group*!\n\nYou are member #@count.\nEnjoy your stay 🎉',
    goodbye: '😢 Goodbye @user, we will miss you!',
  },
  presence: {
    /** 'available' | 'unavailable' | 'composing' | 'recording' | 'paused' */
    status: 'available',
  },
  protectedJids: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const defaultUsers = {
  /** number (digits only) -> record */
  users: {},
  /** numbers with sudo (can moderate, cannot reset the bot) */
  sudo: [],
  /** premium numbers */
  premium: [],
  bans: [],
};

export const defaultGroups = {
  /** group jid -> record */
  groups: {},
};

export const defaultStats = {
  totalCommands: 0,
  perCommand: {},
  perUser: {},
  messagesSeen: 0,
  downloads: 0,
  startedAt: new Date().toISOString(),
  lastCommandAt: null,
  sessions: 0,
  pairingCodes: 0,
};

export const defaultTriggers = {
  /** trigger text (lowercase) -> reply */
  triggers: {
    hi: '👋 Hello and welcome! Type the menu command to see everything I can do.',
    hello: '👋 Hello! How can *IP DILSAHN* help you today?',
    '.alive': null,
  },
  /** default auto-replies */
  enabled: true,
  replies: [
    { match: 'good morning', reply: '🌅 Good morning! Have a productive day.' },
    { match: 'good night', reply: '🌙 Good night! Sleep well.' },
    { match: 'thank you', reply: '🙌 You are most welcome!' },
  ],
};

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

class JsonStore {
  constructor(file, defaults) {
    this.file = file;
    this.defaults = defaults;
    this.data = readJson(file, defaults);
    this.persist();
  }

  persist() {
    this.data.updatedAt = new Date().toISOString();
    return writeJson(this.file, this.data);
  }

  get(key, fallback) {
    return this.data[key] ?? fallback;
  }

  set(key, value, persist = true) {
    this.data[key] = value;
    if (persist) this.persist();
    return value;
  }

  update(fn) {
    fn(this.data);
    this.persist();
    return this.data;
  }
}

export const settingsStore = new JsonStore(config.files.settings, defaultSettings);
export const usersStore = new JsonStore(config.files.users, defaultUsers);
export const groupsStore = new JsonStore(config.files.groups, defaultGroups);
export const statsStore = new JsonStore(config.files.stats, defaultStats);
export const triggersStore = new JsonStore(config.files.triggers, defaultTriggers);

/* Keep the users document shaped correctly if it was edited by hand */
usersStore.data.users ||= {};
usersStore.data.sudo ||= [];
usersStore.data.premium ||= [];
usersStore.data.bans ||= [];

/* Merge owner numbers from the environment into settings so the dashboard,
   .owner, .listusers and the connection alert all agree. */
try {
  const envOwners = config.owner.numbers || [];
  if (envOwners.length) {
    const current = new Set((settingsStore.data.ownerNumbers || []).map((n) => String(n).replace(/[^0-9]/g, '')));
    let changed = false;
    for (const raw of envOwners) {
      const n = String(raw).replace(/[^0-9]/g, '');
      if (n && !current.has(n)) {
        current.add(n);
        changed = true;
      }
    }
    if (changed) {
      settingsStore.data.ownerNumbers = [...current];
      settingsStore.persist();
    }
  }
} catch {
  /* ignore */
}
settingsStore.data.features = { ...defaultSettings.features, ...(settingsStore.data.features || {}) };
settingsStore.data.moderation = { ...defaultSettings.moderation, ...(settingsStore.data.moderation || {}) };

export const flushAll = () => {
  settingsStore.persist();
  usersStore.persist();
  groupsStore.persist();
  statsStore.persist();
  triggersStore.persist();
};

/* Flush to disk before a restart so nothing is lost */
let flushTimer = null;
export const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      flushAll();
    } catch {
      /* ignore */
    }
  }, 1500);
  flushTimer.unref?.();
};

export { readJson, writeJson };
