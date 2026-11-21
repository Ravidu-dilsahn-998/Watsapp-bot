/**
 * IP DILSAHN - image renderers (sharp + SVG, no canvas needed)
 * ------------------------------------------------------------------
 * Used for branded menu/status images, welcome cards and simple
 * "quote" images. All layouts are self-contained SVG -> PNG.
 */

import path from 'path';
import sharp from 'sharp';
import config from '../config.js';
import { escapeHtml, fmtBytes, fmtDuration, fmtDate, getUptime } from './helpers.js';

const FONT = path.join(config.paths.assets, 'font.ttf');
const W = 900;

const svgShell = (height, inner) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050b16"/>
      <stop offset="55%" stop-color="#0b1729"/>
      <stop offset="100%" stop-color="#0e2036"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${height}" fill="url(#bg)"/>
  <circle cx="820" cy="60" r="180" fill="#22d3ee" opacity="0.06"/>
  <circle cx="90" cy="${height - 40}" r="220" fill="#818cf8" opacity="0.07"/>
  <rect x="0" y="0" width="${W}" height="6" fill="url(#accent)"/>
  ${inner}
  <text x="${W / 2}" y="${height - 26}" text-anchor="middle" font-family="Roboto" font-size="19" fill="#64748b">${escapeHtml(config.bot.name)} • v${config.bot.version} • Baileys</text>
</svg>`;

const text = (x, y, content, { size = 24, fill = '#e2e8f0', weight = '400', anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-family="Roboto" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${escapeHtml(content)}</text>`;

/* ------------------------------------------------------------------ */
/* Menu / profile card                                                 */
/* ------------------------------------------------------------------ */

export const renderMenuCard = async ({ botName, prefix, commandCount, categoryCount, role, username }) => {
  const height = 520;
  const inner = `
    <rect x="40" y="40" width="${W - 80}" height="${height - 110}" rx="28" fill="#0f1c2e" stroke="#1e3a5f"/>
    <circle cx="130" cy="160" r="52" fill="url(#accent)" opacity="0.18"/>
    <circle cx="130" cy="160" r="52" fill="none" stroke="url(#accent)" stroke-width="3"/>
    <rect x="104" y="136" width="52" height="42" rx="12" fill="none" stroke="#22d3ee" stroke-width="3.5"/>
    <circle cx="118" cy="157" r="4.5" fill="#22d3ee"/>
    <circle cx="142" cy="157" r="4.5" fill="#22d3ee"/>
    <line x1="130" y1="122" x2="130" y2="136" stroke="#22d3ee" stroke-width="3.5"/>
    <circle cx="130" cy="120" r="4" fill="#818cf8"/>
    <line x1="114" y1="178" x2="146" y2="178" stroke="#818cf8" stroke-width="3.5" stroke-linecap="round"/>
    ${text(214, 140, botName, { size: 46, weight: '700', fill: '#f8fafc' })}
    ${text(214, 186, 'WhatsApp Bot Panel • Online', { size: 22, fill: '#22d3ee' })}
    <line x1="90" y1="240" x2="${W - 90}" y2="240" stroke="#1e3a5f"/>
    ${text(90, 296, 'COMMANDS', { size: 18, fill: '#64748b' })}
    ${text(90, 344, String(commandCount), { size: 44, weight: '700', fill: '#f8fafc' })}
    ${text(380, 296, 'CATEGORIES', { size: 18, fill: '#64748b' })}
    ${text(380, 344, String(categoryCount), { size: 44, weight: '700', fill: '#f8fafc' })}
    ${text(650, 296, 'PREFIX', { size: 18, fill: '#64748b' })}
    <rect x="648" y="306" width="${Math.max(64, 34 + String(prefix).length * 20)}" height="52" rx="14" fill="#071322" stroke="#22d3ee" stroke-width="2"/>
    ${text(648 + Math.max(64, 34 + String(prefix).length * 20) / 2, 343, String(prefix), { size: 32, weight: '700', fill: '#22d3ee', anchor: 'middle' })}
    ${text(90, 408, `User: ${username}  •  Access: ${role}`, { size: 22, fill: '#94a3b8' })}
  `;
  return sharp(Buffer.from(svgShell(height, inner)), { font: FONT }).png().toBuffer();
};

/* ------------------------------------------------------------------ */
/* Welcome card                                                        */
/* ------------------------------------------------------------------ */

export const renderWelcomeCard = async ({ botName, number, groupName, memberCount, kind = 'welcome' }) => {
  const height = 460;
  const title = kind === 'welcome' ? 'WELCOME' : 'GOODBYE';
  const icon = kind === 'welcome' ? '🎉' : '👋';
  const gradient = kind === 'welcome' ? '#22d3ee' : '#f472b6';
  const inner = `
    <rect x="40" y="40" width="${W - 80}" height="${height - 110}" rx="28" fill="#0f1c2e" stroke="#1e3a5f"/>
    <circle cx="${W / 2}" cy="128" r="34" fill="none" stroke="${gradient}" stroke-width="3" opacity="0.75"/>
    ${
      kind === 'welcome'
        ? `<path d="M${W / 2 - 14} 136 L${W / 2 + 14} 136 L${W / 2} 114 Z" fill="${gradient}"/>
           <circle cx="${W / 2 - 26}" cy="108" r="4" fill="#22d3ee"/>
           <circle cx="${W / 2 + 26}" cy="104" r="3" fill="#818cf8"/>
           <circle cx="${W / 2 + 20}" cy="148" r="3.5" fill="#f472b6"/>`
        : `<circle cx="${W / 2}" cy="124" r="13" fill="none" stroke="${gradient}" stroke-width="3"/>
           <path d="M${W / 2 - 18} 150 a18 18 0 0 1 36 0" fill="none" stroke="${gradient}" stroke-width="3" stroke-linecap="round"/>`
    }
    ${text(W / 2, 212, title, { size: 50, weight: '700', fill: gradient, anchor: 'middle' })}
    ${text(W / 2, 272, `+${number}`, { size: 38, weight: '700', fill: '#f8fafc', anchor: 'middle' })}
    ${text(W / 2, 322, groupName, { size: 26, fill: '#94a3b8', anchor: 'middle' })}
    ${text(W / 2, 372, `Members: ${memberCount}  •  ${botName}`, { size: 21, fill: '#64748b', anchor: 'middle' })}
  `;
  return sharp(Buffer.from(svgShell(height, inner)), { font: FONT }).png().toBuffer();
};

/* ------------------------------------------------------------------ */
/* Bot status card                                                     */
/* ------------------------------------------------------------------ */

export const renderStatusCard = async ({ botName, status, uptime, number, commandCount, memoryUsed, sessions }) => {
  const height = 560;
  const inner = `
    <rect x="40" y="40" width="${W - 80}" height="${height - 110}" rx="28" fill="#0f1c2e" stroke="#1e3a5f"/>
    ${text(90, 136, botName, { size: 44, weight: '700', fill: '#f8fafc' })}
    ${text(90, 182, 'System Status Report', { size: 22, fill: '#22d3ee' })}
    <line x1="90" y1="216" x2="${W - 90}" y2="216" stroke="#1e3a5f"/>
    ${text(90, 272, 'STATUS', { size: 17, fill: '#64748b' })}
    ${text(90, 306, status.toUpperCase(), { size: 26, weight: '700', fill: status === 'connected' ? '#34d399' : '#fbbf24' })}
    ${text(380, 272, 'UPTIME', { size: 17, fill: '#64748b' })}
    ${text(380, 306, uptime, { size: 26, weight: '700', fill: '#f8fafc' })}
    ${text(650, 272, 'MEMORY', { size: 17, fill: '#64748b' })}
    ${text(650, 306, memoryUsed, { size: 26, weight: '700', fill: '#f8fafc' })}
    ${text(90, 380, 'NUMBER', { size: 17, fill: '#64748b' })}
    ${text(90, 414, number ? `+${number}` : 'not paired', { size: 24, weight: '700', fill: '#f8fafc' })}
    ${text(380, 380, 'COMMANDS', { size: 17, fill: '#64748b' })}
    ${text(380, 414, String(commandCount), { size: 24, weight: '700', fill: '#f8fafc' })}
    ${text(650, 380, 'SESSIONS', { size: 17, fill: '#64748b' })}
    ${text(650, 414, String(sessions), { size: 24, weight: '700', fill: '#f8fafc' })}
    ${text(90, 470, fmtDate(), { size: 19, fill: '#64748b' })}
  `;
  return sharp(Buffer.from(svgShell(height, inner)), { font: FONT }).png().toBuffer();
};

/* ------------------------------------------------------------------ */
/* Quote card (used by .quoteimage / .qcard)                           */
/* ------------------------------------------------------------------ */

export const renderQuoteCard = async ({ quote, author, botName }) => {
  const words = String(quote).split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 46) {
      lines.push(current.trim());
      current = word;
    } else {
      current += ' ' + word;
    }
  }
  if (current.trim()) lines.push(current.trim());

  const height = Math.max(420, 260 + lines.length * 52);
  const lineEls = lines
    .map((l, i) => text(90, 230 + i * 54, l, { size: 34, fill: '#e2e8f0' }))
    .join('\n');
  const inner = `
    <rect x="40" y="40" width="${W - 80}" height="${height - 110}" rx="28" fill="#0f1c2e" stroke="#1e3a5f"/>
    <path d="M96 128 q0 -26 26 -30 l4 12 q-14 4 -14 18 z" fill="#22d3ee"/>
    <path d="M132 128 q0 -26 26 -30 l4 12 q-14 4 -14 18 z" fill="#22d3ee"/>
    ${lineEls}
    ${text(W - 90, height - 150, `— ${author}`, { size: 24, fill: '#818cf8', anchor: 'end' })}
  `;
  return sharp(Buffer.from(svgShell(height, inner)), { font: FONT }).png().toBuffer();
};

export const svgToPng = (svg, { width, height } = {}) =>
  sharp(Buffer.from(svg), { font: FONT }).png().toBuffer();

export const BRAND_CARD_COLORS = { primary: '#22d3ee', secondary: '#818cf8', bg: '#050b16' };
