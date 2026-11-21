/**
 * IP DILSAHN - context builder
 * ------------------------------------------------------------------
 * Every command receives a rich `ctx` object:
 *
 *   ctx.sock, ctx.msg, ctx.chatId, ctx.senderJid, ctx.senderNumber
 *   ctx.pushName, ctx.role, ctx.isOwner, ctx.isSudo, ctx.isPremium
 *   ctx.isGroup, ctx.isAdmin, ctx.isBotAdmin, ctx.isSuperAdmin
 *   ctx.text, ctx.args, ctx.argText, ctx.quoted, ctx.mentions
 *   ctx.prefix, ctx.botName, ctx.group (lazy metadata)
 *   ctx.reply(), ctx.send(), ctx.react(), ctx.replyImage() ...
 *   ctx.downloadQuoted(), ctx.downloadMedia()
 */

import fs from 'fs';
import {
  downloadMediaMessage,
  getContentType,
  normalizeMessageContent,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import config from '../config.js';
import logger from './logger.js';
import {
  getBotName,
  getPrefix,
  normalizeUrl,
  extractUrl,
  shortId,
  tmpPath,
  ensureTmp,
  cleanFile,
  fmtBytes,
  truncate,
} from './helpers.js';
import { roleOf, isOwnerNumber, isSudoNumber, isPremiumNumber, jidToNumber, normalizeNumber } from './users.js';
import { settingsStore, groupsStore } from './db.js';

/* ------------------------------------------------------------------ */
/* Message content extraction                                          */
/* ------------------------------------------------------------------ */

const unwrap = (message) => {
  try {
    return normalizeMessageContent(message) || message || {};
  } catch {
    return message || {};
  }
};

export const extractBody = (msg) => {
  const m = unwrap(msg.message);
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.interactiveResponseMessage?.body?.text ||
    m.pollCreationMessage?.name ||
    ''
  );
};

export const getMediaType = (msg) => {
  const m = unwrap(msg.message);
  const type = getContentType(m);
  if (!type) return null;
  return type.replace('Message', '');
};

/* ------------------------------------------------------------------ */
/* Reply helpers                                                       */
/* ------------------------------------------------------------------ */

const mentionOf = (ctx, extra = []) => {
  const mentions = new Set([...(ctx?.mentions || []), ...extra]);
  String(ctx?.argText || '').replace(/@(\d{7,16})/g, (_, n) => {
    mentions.add(`${normalizeNumber(n)}@s.whatsapp.net`);
    return '';
  });
  return [...mentions].filter(Boolean);
};

const replyTo = (ctx, content, options = {}) => {
  const mentions = mentionOf(ctx, options.mentions || []);
  const payload = {
    ...content,
    ...(options.caption !== undefined && content.image !== undefined ? { caption: options.caption } : {}),
    ...(mentions.length && !content.react ? { mentions } : {}),
  };
  const sendOpts = {
    ...(options.quoted === false ? {} : { quoted: ctx.msg }),
    ...(options.ephemeral ? { ephemeralExpiration: options.ephemeral } : {}),
    ...(options.messageId ? { messageId: options.messageId } : {}),
  };
  return ctx.sock.sendMessage(ctx.chatId, payload, sendOpts);
};

/* ------------------------------------------------------------------ */
/* Group metadata cache                                                */
/* ------------------------------------------------------------------ */

const groupCache = new Map(); // jid -> { data, at }
const GROUP_TTL = 60_000;

export const getGroupMetadata = async (sock, jid, force = false) => {
  if (!jid?.endsWith('@g.us')) return null;
  const cached = groupCache.get(jid);
  if (!force && cached && Date.now() - cached.at < GROUP_TTL) return cached.data;
  const data = await sock.groupMetadata(jid);
  groupCache.set(jid, { data, at: Date.now() });
  return data;
};

export const invalidateGroup = (jid) => groupCache.delete(jid);

const myNumber = (sock) => jidToNumber(jidNormalizedUser(sock.user?.id || ''));
const myLid = (sock) => String(sock.user?.lid || '').split('@')[0].split(':')[0];

const participantMatches = (participant, sock, number, jid) => {
  const p = String(participant || '');
  const pNumber = p.split('@')[0].split(':')[0];
  if (!pNumber) return false;
  if (pNumber === number) return true;
  if (jid && p.split('@')[0].split(':')[0] === String(jid).split('@')[0].split(':')[0]) return true;
  const lid = myLid(sock);
  if (lid && pNumber === lid) return true;
  return false;
};

const findParticipant = (group, sock, { number, jid }) =>
  group?.participants?.find((p) => participantMatches(p.id, sock, number, jid)) || null;

const isAdminOf = (group, sock, identity) => {
  const part = findParticipant(group, sock, identity);
  return part?.admin === 'admin' || part?.admin === 'superadmin';
};

/* ------------------------------------------------------------------ */
/* Main builder                                                        */
/* ------------------------------------------------------------------ */

export const buildContext = async ({ sock, msg, chatId, senderJid, senderNumber }) => {
  const bodyText = extractBody(msg);
  const prefix = getPrefix();
  const botName = getBotName();
  const isGroup = String(chatId).endsWith('@g.us');

  const role = roleOf(senderNumber);
  const normalizedSender = normalizeNumber(senderNumber);

  const mentionedJids = (() => {
    const m = unwrap(msg.message);
    const ctxInfo =
      m.extendedTextMessage?.contextInfo ||
      m.imageMessage?.contextInfo ||
      m.videoMessage?.contextInfo ||
      m.documentMessage?.contextInfo ||
      m.stickerMessage?.contextInfo ||
      m.audioMessage?.contextInfo ||
      {};
    return ctxInfo.mentionedJid || [];
  })();

  const quotedInfo = (() => {
    const m = unwrap(msg.message);
    const ctxInfo =
      m.extendedTextMessage?.contextInfo ||
      m.imageMessage?.contextInfo ||
      m.videoMessage?.contextInfo ||
      m.documentMessage?.contextInfo ||
      m.stickerMessage?.contextInfo ||
      m.audioMessage?.contextInfo ||
      {};
    if (!ctxInfo.quotedMessage) return null;
    const quotedParticipant = ctxInfo.participant || '';
    return {
      message: ctxInfo.quotedMessage,
      stanzaId: ctxInfo.stanzaId || '',
      participant: quotedParticipant,
      sender: jidToNumber(quotedParticipant),
      senderJid: quotedParticipant,
      key: {
        remoteJid: chatId,
        fromMe: false,
        id: ctxInfo.stanzaId || '',
        participant: quotedParticipant,
      },
      /** Build a WAMessage-like object for downloadMediaMessage() */
      fake: {
        key: {
          remoteJid: chatId,
          fromMe: false,
          id: ctxInfo.stanzaId || '',
          participant: quotedParticipant,
        },
        message: ctxInfo.quotedMessage,
        messageTimestamp: msg.messageTimestamp,
      },
    };
  })();

  const mentionedNumbers = mentionedJids.map((j) => jidToNumber(j)).filter(Boolean);

  const ctx = {
    // identity
    sock,
    msg,
    chatId,
    chatType: isGroup ? 'group' : 'private',
    isGroup,
    senderJid,
    senderNumber: normalizedSender,
    senderRole: role,
    role,
    pushName: msg.pushName || 'User',
    isOwner: isOwnerNumber(normalizedSender),
    isSudo: isSudoNumber(normalizedSender) || isOwnerNumber(normalizedSender),
    isPremium: isPremiumNumber(normalizedSender),
    isGuest: role === 'guest',

    // content
    text: bodyText,
    bodyText,
    args: [],
    argText: '',
    mentions: mentionedJids,
    mentionedNumbers,
    quoted: quotedInfo,
    mediaType: getMediaType(msg),
    prefix,
    botName,
    prefixRegex: new RegExp(`^[${[prefix, ...(config.bot.extraPrefixes || [])].join('')}]`),
    settings: settingsStore.data,
    config,
    logger,

    // helpers
    toJid: (n) => `${normalizeNumber(n)}@s.whatsapp.net`,
    normalize: normalizeNumber,
    url: extractUrl(bodyText),
    normalizeUrl,

    reply: (textOrContent, options = {}) => {
      if (typeof textOrContent === 'string') return replyTo(ctx, { text: textOrContent }, options);
      return replyTo(ctx, textOrContent, options);
    },
    send: (content, options = {}) => {
      if (typeof content === 'string') return ctx.sock.sendMessage(ctx.chatId, { text: content }, options);
      return ctx.sock.sendMessage(ctx.chatId, content, options);
    },
    sendTo: (jid, content, options = {}) =>
      ctx.sock.sendMessage(jid, typeof content === 'string' ? { text: content } : content, options),
    react: (emoji, targetKey) =>
      ctx.sock.sendMessage(ctx.chatId, {
        react: { text: emoji, key: targetKey || msg.key },
      }),
    replyImage: (buffer, caption = '', options = {}) =>
      replyTo(ctx, { image: buffer, caption }, options),
    replyVideo: (buffer, caption = '', options = {}) =>
      replyTo(ctx, { video: buffer, caption }, options),
    replyAudio: (buffer, options = {}) =>
      replyTo(ctx, { audio: buffer, mimetype: 'audio/mp4', ptt: !!options.ptt }, options),
    replyDocument: (buffer, fileName, mimetype = 'application/octet-stream', options = {}) =>
      replyTo(ctx, { document: buffer, fileName, mimetype, caption: options.caption || '' }, options),
    replySticker: (buffer, options = {}) => replyTo(ctx, { sticker: buffer }, options),
    edit: (key, newText) => ctx.sock.sendMessage(ctx.chatId, { text: newText, edit: key }),
    deleteMessage: (key) => ctx.sock.sendMessage(ctx.chatId, { delete: key }),

    // permissions
    isAdmin: false,
    isBotAdmin: false,
    isSuperAdmin: false,
    group: null,
    adminCheck: async () => {
      if (!isGroup) return ctx;
      try {
        const meta = await getGroupMetadata(sock, chatId);
        ctx.group = meta;
        ctx.isAdmin = isAdminOf(meta, sock, { number: normalizedSender, jid: senderJid });
        ctx.isSuperAdmin = !!findParticipant(meta, sock, { number: normalizedSender, jid: senderJid })?.admin &&
          findParticipant(meta, sock, { number: normalizedSender, jid: senderJid })?.admin === 'superadmin';
        ctx.isBotAdmin = isAdminOf(meta, sock, { number: myNumber(sock), jid: sock.user?.id });
      } catch (err) {
        ctx.log?.(`group metadata failed: ${err.message}`);
      }
      return ctx;
    },

    // media helpers
    downloadQuoted: async (type = 'buffer') => {
      if (!quotedInfo?.message) throw new Error('Reply to a media message first.');
      return downloadMediaMessage(quotedInfo.fake, type, {}, { logger: logger.child('media'), reuploadRequest: sock.updateMediaMessage });
    },
    downloadMedia: async (type = 'buffer') => {
      if (!msg.message) throw new Error('No media found.');
      return downloadMediaMessage(msg, type, {}, { logger: logger.child('media'), reuploadRequest: sock.updateMediaMessage });
    },
    hasQuotedMedia: () => {
      if (!quotedInfo?.message) return false;
      const t = getContentType(quotedInfo.message);
      return ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(t);
    },
    hasMedia: () => {
      const t = getMediaType(msg);
      return ['image', 'video', 'audio', 'document', 'sticker'].includes(t);
    },

    // log helper (debug only)
    log: (...a) => logger.debug(...a),
    saveBuffer: (buffer, ext = 'bin') => {
      ensureTmp();
      const file = tmpPath(ext);
      fs.writeFileSync(file, buffer);
      return file;
    },
    clean: cleanFile,
    tmpPath,
    ensureTmp,
    fmtBytes,
    truncate,
    shortId,

    // group state record (welcome toggles etc.)
    groupRecord: () => {
      if (!isGroup) return null;
      groupsStore.data.groups ||= {};
      if (!groupsStore.data.groups[chatId]) {
        groupsStore.data.groups[chatId] = {
          id: chatId,
          welcome: true,
          goodbye: true,
          antiLink: null,
          createdAt: new Date().toISOString(),
        };
        groupsStore.persist();
      }
      return groupsStore.data.groups[chatId];
    },
  };

  // Pre-load admin state for group commands
  if (isGroup) {
    await ctx.adminCheck();
  }

  return ctx;
};
