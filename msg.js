/**
 * IP DILSAHN - rich message builders
 * ------------------------------------------------------------------
 * WhatsApp keeps tightening interactive messages, so every builder has
 * a plain-text fallback. Use sendInteractive() when you want real
 * native flow buttons (cta_url / quick_reply) with graceful degradation.
 */

import { proto, generateWAMessageFromContent, jidNormalizedUser } from '@whiskeysockets/baileys';
import config from '../config.js';
import { getBotName } from './helpers.js';

/** A clean, brand-styled text wrapper used across commands */
export const box = (title, body, footer = '') => {
  const top = `╭━━〔 *${title}* 〕━━╮`;
  const bottom = '╰━━━━━━━━━━━━━━━━━━━━╯';
  const lines = String(body)
    .split('\n')
    .map((l) => (l ? `┃ ${l}` : '┃'))
    .join('\n');
  return `${top}\n${lines}\n${footer ? `┃\n┃ ${footer}\n` : ''}${bottom}\n\n_🤖 ${getBotName()}_`;
};

export const divider = () => '━━━━━━━━━━━━━━━━━━━━━━';

export const bullet = (label, value) => `▸ *${label}:* ${value}`;

/** Send a text message, works for both string and content objects */
export const sendText = (sock, jid, text, quoted, extra = {}) =>
  sock.sendMessage(jid, { text, ...extra }, { quoted });

/**
 * Native flow buttons:
 *  - cta_url  -> opens a link
 *  - quick_reply -> sends a text reply back to the chat
 *
 * Falls back to plain text if WhatsApp rejects the interactive message.
 */
export const sendInteractive = async ({
  sock,
  jid,
  title,
  text,
  footer,
  buttons = [],
  quoted,
}) => {
  const bodyText = [title ? `*${title}*` : '', text].filter(Boolean).join('\n\n');

  const flowButtons = buttons
    .filter((b) => b.url || b.reply)
    .map((b) =>
      b.url
        ? {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: b.text,
              url: b.url,
              merchant_url: b.url,
            }),
          }
        : {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: b.text, id: b.reply }),
          }
    );

  if (!flowButtons.length) return sendText(sock, jid, bodyText, quoted);

  try {
    const msg = generateWAMessageFromContent(
      jidNormalizedUser(jid),
      {
        interactiveMessage: proto.Message.InteractiveMessage.fromObject({
          header: { title: title || getBotName() },
          body: { text },
          footer: { text: footer || `Powered by ${getBotName()}` },
          nativeFlowMessage: {
            buttons: flowButtons.slice(0, 3),
            messageParamsJson: JSON.stringify({}),
          },
        }),
      },
      { userJid: sock.user?.id }
    );
    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
  } catch {
    await sendText(sock, jid, bodyText, quoted);
  }
};

/**
 * Template buttons (rendered by many WhatsApp clients).
 * Buttons: { text, url?, call?, reply? }
 */
export const sendButtons = async ({ sock, jid, text, footer, title, buttons = [], quoted }) => {
  try {
    const buttonsMessage = proto.Message.ButtonsMessage.fromObject({
      headerType: proto.Message.ButtonsMessage.HeaderType.TEXT,
      contentText: [title ? `*${title}*` : '', text].filter(Boolean).join('\n\n'),
      footerText: footer || getBotName(),
      buttons: buttons.slice(0, 3).map((b, i) => {
        const type = b.url
          ? proto.Message.ButtonsMessage.Button.Type ? 'URL' : 1
          : b.call
            ? 'CALL'
            : 'RESPONSE';
        return {
          buttonId: b.reply || b.url || b.call || String(i + 1),
          buttonText: { displayText: b.text },
          type,
          ...(b.url ? { nativeFlowInfo: { name: 'cta_url', paramsJson: JSON.stringify({ display_text: b.text, url: b.url }) } } : {}),
        };
      }),
    });
    await sock.sendMessage(jid, { buttonsMessage }, { quoted });
  } catch {
    const fallback = buttons.map((b, i) => `${i + 1}. ${b.text}${b.url ? ` — ${b.url}` : ''}`).join('\n');
    await sendText(sock, jid, `${text}\n\n${fallback}`, quoted);
  }
};

/** Poll helper: ctx-level wrapper is easier, but keep one here for reuse */
export const sendPoll = (sock, jid, name, values, quoted, selectableCount = 1) =>
  sock.sendMessage(jid, { poll: { name, values, selectableCount } }, { quoted });

/** Send audio as a playable voice note */
export const sendVoice = (sock, jid, buffer, quoted) =>
  sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4', ptt: true }, { quoted });

/** Simple table renderer for text output */
export const table = (rows = [], { pad = 2 } = {}) => {
  if (!rows.length) return '';
  const widths = [];
  for (const row of rows) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] || 0, String(cell).length);
    });
  }
  return rows
    .map((row) => row.map((cell, i) => String(cell).padEnd(widths[i] + pad)).join('').trimEnd())
    .join('\n');
};

/** Percentage bar for progress messages */
export const bar = (percent, size = 14) => {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((p / 100) * size);
  return `${'▓'.repeat(filled)}${'░'.repeat(size - filled)} ${p.toFixed(0)}%`;
};

export const BRAND = {
  accent: '*IP DILSAHN*',
  note: '_Baileys • WhatsApp automation_',
  config,
};
