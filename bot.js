/**
 * IP DILSAHN - WhatsApp core (Baileys)
 * ------------------------------------------------------------------
 * Responsibilities:
 *  - create / reconnect the socket safely (no double-connect loops)
 *  - persist credentials, expose pairing code requests to the dashboard
 *  - instant "connected" notification to the owner chat
 *  - incoming message pipeline: security -> triggers -> command router
 *  - feature hooks: auto-read, auto-view status, anti-link, anti-call,
 *    welcome / goodbye, auto-reply triggers, chat-bot mode
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  proto,
  jidNormalizedUser,
  isJidGroup,
  normalizeMessageContent,
  getContentType,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import config from '../config.js';
import logger from './logger.js';
import { settingsStore, statsStore, usersStore, writeJson } from './db.js';
import {
  roleOf,
  isBannedNumber,
  jidToNumber,
  isOwnerNumber,
} from './users.js';
import {
  getPrefix,
  getBotName,
  isPublic,
  featureOn,
  fmtDate,
  recordCommand,
  sleep,
  errorText,
  truncate,
} from './helpers.js';
import { getCommand, roleAllowed, countCommands } from './registry.js';
import { buildContext } from './context.js';
import { handleMessageFeatures, sendGroupEvent } from './features.js';
import { flushAll } from './db.js';

/* ------------------------------------------------------------------ */
/* State (shared with the web dashboard)                               */
/* ------------------------------------------------------------------ */

export const state = {
  status: 'disconnected', // disconnected | pairing | connecting | connected
  connected: false,
  qr: '',
  pairingCode: '',
  pairingNumber: '',
  lastError: '',
  botJid: '',
  botNumber: '',
  pushName: '',
  startedAt: Date.now(),
  connectedAt: null,
  reconnectAttempts: 0,
  reconnecting: false,
  commandsHandled: 0,
  messagesSeen: 0,
  lastMessageAt: null,
  lastPairingAt: null,
  version: null,
};

export const bus = new EventEmitter();
bus.setMaxListeners(50);

let sock = null;
let connectionInFlight = false;
let reconnectTimer = null;
let manualClose = false;
let pairingRequestedFor = '';
let latestQr = '';
let commandQueue = Promise.resolve();
const cooldowns = new Map();

export const getSocket = () => sock;
export const isConnected = () => state.connected && !!sock;

const setStatus = (next, extra = {}) => {
  if (state.status !== next) {
    state.status = next;
    bus.emit('status', { status: next, ...extra });
    logger.info(`Connection status -> ${next}`);
  }
  bus.emit('state', state);
};

const writeStateSnapshot = () => {
  try {
    writeJson(path.join(config.paths.data, 'state.json'), {
      status: state.status,
      connected: state.connected,
      botNumber: state.botNumber,
      botJid: state.botJid,
      pushName: state.pushName,
      connectedAt: state.connectedAt,
      lastError: state.lastError,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------ */
/* JID helpers                                                         */
/* ------------------------------------------------------------------ */

export const jidToUser = (jid = '') => String(jid).split('@')[0].split(':')[0];

export const toJid = (number = '') => {
  const n = String(number).replace(/[^0-9]/g, '');
  return n ? `${n}@s.whatsapp.net` : '';
};

/**
 * Resolve a human input (raw number, jid, mention, quoted sender) to a JID.
 * Works with phone-based and LID-based addresses.
 */
export const resolveTargetJid = async (input = '') => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (raw.includes('@')) {
    const jid = raw.includes('@s.whatsapp.net') || raw.includes('@g.us') || raw.includes('@lid')
      ? raw
      : `${raw.split('@')[0]}@s.whatsapp.net`;
    return jidNormalizedUser ? jid : jid;
  }
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length > 12) return `${digits}@lid`;
  return `${digits}@s.whatsapp.net`;
};

/* ------------------------------------------------------------------ */
/* Socket creation                                                     */
/* ------------------------------------------------------------------ */

const makeLogger = () => pino({ level: 'silent' }); // silent: keeps the console clean

const reconnect = (reason, delay = config.session.reconnectDelay) => {
  if (manualClose) return;
  if (reconnectTimer) return;
  state.reconnecting = true;
  state.reconnectAttempts += 1;
  const wait = Math.min(delay * Math.max(1, state.reconnectAttempts), 60000);
  logger.warn(`Reconnecting in ${Math.round(wait / 1000)}s (${reason})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    state.reconnecting = false;
    startSocket().catch((err) => logger.error('Reconnect failed:', err.message));
  }, wait);
  reconnectTimer.unref?.();
};

export const startSocket = async () => {
  if (connectionInFlight) return sock;
  connectionInFlight = true;

  try {
    const { state: authState, saveCreds } = await useMultiFileAuthState(config.paths.auth);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1035194821] }));
    state.version = version.join('.');

    sock = makeWASocket({
      version,
      logger: makeLogger(),
      auth: {
        creds: authState.creds,
        keys: authState.keys,
      },
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: !!settingsStore.data.features?.keepOnline,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      getMessage: async (key) => {
        try {
          const msg = recentMessages.get(key.id);
          return msg?.message || undefined;
        } catch {
          return undefined;
        }
      },
      cachedGroupMetadata: async (jid) => {
        try {
          return sock?.groupMetadata ? await sock.groupMetadata(jid) : undefined;
        } catch {
          return undefined;
        }
      },
    });

    state.sock = sock;
    manualClose = false;
    setStatus(authState.creds?.registered ? 'connecting' : 'disconnected');

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      try {
        await onConnectionUpdate(update, authState);
      } catch (err) {
        logger.error('connection.update handler:', err.message);
      }
    });

    sock.ev.on('messages.upsert', (event) => {
      handleUpsert(event).catch((err) => logger.error('messages.upsert:', err.message));
    });

    sock.ev.on('messages.update', (updates) => {
      handleMessageUpdates(updates).catch((err) => logger.debug('messages.update:', err.message));
    });

    sock.ev.on('call', (calls) => {
      handleCalls(calls).catch((err) => logger.debug('call event:', err.message));
    });

    sock.ev.on('group-participants.update', (event) => {
      handleGroupParticipants(event).catch((err) => logger.debug('group-participants:', err.message));
    });

    sock.ev.on('error', (err) => {
      logger.debug('socket error:', err.message);
    });

    return sock;
  } catch (err) {
    state.lastError = err.message;
    logger.error('Socket start failed:', err.message);
    reconnect('startup error', 8000);
    return null;
  } finally {
    connectionInFlight = false;
  }
};

/* ------------------------------------------------------------------ */
/* Connection lifecycle                                                */
/* ------------------------------------------------------------------ */

const onConnectionUpdate = async (update, authState) => {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    latestQr = qr;
    state.qr = qr;
    if (config.session.terminalQr && !authState.creds?.registered && !pairingRequestedFor) {
      console.log('\n📱 Scan this QR with WhatsApp > Linked devices (or use the dashboard pairing code):\n');
      qrcode.generate(qr, { small: true });
    }
    bus.emit('qr', qr);
    if (!authState.creds?.registered) setStatus('pairing');
  }

  if (connection === 'connecting') {
    state.reconnecting = false;
    if (authState.creds?.registered) setStatus('connecting');
  }

  if (connection === 'open') {
    state.connected = true;
    state.connectedAt = Date.now();
    state.reconnectAttempts = 0;
    state.reconnecting = false;
    state.lastError = '';
    state.qr = '';
    state.botJid = jidNormalizedUser(sock.user?.id || '');
    state.botNumber = jidToUser(state.botJid);
    state.pushName = sock.user?.name || '';
    setStatus('connected');
    writeStateSnapshot();
    statsStore.data.sessions = (statsStore.data.sessions || 0) + 1;
    statsStore.persist();

    logger.success(`Connected as ${state.pushName || getBotName()} (${state.botNumber})`);

    // Instant connection notification (owner chat) + owner alert
    await sleep(1200);
    sendConnectedNotice().catch((err) => logger.debug('connected notice:', err.message));
    sendOwnerAlert().catch((err) => logger.debug('owner alert:', err.message));
  }

  if (connection === 'close') {
    state.connected = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const reason = lastDisconnect?.error?.message || `code ${statusCode}`;
    state.lastError = reason;
    writeStateSnapshot();

    logger.warn(`Connection closed: ${reason}`);

    if (statusCode === DisconnectReason.loggedOut) {
      setStatus('disconnected');
      logger.error('Session logged out. Delete the auth folder (or use the dashboard reset) and pair again.');
      state.qr = '';
    } else if (statusCode === DisconnectReason.restartRequired) {
      setStatus('connecting');
      setTimeout(() => startSocket().catch(() => {}), 1000).unref?.();
    } else {
      setStatus('disconnected');
      reconnect(reason || 'connection closed');
    }
  }
};

/* ------------------------------------------------------------------ */
/* Pairing code                                                        */
/* ------------------------------------------------------------------ */

export const requestPairing = async (rawNumber) => {
  const number = String(rawNumber || '').replace(/[^0-9]/g, '');
  if (!/^[1-9][0-9]{6,14}$/.test(number)) {
    throw new Error('Enter the phone number with country code (digits only), e.g. 94712345678.');
  }
  if (number.length < 8) throw new Error('Phone number is too short. Include the country code.');

  if (!sock) throw new Error('Bot is not initialised yet. Please wait a moment and try again.');
  if (state.connected) throw new Error('Bot is already connected. Disconnect it first before pairing another number.');

  // Allow one code per number at a time
  if (pairingRequestedFor === number && state.pairingCode && Date.now() - state.lastPairingAt < 20000) {
    return { code: state.pairingCode, number };
  }

  pairingRequestedFor = number;
  state.pairingNumber = number;
  setStatus('pairing');
  state.pairingCode = '';

  await sleep(1500); // let the socket finish its socket handshake

  const code = await sock.requestPairingCode(number);
  state.pairingCode = code;
  state.lastPairingAt = Date.now();
  statsStore.data.pairingCodes = (statsStore.data.pairingCodes || 0) + 1;
  statsStore.persist();
  writeStateSnapshot();
  bus.emit('pairing', { code, number });
  logger.success(`Pairing code for ${number}: ${code}`);
  return { code, number };
};

export const resetSession = async () => {
  try {
    if (sock) {
      try {
        await sock.logout();
      } catch {
        /* ignore */
      }
      try {
        sock.end?.();
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  sock = null;
  state.connected = false;
  state.pairingCode = '';
  state.qr = '';
  setStatus('disconnected');
  try {
    for (const f of fs.readdirSync(config.paths.auth)) {
      if (f === 'creds.json') continue;
      fs.unlinkSync(path.join(config.paths.auth, f));
    }
    fs.rmSync(config.paths.auth, { recursive: true, force: true });
    fs.mkdirSync(config.paths.auth, { recursive: true });
    logger.warn('Auth session wiped. Restarting socket — request a new pairing code.');
  } catch (err) {
    logger.error('resetSession:', err.message);
  }
  await sleep(500);
  await startSocket();
  return true;
};

/* ------------------------------------------------------------------ */
/* The instant connection message                                      */
/* ------------------------------------------------------------------ */

export const buildConnectedNotice = () => {
  const cmdCount = countCommands();
  const prefix = getPrefix();
  const botName = getBotName();
  const ownerMentions = (settingsStore.data.ownerNumbers || config.owner.numbers || []).map((n) => `${n}@s.whatsapp.net`);

  const text =
    `╭━━〔 *${botName}* 〕━━╮\n` +
    `┃ ✅ *CONNECTED SUCCESSFULLY*\n` +
    `┃\n` +
    `┃ 🟢 Status   : *Online*\n` +
    `┃ 🤖 Bot      : *${botName}*\n` +
    `┃ 🔑 Prefix   : *${prefix}*\n` +
    `┃ 📦 Commands : *${cmdCount}*\n` +
    `┃ 📱 Number   : *+${state.botNumber || 'unknown'}*\n` +
    `┃ ⚙️ Version  : *v${config.bot.version}*\n` +
    `┃ 🕒 Time     : *${fmtDate()}*\n` +
    `┃\n` +
    `┃ Your bot is live and ready.\n` +
    `┃ Type *${prefix}menu* to open the menu.\n` +
    `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `_Powered by Baileys • ${botName}_`;

  return { text, mentions: ownerMentions };
};

/** Sends the connected notice to the bot's own "message yourself" chat */
export const sendConnectedNotice = async () => {
  if (!sock || !state.connected) return null;
  const target = state.botJid || toJid(state.botNumber);
  if (!target) return null;
  const { text, mentions } = buildConnectedNotice();
  try {
    await sock.sendMessage(target, { text, mentions });
    logger.success('Connected message delivered to the bot chat.');
    return true;
  } catch (err) {
    logger.warn('Could not send connected message:', err.message);
    return false;
  }
};

/** Also notify every configured owner number so they know it is live */
export const sendOwnerAlert = async () => {
  if (!sock || !state.connected) return;
  const owners = (settingsStore.data.ownerNumbers || config.owner.numbers || [])
    .map((n) => String(n).replace(/[^0-9]/g, ''))
    .filter((n) => n && n !== state.botNumber);

  if (!owners.length) return;
  const { text } = buildConnectedNotice();
  for (const owner of owners) {
    try {
      await sock.sendMessage(toJid(owner), { text: `🔔 *Owner alert*\n\n${text}` });
    } catch (err) {
      logger.debug(`owner alert to ${owner} failed: ${err.message}`);
    }
  }
};

/* ------------------------------------------------------------------ */
/* Message handling                                                    */
/* ------------------------------------------------------------------ */

const recentMessages = new Map(); // message id -> { message, sender, chat }

const rememberMessage = (id, info) => {
  if (!id) return;
  recentMessages.set(id, info);
  if (recentMessages.size > 400) {
    const first = recentMessages.keys().next().value;
    recentMessages.delete(first);
  }
};

const handleUpsert = async (event) => {
  const { messages = [], type } = event;
  if (!messages.length) return;
  if (type !== 'notify' && type !== 'append') return;

  for (const raw of messages) {
    try {
      await processIncoming(raw, type);
    } catch (err) {
      logger.error('processIncoming:', err.message);
    }
  }
};

const isBannedJid = (jid = '') => {
  if (jid.endsWith('@g.us') || jid === 'status@broadcast') return false;
  return isBannedNumber(jidToUser(jid));
};

/**
 * Turn a message key into the sender's *phone* identity even when the
 * chat is addressed with a LID (@lid) JID.
 */
export const getSenderPhone = (msg) => {
  const key = msg.key || {};
  const candidates = [
    key.participantAlt,
    key.remoteJidAlt,
    key.participant,
    key.remoteJid,
  ].filter(Boolean);

  for (const c of candidates) {
    const jid = String(c);
    if (jid.endsWith('@s.whatsapp.net')) return jidToUser(jid);
    if (jid.endsWith('@lid')) continue;
  }
  const fallback = jidToUser(String(key.participant || key.remoteJid || ''));
  return fallback;
};

const processIncoming = async (msg, type) => {
  if (!msg.message) return;
  const chatId = msg.key?.remoteJid || '';
  if (!chatId) return;

  state.messagesSeen += 1;
  statsStore.data.messagesSeen = (statsStore.data.messagesSeen || 0) + 1;
  state.lastMessageAt = Date.now();

  // Status updates -> auto view
  if (chatId === 'status@broadcast') {
    if (featureOn('autoViewStatus') && sock) {
      try {
        await sock.readMessages([msg.key]);
      } catch {
        /* ignore */
      }
    }
    if (featureOn('autoReactStatus') && sock && msg.key?.participant) {
      try {
        await sock.sendMessage(
          chatId,
          { react: { text: '❤️', key: msg.key } },
          { statusJidList: [msg.key.participant] }
        );
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const fromMe = !!msg.key?.fromMe;
  if (fromMe) {
    rememberMessage(msg.key.id, msg);
    return;
  }

  if (isBannedJid(chatId)) return;

  const senderJid = isJidGroup(chatId)
    ? String(msg.key.participant || msg.key.participantAlt || '')
    : String(chatId);
  const senderNumber = getSenderPhone(msg);

  if (isBannedJid(senderJid)) return;

  rememberMessage(msg.key.id, msg);

  // auto-read receipts
  if (featureOn('autoRead') && sock) {
    try {
      await sock.readMessages([msg.key]);
    } catch {
      /* ignore */
    }
  }

  const ctx = await buildContext({ sock, msg, chatId, senderJid, senderNumber });

  // Feature hooks that are not commands (triggers, anti-link, welcome handled elsewhere)
  const handledByFeature = await handleMessageFeatures(ctx);
  if (handledByFeature === false) return;

  await routeCommand(ctx);
};

/* ------------------------------------------------------------------ */
/* Command router                                                      */
/* ------------------------------------------------------------------ */

const isOnCooldown = (key, seconds) => {
  if (!seconds) return 0;
  const last = cooldowns.get(key) || 0;
  const remaining = last + seconds * 1000 - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
};

const markCooldown = (key) => cooldowns.set(key, Date.now());

const parseCommand = (text = '', prefix = '.') => {
  const prefixes = [prefix, ...(config.bot.extraPrefixes || [])].filter(Boolean);
  const trimmed = String(text).trim();
  const used = prefixes.find((p) => p !== ' ' && trimmed.startsWith(p));
  if (!used) return null;
  const body = trimmed.slice(used.length).trim();
  if (!body) return null;
  const [name, ...rest] = body.split(/\s+/);
  return {
    raw: trimmed,
    prefix: used,
    name: name.toLowerCase(),
    commandName: name.toLowerCase(),
    args: rest,
    argText: rest.join(' '),
  };
};

const sendHumanDelay = async (ctx) => {
  if (!config.bot.typingPresence) return;
  try {
    await ctx.sock.sendPresenceUpdate('composing', ctx.chatId);
  } catch {
    /* ignore */
  }
};

const stopTyping = async (ctx) => {
  if (!config.bot.typingPresence) return;
  try {
    await ctx.sock.sendPresenceUpdate('paused', ctx.chatId);
  } catch {
    /* ignore */
  }
};

const routeCommand = async (ctx) => {
  const prefix = getPrefix();
  const parsed = parseCommand(ctx.bodyText, prefix);
  if (!parsed) return;

  const command = getCommand(parsed.name);
  if (!command) {
    // Silent: unknown commands are not an error worth replying to.
    ctx.log?.('unknown command:', parsed.name);
    return;
  }

  // scope check
  if (command.scope === 'group' && !ctx.isGroup) {
    return ctx.reply(`❗ *${command.name}* only works inside groups.`);
  }
  if (command.scope === 'private' && ctx.isGroup) {
    return ctx.reply(`❗ *${command.name}* only works in private chats.`);
  }

  // role check
  if (command.role && !roleAllowed(ctx.role, command.role)) {
    const needed = command.role;
    return ctx.reply(
      `🔒 *Access denied*\n\n\`${command.name}\` requires *${needed}* access.\nYou are *${ctx.role}*.`
    );
  }

  // private-bot guard: unless public, only known roles may use commands
  if (!isPublic() && ctx.role === 'guest' && !isOwnerNumber(ctx.senderNumber)) {
    return ctx.reply(
      `🔒 *${getBotName()}* is a private bot.\n\nYour number *+${ctx.senderNumber}* is not authorised.\nAsk the owner to add you with \`.adduser\`.`
    );
  }

  // cooldown
  const cd = isOnCooldown(`${ctx.senderNumber}:${command.name}`, command.cooldown);
  if (cd) return ctx.reply(`⏳ Slow down — \`${command.name}\` is cooling down for *${cd}s*.`);

  markCooldown(`${ctx.senderNumber}:${command.name}`);

  // stats + reaction
  recordCommand(command.name, ctx.senderNumber);
  state.commandsHandled += 1;
  if (config.bot.commandReaction) {
    try {
      await ctx.react(config.bot.commandReaction);
    } catch {
      /* ignore */
    }
  }

  await sendHumanDelay(ctx);

  const started = Date.now();
  try {
    await Promise.race([
      command.run(ctx),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`Command timed out after ${config.limits.commandTimeout}s`)), config.limits.commandTimeout * 1000)
      ),
    ]);
  } catch (err) {
    logger.error(`Command .${command.name} failed: ${errorText(err)}`);
    try {
      await ctx.reply(
        `❌ *Command failed*\n\n*Command:* \`${command.name}\`\n*Error:* ${truncate(errorText(err), 200)}\n\n_Try again in a moment._`
      );
    } catch {
      /* ignore */
    }
  } finally {
    await stopTyping(ctx);
    ctx.log?.(`↳ .${command.name} took ${Date.now() - started}ms`);
  }
};

/* ------------------------------------------------------------------ */
/* Anti-delete + calls + group participants                            */
/* ------------------------------------------------------------------ */

const handleMessageUpdates = async (updates = []) => {
  if (!featureOn('antiDelete') || !sock) return;
  for (const u of updates) {
    const revoked = u.update?.message === null && u.update?.messageStubType === 1;
    if (!revoked) continue;
    const id = u.key?.id;
    const cached = recentMessages.get(id);
    if (!cached) continue;
    try {
      await sock.sendMessage(cached.chatId || u.key.remoteJid, {
        text:
          `🕵️ *Anti-delete*\n\n` +
          `*Sender:* ${cached.pushName || jidToUser(cached.sender)}\n` +
          `*Chat:* ${cached.chatId}\n\n` +
          `_The deleted message was saved above._`,
        ...(cached.message ? {} : {}),
      });
      if (cached.message) {
        await sock.sendMessage(cached.chatId || u.key.remoteJid, { forward: { key: cached.key, message: cached.message } });
      }
    } catch (err) {
      logger.debug('antiDelete:', err.message);
    }
  }
};

const handleCalls = async (calls = []) => {
  if (!featureOn('antiCall') || !sock) return;
  for (const call of calls) {
    if (call.status !== 'offer') continue;
    try {
      await sock.rejectCall(call.id, call.from);
      await sock.sendMessage(call.from, {
        text: `📵 Calls are not allowed.\n\nHi! I am *${getBotName()}*. Please send a text message instead.`,
      });
    } catch (err) {
      logger.debug('antiCall:', err.message);
    }
  }
};

const handleGroupParticipants = async (event) => {
  const { id, participants, action } = event;
  if (!id || !participants?.length) return;
  try {
    await sendGroupEvent(sock, id, participants, action);
  } catch (err) {
    logger.debug('group-participants:', err.message);
  }
};

/* ------------------------------------------------------------------ */
/* Safe sending API for the dashboard + commands                       */
/* ------------------------------------------------------------------ */

export const sendText = async (jid, text, options = {}) => {
  if (!sock || !state.connected) throw new Error('Bot is not connected.');
  return sock.sendMessage(jid, { text, ...options });
};

export const broadcastText = async (text) => {
  const { owners, sudo, added } = { ...usersStore.data, owners: settingsStore.data.ownerNumbers || [] };
  const targets = new Set([
    ...(settingsStore.data.ownerNumbers || []),
    ...(sudo || []),
    ...Object.keys(added || {}),
  ]);
  let sent = 0;
  for (const n of targets) {
    if (!n) continue;
    try {
      await sendText(toJid(n), text);
      sent += 1;
    } catch {
      /* ignore */
    }
  }
  return sent;
};

/* ------------------------------------------------------------------ */
/* Shutdown                                                            */
/* ------------------------------------------------------------------ */

export const shutdown = async (signal = 'SIGTERM') => {
  logger.warn(`Received ${signal}. Shutting down…`);
  manualClose = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  try {
    flushAll();
  } catch {
    /* ignore */
  }
  try {
    sock?.end?.();
  } catch {
    /* ignore */
  }
  await sleep(400);
  process.exit(0);
};
