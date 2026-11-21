/**
 * IP DILSAHN - non-command features
 * ------------------------------------------------------------------
 * Runs on every incoming message before the command router:
 *   - anti-link protection (delete / warn / kick)
 *   - keyword triggers and auto-replies
 *   - simple built-in chat replies when chatBot mode is on
 * Also exports sendGroupEvent() used for welcome / goodbye messages.
 */

import config from '../config.js';
import logger from './logger.js';
import { settingsStore, groupsStore, triggersStore, usersStore } from './db.js';
import { featureOn, getBotName, fmtDate, truncate, randomItem } from './helpers.js';
import { getGroupMetadata } from './context.js';
import { jidToNumber } from './users.js';

const escapesRegex = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LINK_PATTERN = /((https?:\/\/|www\.)[^\s]+)|(chat\.whatsapp\.com\/[^\s]+)|([a-z0-9-]+\.(com|net|org|lk|io|me|ly|co|xyz|info|app|site|online|link|gg|tv|in)(\b|\/))/i;

export const containsLink = (text = '') => LINK_PATTERN.test(String(text || ''));

const linkAllowed = (text = '') => {
  const whitelist = settingsStore.data.moderation?.linkWhitelist || [];
  const links = String(text).match(/(https?:\/\/[^\s]+)/gi) || [];
  if (!links.length) return false;
  return links.every((l) => whitelist.some((w) => l.includes(w)));
};

const groupAntiLinkEnabled = (jid) => {
  const rec = groupsStore.data.groups?.[jid];
  if (rec && typeof rec.antiLink === 'boolean') return rec.antiLink;
  return featureOn('antiLink');
};

const warnUser = (jid, number) => {
  groupsStore.data.groups ||= {};
  const rec = groupsStore.data.groups[jid] || (groupsStore.data.groups[jid] = {});
  rec.warns ||= {};
  rec.warns[number] = (rec.warns[number] || 0) + 1;
  groupsStore.persist();
  return rec.warns[number];
};

const clearWarns = (jid, number) => {
  const rec = groupsStore.data.groups?.[jid];
  if (rec?.warns?.[number]) {
    delete rec.warns[number];
    groupsStore.persist();
  }
};

/* ------------------------------------------------------------------ */
/* Anti-link                                                           */
/* ------------------------------------------------------------------ */

const handleAntiLink = async (ctx) => {
  if (!ctx.isGroup) return false;
  if (!groupAntiLinkEnabled(ctx.chatId)) return false;
  if (ctx.isAdmin || ctx.isOwner || ctx.isSudo) return false;
  if (!containsLink(ctx.bodyText)) return false;
  if (linkAllowed(ctx.bodyText)) return false;

  const action = settingsStore.data.moderation?.antiLinkAction || 'delete';

  try {
    await ctx.deleteMessage(ctx.msg.key);
  } catch {
    /* ignore */
  }

  if (action === 'kick') {
    try {
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId, true);
      const botIsAdmin = meta.participants.find((p) => jidToNumber(p.id) === ctx.normalize(ctx.sock.user?.id?.split('@')[0]))?.admin;
      if (botIsAdmin) {
        await ctx.sock.groupParticipantsUpdate(ctx.chatId, [ctx.senderJid], 'remove');
        await ctx.reply(`🚫 @${ctx.senderNumber} removed — links are not allowed here.`);
      } else {
        await ctx.reply('🚫 Links are not allowed here! (Bot needs admin rights to remove.)');
      }
    } catch (err) {
      logger.debug('antiLink kick:', err.message);
    }
    return true;
  }

  if (action === 'warn') {
    const limit = settingsStore.data.moderation?.warnLimit || 3;
    const count = warnUser(ctx.chatId, ctx.senderNumber);
    const left = Math.max(0, limit - count);
    if (count >= limit) {
      try {
        const meta = await getGroupMetadata(ctx.sock, ctx.chatId, true);
        const botIsAdmin = meta.participants.find((p) => jidToNumber(p.id) === ctx.normalize(ctx.sock.user?.id?.split('@')[0]))?.admin;
        if (botIsAdmin) {
          await ctx.sock.groupParticipantsUpdate(ctx.chatId, [ctx.senderJid], 'remove');
          clearWarns(ctx.chatId, ctx.senderNumber);
          await ctx.reply(`⛔ @${ctx.senderNumber} has been removed after ${limit} warnings.`);
          return true;
        }
      } catch {
        /* ignore */
      }
    }
    await ctx.reply(`⚠️ *Warning ${count}/${limit}* — @${ctx.senderNumber}, links are not allowed in this group.\n${left ? `${left} more and you will be removed.` : ''}`);
    return true;
  }

  await ctx.reply(`🚫 @${ctx.senderNumber}, links are not allowed in this group.`);
  return true;
};

/* ------------------------------------------------------------------ */
/* Auto replies                                                        */
/* ------------------------------------------------------------------ */

const COOLDOWN = 8000;
const lastReply = new Map();

const canReplyTo = (chatId) => {
  const last = lastReply.get(chatId) || 0;
  if (Date.now() - last < COOLDOWN) return false;
  lastReply.set(chatId, Date.now());
  if (lastReply.size > 300) lastReply.clear();
  return true;
};

const handleTriggers = async (ctx) => {
  if (!featureOn('autoReply')) return false;
  const text = ctx.bodyText.toLowerCase().trim();
  if (!text) return false;

  // ignore commands
  if (ctx.prefixRegex.test(text)) return false;

  const userTriggers = triggersStore.data.triggers || {};
  for (const [trigger, reply] of Object.entries(userTriggers)) {
    if (reply === null || reply === undefined) continue;
    const t = String(trigger).toLowerCase();
    if (!t) continue;
    if (text === t || new RegExp(`(^|\\s)${escapesRegex(t)}(\\s|$|!|\\?|\\.)`, 'i').test(text)) {
      if (!canReplyTo(ctx.chatId)) return true;
      await ctx.send(reply);
      return true;
    }
  }

  const extras = triggersStore.data.replies || [];
  for (const item of extras) {
    const match = String(item.match || '').toLowerCase().trim();
    if (!match) continue;
    if (text.includes(match)) {
      if (!canReplyTo(ctx.chatId)) return true;
      await ctx.send(item.reply);
      return true;
    }
  }
  return false;
};

/* ------------------------------------------------------------------ */
/* Simple chatbot                                                      */
/* ------------------------------------------------------------------ */

const chatRules = [
  { test: /^(hi|hello|hey|halo|hii+|yo)\b/i, replies: ['👋 Hey @name! How can I help you?', 'Hello @name! Type *.menu* to see what I can do.'] },
  { test: /how are you/i, replies: ['💪 I am running perfectly, thanks for asking!', '⚡ All systems online. Ready to help!'] },
  { test: /who (made|created|built) you/i, replies: [`🤖 I was built by *${config.owner.name}* using Baileys.`] },
  { test: /what('| i)?s your name|who are you/i, replies: [`🤖 I am *${getBotName()}*, your WhatsApp assistant.`] },
  { test: /good (morning|afternoon|evening|night)/i, replies: ['🌅 Have a great day!', '✨ Wishing you the same!'] },
  { test: /thank(s| you)/i, replies: ['🙌 You are welcome!', '💙 Anytime!'] },
  { test: /bye|goodbye/i, replies: ['👋 See you soon!', '🚀 Catch you later!'] },
];

const handleChatBot = async (ctx) => {
  if (!featureOn('chatBot')) return false;
  if (!ctx.bodyText || ctx.bodyText.length > 120) return false;
  if (ctx.prefixRegex.test(ctx.bodyText.trim())) return false;

  for (const rule of chatRules) {
    if (rule.test.test(ctx.bodyText)) {
      if (!canReplyTo(ctx.chatId)) return true;
      const reply = randomItem(rule.replies).replace('@name', ctx.pushName?.split(' ')[0] || 'friend');
      await ctx.send(reply);
      return true;
    }
  }
  return false;
};

/* ------------------------------------------------------------------ */
/* Entry point for the pipeline                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns false when the message was fully handled by a feature and the
 * command router should not run.
 */
export const handleMessageFeatures = async (ctx) => {
  // do not run features on group events / protocol messages
  const type = ctx.mediaType;
  if (['protocol', 'senderKeyDistribution'].includes(type)) return false;

  if (await handleAntiLink(ctx)) return false;
  if (await handleTriggers(ctx)) return false;
  if (await handleChatBot(ctx)) return false;
  return true;
};

/* ------------------------------------------------------------------ */
/* Welcome / goodbye                                                   */
/* ------------------------------------------------------------------ */

const groupSetting = (jid, key, fallback) => {
  const rec = groupsStore.data.groups?.[jid];
  if (rec && typeof rec[key] === 'boolean') return rec[key];
  return fallback;
};

const formatTemplate = (template, { user, group, count }) =>
  String(template || '')
    .replace(/{user}|@user/gi, `@${user}`)
    .replace(/{group}|@group/gi, group)
    .replace(/{count}|@count/gi, String(count));

export const sendGroupEvent = async (sock, groupJid, participants, action) => {
  if (!sock) return;
  const isWelcome = action === 'add';
  const isGoodbye = action === 'remove' || action === 'leave';

  if (isWelcome && !(featureOn('welcome') && groupSetting(groupJid, 'welcome', true))) return;
  if (isGoodbye && !(featureOn('goodbye') && groupSetting(groupJid, 'goodbye', true))) return;

  let meta;
  try {
    meta = await getGroupMetadata(sock, groupJid, true);
  } catch {
    return;
  }

  const groupName = meta?.subject || 'the group';
  const template = isWelcome
    ? settingsStore.data.messages?.welcome
    : settingsStore.data.messages?.goodbye;

  for (const participant of participants) {
    const jid = typeof participant === 'string' ? participant : participant.id;
    const number = jidToNumber(jid);
    if (!number) continue;

    const text = formatTemplate(template, { user: number, group: groupName, count: meta?.participants?.length || 0 });
    try {
      await sock.sendMessage(groupJid, {
        text: `\n${text}\n\n_${fmtDate()}_`,
        mentions: [`${number}@s.whatsapp.net`],
      });
    } catch (err) {
      logger.debug('welcome/goodbye:', err.message);
    }
  }
};
