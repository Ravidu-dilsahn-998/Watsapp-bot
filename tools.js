/**
 * IP DILSAHN - tools & info (40)
 * weather, ip, myip, dns, whois-domain, define, synonym, translate,
 * detectlang, wiki, news, github, npm, pypi, tldr, qrcode, shorturl,
 * expandurl, time, calendar, countdown-to, remind, todo, pinghost,
 * tts, ocr-read, unit-price, crypto, stock-info, country, city,
 * language-codes, morse, unmorse, ascii, braille, cpfy
 */

import crypto from 'crypto';
import axios from 'axios';
import config from '../config.js';
import { http, getJson, fmtBytes, fmtDate, randomUA, truncate, clamp, sleep } from '../lib/helpers.js';
import { box } from '../lib/msg.js';
import { fetchBuffer, uploadToTmpfiles } from '../lib/media.js';
import { tmpPath, cleanFile } from '../lib/helpers.js';
import fs from 'fs';

const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---',
  3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

/* simple in-memory reminder queue */
export const reminders = new Map(); // id -> { at, text, jid, from }

export default [
  {
    name: 'weather',
    aliases: ['wthr', 'forecast'],
    category: 'tools',
    description: 'Current weather for a city',
    usage: '<city>',
    example: '.weather Colombo',
    run: async (ctx) => {
      const city = ctx.argText.trim() || 'Colombo';
      const { data } = await http.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 25000 });
      const cur = data.current_condition?.[0];
      if (!cur) throw new Error('No weather data for that city.');
      const nearest = data.nearest_area?.[0];
      await ctx.reply(
        box(
          `Weather • ${nearest?.areaName?.[0]?.value || city}`,
          `▸ 🌡️ *Temp:* ${cur.temp_C}°C (feels ${cur.FeelsLikeC}°C)\n` +
            `▸ ☁️ *Condition:* ${cur.weatherDesc?.[0]?.value}\n` +
            `▸ 💧 *Humidity:* ${cur.humidity}%\n` +
            `▸ 💨 *Wind:* ${cur.windspeedKmph} km/h ${cur.winddir16Point}\n` +
            `▸ 🌧️ *Rain chance:* ${data.weather?.[0]?.hourly?.[0]?.chanceofrain || 0}%\n` +
            `▸ 🗓️ *Region:* ${nearest?.region?.[0]?.value || ''}, ${nearest?.country?.[0]?.value || ''}`
        )
      );
    },
  },
  {
    name: 'ip',
    aliases: ['iplookup', 'ipinfo'],
    category: 'tools',
    description: 'IP address geolocation lookup',
    usage: '<ip>',
    run: async (ctx) => {
      const ip = ctx.args[0] || '';
      const target = ip ? `/${ip}` : '';
      const data = await getJson(`http://ip-api.com/json${target}?fields=status,country,regionName,city,lat,lon,timezone,isp,org,as,query`);
      if (data.status !== 'success') throw new Error(data.message || 'Lookup failed.');
      await ctx.reply(
        box(
          'IP Lookup',
          `▸ 🌐 *IP:* ${data.query}\n▸ 🗺️ *Country:* ${data.country}\n▸ 🏙️ *City:* ${data.city}, ${data.regionName}\n` +
            `▸ 📍 *Coords:* ${data.lat}, ${data.lon}\n▸ 🕒 *Timezone:* ${data.timezone}\n▸ 🏢 *ISP:* ${data.isp}\n▸ 📡 *Org:* ${data.org || 'n/a'}`
        )
      );
    },
  },
  {
    name: 'myip',
    aliases: ['serverip', 'hostip'],
    category: 'tools',
    description: 'Public IP of the bot host',
    run: async (ctx) => {
      const data = await getJson('https://api.ipify.org?format=json');
      await ctx.reply(`🌐 *Server public IP:* \`${data.ip}\``);
    },
  },
  {
    name: 'dns',
    aliases: ['dnslookup'],
    category: 'tools',
    description: 'Look up DNS records for a domain',
    usage: '<domain> [type]',
    run: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply(`Usage: \`${ctx.prefix}dns google.com A\``);
      const type = (ctx.args[1] || 'A').toUpperCase();
      const data = await getJson(`https://dns.google/resolve?name=${encodeURIComponent(ctx.args[0])}&type=${type}`);
      const answers = (data.Answer || []).slice(0, 10).map((a) => `▸ ${a.type} ${a.data}`).join('\n');
      await ctx.reply(box(`DNS ${type} — ${ctx.args[0]}`, answers || '▸ No records returned.'));
    },
  },
  {
    name: 'domain',
    aliases: ['whois-domain', 'domaininfo'],
    category: 'tools',
    description: 'Domain registration information',
    usage: '<domain>',
    run: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply(`Usage: \`${ctx.prefix}domain google.com\``);
      const data = await getJson(`https://rdap.org/domain/${encodeURIComponent(ctx.args[0])}`);
      const registrars = (data.entities || []).filter((e) => e.roles?.includes('registrar'));
      await ctx.reply(
        box(
          `Domain • ${data.ldhName || ctx.args[0]}`,
          `▸ 🆔 *Handle:* ${data.handle || 'n/a'}\n▸ 📅 *Created:* ${truncate(data.events?.find((e) => e.eventAction === 'registration')?.eventDate || 'n/a', 30)}\n` +
            `▸ 🔄 *Updated:* ${truncate(data.events?.find((e) => e.eventAction === 'last changed')?.eventDate || 'n/a', 30)}\n` +
            `▸ 🏢 *Registrar:* ${registrars[0]?.vcardArray?.[1]?.find((v) => v[0] === 'fn')?.[3] || 'unknown'}\n` +
            `▸ 🌐 *Status:* ${(data.status || []).slice(0, 2).join(', ')}`
        )
      );
    },
  },
  {
    name: 'define',
    aliases: ['dictionary', 'meaning'],
    category: 'tools',
    description: 'Look up the meaning of a word',
    usage: '<word>',
    run: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply(`Usage: \`${ctx.prefix}define hello\``);
      const data = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(ctx.args[0])}`);
      const entry = data[0];
      const meanings = (entry.meanings || []).slice(0, 3).map((m) => {
        const def = m.definitions?.[0];
        return `▸ *${m.partOfSpeech}*: ${def?.definition || ''}`;
      });
      await ctx.reply(box(`Definition • ${entry.word}`, meanings.join('\n') + (entry.phonetic ? `\n\n🗣️ ${entry.phonetic}` : '')));
    },
  },
  {
    name: 'translate',
    aliases: ['tr', 'trans'],
    category: 'tools',
    description: 'Translate text to another language',
    usage: '<lang> <text>',
    example: '.translate es hello friend',
    run: async (ctx) => {
      const target = (ctx.args[0] || '').toLowerCase();
      const text = ctx.args.slice(1).join(' ');
      if (!target || !text) return ctx.reply(`Usage: \`${ctx.prefix}translate <lang code> <text>\`\ne.g. \`${ctx.prefix}translate si hello\``);
      const data = await getJson(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${target}`
      );
      const out = data?.responseData?.translatedText;
      if (!out) throw new Error('Translation failed.');
      await ctx.reply(`🌐 *Translate → ${target}*\n\n▸ *Source:* ${truncate(text, 200)}\n▸ *Result:* ${out}`);
    },
  },
  {
    name: 'wiki',
    aliases: ['wikipedia'],
    category: 'tools',
    description: 'Summary from Wikipedia',
    usage: '<topic>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}wiki WhatsApp\``);
      const data = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ctx.argText.trim().replace(/\s+/g, '_'))}`);
      if (!data.extract) throw new Error('No article found.');
      const text = box(`📚 ${data.title}`, `${truncate(data.extract, 800)}\n\n🔗 ${data.content_urls?.desktop?.page || ''}`);
      if (data.thumbnail?.source) {
        try {
          const buf = await fetchBuffer(data.thumbnail.source);
          return ctx.reply({ image: buf, caption: text });
        } catch {
          /* ignore */
        }
      }
      await ctx.reply(text);
    },
  },
  {
    name: 'news',
    aliases: ['headlines'],
    category: 'tools',
    description: 'Latest Dev.to tech headlines',
    run: async (ctx) => {
      const data = await getJson('https://dev.to/api/articles?per_page=7');
      const lines = data.map((a, i) => `▸ ${i + 1}. ${truncate(a.title, 60)}\n   ${a.url}`);
      await ctx.reply(box('Tech Headlines', lines.join('\n')));
    },
  },
  {
    name: 'github',
    aliases: ['gh', 'ghuser'],
    category: 'tools',
    description: 'GitHub profile information',
    usage: '<username>',
    run: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply(`Usage: \`${ctx.prefix}github torvalds\``);
      const data = await getJson(`https://api.github.com/users/${encodeURIComponent(ctx.args[0])}`);
      if (!data.login) throw new Error('User not found.');
      const text =
        `🐙 *${data.name || data.login}* (@${data.login})\n\n` +
        `▸ 👥 *Followers:* ${data.followers?.toLocaleString()}\n` +
        `▸ 👤 *Following:* ${data.following}\n` +
        `▸ 📦 *Public repos:* ${data.public_repos}\n` +
        `▸ 📍 *Location:* ${data.location || 'n/a'}\n` +
        `▸ 🏢 *Company:* ${data.company || 'n/a'}\n` +
        `▸ 🔗 ${data.html_url}`;
      if (data.avatar_url) {
        try {
          const buf = await fetchBuffer(data.avatar_url);
          return ctx.reply({ image: buf, caption: text });
        } catch {
          /* ignore */
        }
      }
      await ctx.reply(text);
    },
  },
  {
    name: 'npm',
    aliases: ['npmpkg'],
    category: 'tools',
    description: 'NPM package information',
    usage: '<package>',
    run: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply(`Usage: \`${ctx.prefix}npm express\``);
      const data = await getJson(`https://registry.npmjs.org/${encodeURIComponent(ctx.args[0])}/latest`);
      await ctx.reply(
        box(
          `📦 ${data.name}`,
          `▸ *Version:* ${data.version}\n▸ *License:* ${data.license || 'n/a'}\n▸ *Description:* ${truncate(data.description || '', 200)}\n▸ *Homepage:* ${data.homepage || 'n/a'}`
        )
      );
    },
  },
  {
    name: 'crypto',
    aliases: ['price', 'coingecko'],
    category: 'tools',
    description: 'Cryptocurrency prices',
    usage: '<coin>',
    example: '.crypto bitcoin',
    cooldown: 4,
    run: async (ctx) => {
      const coin = (ctx.args[0] || 'bitcoin').toLowerCase();
      const data = await getJson(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=usd,eur,lkr&include_24hr_change=true`
      );
      const c = data[coin];
      if (!c) return ctx.reply(`❌ Unknown coin \`${coin}\`. Try bitcoin, ethereum, solana, dogecoin.`);
      const change = c.usd_24h_change ?? 0;
      await ctx.reply(
        box(
          `💰 ${coin.toUpperCase()}`,
          `▸ USD: *$${c.usd?.toLocaleString()}*\n▸ EUR: €${c.eur?.toLocaleString()}\n▸ LKR: Rs ${c.lkr?.toLocaleString()}\n▸ 24h: ${change >= 0 ? '📈 +' : '📉 '}${change.toFixed(2)}%`
        )
      );
    },
  },
  {
    name: 'country',
    aliases: ['countryinfo'],
    category: 'tools',
    description: 'Country information',
    usage: '<country name>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}country Sri Lanka\``);
      const data = await getJson('https://api.first.org/data/v1/countries?limit=300');
      const all = Object.entries(data.data || {});
      const q = ctx.argText.trim().toLowerCase();
      const found = all.find(([, v]) => v.country.toLowerCase() === q) || all.find(([, v]) => v.country.toLowerCase().includes(q));
      if (!found) throw new Error('Country not found.');
      await ctx.reply(box(`🌍 ${found[1].country}`, `▸ *Code:* ${found[0]}\n▸ *Region:* ${found[1].region}`));
    },
  },
  {
    name: 'qr',
    aliases: ['qrcode', 'makeqr'],
    category: 'tools',
    description: 'Generate a QR code image for any text or link',
    usage: '<text|link>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}qr https://example.com\``);
      const buf = await fetchBuffer(`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(ctx.argText)}`);
      await ctx.reply({ image: buf, caption: `🔳 QR code for: ${truncate(ctx.argText, 80)}` });
    },
  },
  {
    name: 'shorturl',
    aliases: ['shorten', 'tinyurl'],
    category: 'tools',
    description: 'Shorten a long link',
    usage: '<url>',
    run: async (ctx) => {
      const url = (ctx.argText.match(/https?:\/\/\S+/) || [])[0];
      if (!url) return ctx.reply(`Usage: \`${ctx.prefix}shorturl https://example.com/long-link\``);
      const { data } = await http.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      await ctx.reply(`🔗 *Shortened*\n\n▸ ${String(data).trim()}`);
    },
  },
  {
    name: 'expandurl',
    aliases: ['unshorten', 'urlexpand'],
    category: 'tools',
    description: 'Expand a shortened link to its final destination',
    usage: '<short url>',
    run: async (ctx) => {
      const url = (ctx.argText.match(/https?:\/\/\S+/) || [])[0];
      if (!url) return ctx.reply(`Usage: \`${ctx.prefix}expandurl https://tinyurl.com/xyz\``);
      const res = await axios.get(url, { maxRedirects: 10, timeout: 20000, headers: { 'User-Agent': randomUA() }, validateStatus: () => true });
      const final = res.request?.res?.responseUrl || url;
      await ctx.reply(`🔗 *Expanded link*\n\n${final}`);
    },
  },
  {
    name: 'tts',
    aliases: ['speak', 'voice'],
    category: 'tools',
    description: 'Convert text to a voice note',
    usage: '<text>',
    cooldown: 5,
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}tts hello there\``);
      const text = ctx.argText.slice(0, 190);
      const { data } = await axios.get('https://translate.google.com/translate_tts', {
        params: { ie: 'UTF-8', q: text, tl: 'en', client: 'tw-ob' },
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': randomUA() },
      });
      const buf = Buffer.from(data);
      if (buf.length < 1000) throw new Error('TTS failed.');
      const file = tmpPath('mp3');
      fs.writeFileSync(file, buf);
      try {
        await ctx.reply({ audio: { url: file }, mimetype: 'audio/mpeg', ptt: true }, { quoted: ctx.msg });
      } finally {
        cleanFile(file);
      }
    },
  },
  {
    name: 'morse',
    aliases: ['tomorse'],
    category: 'tools',
    description: 'Convert text to Morse code',
    usage: '<text>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}morse hello\``);
      const out = [...ctx.argText.toLowerCase()].map((c) => (c === ' ' ? '/' : MORSE[c] || '')).filter(Boolean).join(' ');
      await ctx.reply(`📡 ${out || '(nothing to encode)'}`);
    },
  },
  {
    name: 'unmorse',
    aliases: ['frommorse'],
    category: 'tools',
    description: 'Decode Morse code back to text',
    usage: '<morse>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}unmorse .... . .-.. .-.. ---\``);
      const reverse = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
      const out = ctx.argText
        .trim()
        .split(/\s+/)
        .map((code) => (code === '/' ? ' ' : reverse[code] || '?'))
        .join('');
      await ctx.reply(`📡 ${out}`);
    },
  },
  {
    name: 'ascii',
    aliases: ['toascii'],
    category: 'tools',
    description: 'Show ASCII codes for text',
    usage: '<text>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}ascii hello\``);
      await ctx.reply(`🔤 ${[...ctx.argText].map((c) => c.charCodeAt(0)).join(' ')}`);
    },
  },
  {
    name: 'unascii',
    aliases: ['fromascii'],
    category: 'tools',
    description: 'Convert ASCII codes back to text',
    usage: '<codes>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}unascii 104 101 108 108 111\``);
      const out = ctx.argText
        .trim()
        .split(/\s+/)
        .map((n) => String.fromCharCode(parseInt(n, 10)))
        .join('');
      await ctx.reply(`🔤 ${out}`);
    },
  },
  {
    name: 'remind',
    aliases: ['reminder'],
    category: 'tools',
    description: 'Set a reminder in N minutes',
    usage: '<minutes> <text>',
    example: '.remind 10 call mum',
    run: async (ctx) => {
      const minutes = clamp(parseFloat(ctx.args[0]) || 0, 0.1, 10080);
      const text = ctx.args.slice(1).join(' ');
      if (!text) return ctx.reply(`Usage: \`${ctx.prefix}remind 10 <what to remember>\``);
      const id = crypto.randomBytes(3).toString('hex');
      const at = Date.now() + minutes * 60000;
      reminders.set(id, { at, text, jid: ctx.chatId, from: ctx.senderNumber });
      setTimeout(async () => {
        try {
          await ctx.sendTo(ctx.chatId, `⏰ *Reminder!*\n\n${text}\n\n_Set ${minutes} min ago._`);
        } catch {
          /* ignore */
        }
        reminders.delete(id);
      }, minutes * 60000).unref?.();
      await ctx.reply(`⏰ Reminder set for *${minutes} minute(s)* from now.\n📝 ${truncate(text, 150)}\n🆔 ${id}`);
    },
  },
  {
    name: 'reminders',
    aliases: ['myreminders'],
    category: 'tools',
    description: 'List your active reminders',
    run: async (ctx) => {
      const mine = [...reminders.entries()].filter(([, r]) => r.jid === ctx.chatId);
      if (!mine.length) return ctx.reply('ℹ️ You have no active reminders in this chat.');
      const lines = mine.map(([id, r]) => `▸ ${id}: in ${Math.max(1, Math.round((r.at - Date.now()) / 60000))} min — ${truncate(r.text, 40)}`);
      await ctx.reply(box('Your Reminders', lines.join('\n')));
    },
  },
  {
    name: 'calc',
    aliases: ['math', 'eval-math'],
    category: 'tools',
    description: 'Evaluate a math expression',
    usage: '<expression>',
    example: '.calc (12+8)*3/2',
    run: async (ctx) => {
      const expr = ctx.argText.replace(/[^0-9+\-*/%^().\s]/g, '');
      if (!expr) return ctx.reply(`Usage: \`${ctx.prefix}calc (12+8)*3\``);
      try {
        // sandboxed evaluation of digits/operators only
        const result = Function(`"use strict"; return (${expr.replace(/\^/g, '**')});`)();
        if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('bad');
        await ctx.reply(`🧮 *${expr}* = *${result.toLocaleString()}*`);
      } catch {
        await ctx.reply('❌ Invalid expression.');
      }
    },
  },
  {
    name: 'random',
    aliases: ['rand', 'rnd'],
    category: 'tools',
    description: 'Random number between two values',
    usage: '<min> <max>',
    run: async (ctx) => {
      const min = parseInt(ctx.args[0], 10) || 1;
      const max = parseInt(ctx.args[1], 10) || 100;
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const n = crypto.randomInt(lo, hi + 1);
      await ctx.reply(`🎲 Random number between ${lo} and ${hi}: *${n}*`);
    },
  },
  {
    name: 'pickone',
    aliases: ['chooseone'],
    category: 'tools',
    description: 'Choose one option from a list',
    usage: 'a | b | c',
    run: async (ctx) => {
      const options = ctx.argText.split('|').map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) return ctx.reply(`Usage: \`${ctx.prefix}choose pizza | burger | rice\``);
      await ctx.reply(`🎯 *I pick:* ${options[crypto.randomInt(options.length)]}`);
    },
  },
  {
    name: 'baseconvert',
    aliases: ['tobaseconv'],
    category: 'tools',
    description: 'Convert a number to binary/hex/octal',
    usage: '<number>',
    run: async (ctx) => {
      const n = parseInt(ctx.args[0], 10);
      if (!Number.isFinite(n)) return ctx.reply(`Usage: \`${ctx.prefix}baseconvert 255\``);
      await ctx.reply(
        box('Base Conversion', `▸ Binary: ${n.toString(2)}\n▸ Octal: ${n.toString(8)}\n▸ Decimal: ${n}\n▸ Hex: ${n.toString(16).toUpperCase()}`)
      );
    },
  },
  {
    name: 'password-strength',
    aliases: ['pwstrength', 'checkpass'],
    category: 'tools',
    description: 'Estimate password strength',
    usage: '<password>',
    run: async (ctx) => {
      const pass = ctx.argText;
      if (!pass) return ctx.reply(`Usage: \`${ctx.prefix}password-strength MyPass123!\``);
      let score = 0;
      if (pass.length >= 8) score += 1;
      if (pass.length >= 12) score += 1;
      if (pass.length >= 16) score += 1;
      if (/[a-z]/.test(pass)) score += 1;
      if (/[A-Z]/.test(pass)) score += 1;
      if (/[0-9]/.test(pass)) score += 1;
      if (/[^a-zA-Z0-9]/.test(pass)) score += 1;
      const label = score >= 7 ? '🟢 Very strong' : score >= 5 ? '🟡 Strong' : score >= 3 ? '🟠 Weak' : '🔴 Very weak';
      await ctx.reply(`🔐 *Password strength:* ${label}\n▸ Score: ${score}/7\n▸ Length: ${pass.length}`);
    },
  },
  {
    name: 'color',
    aliases: ['colour'],
    category: 'tools',
    description: 'Show a colour preview from a hex code',
    usage: '<#hex>',
    run: async (ctx) => {
      const sharp = (await import('sharp')).default;
      const hex = (ctx.args[0] || '#22d3ee').replace('#', '');
      const h = /^[0-9a-f]{6}$/i.test(hex) ? hex : '22d3ee';
      const svg = `<svg width="500" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="500" height="300" fill="#${h}"/></svg>`;
      const buf = await sharp(Buffer.from(svg)).jpg().toBuffer();
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      await ctx.reply({ image: buf, caption: `🎨 *#${h.toUpperCase()}*\n▸ RGB: ${r}, ${g}, ${b}` });
    },
  },
  {
    name: 'currency-list',
    aliases: ['currencies'],
    category: 'tools',
    description: 'List supported currency codes',
    run: async (ctx) => {
      const { data } = await http.get('https://open.er-api.com/v6/latest/USD');
      const codes = Object.keys(data.rates || {});
      const chunks = [];
      for (let i = 0; i < codes.length; i += 40) chunks.push(codes.slice(i, i + 40).join(', '));
      await ctx.reply(box(`Currency Codes (${codes.length})`, chunks.slice(0, 4).join('\n\n')));
    },
  },
  {
    name: 'allcountries',
    aliases: ['countrylist'],
    category: 'tools',
    description: 'List countries for a region',
    usage: '<region>',
    run: async (ctx) => {
      const data = await getJson('https://api.first.org/data/v1/countries?limit=300');
      const region = (ctx.args[0] || '').toLowerCase();
      const all = Object.values(data.data || {});
      const filtered = region ? all.filter((c) => c.region.toLowerCase().includes(region)) : all;
      if (!filtered.length) return ctx.reply(`🌍 Regions: Asia, Europe, Africa, Oceania, North America, South America, Middle East, The Caribbean`);
      const list = filtered.map((c) => c.country).sort();
      const out = [];
      for (let i = 0; i < list.length; i += 60) out.push(list.slice(i, i + 60).join(' • '));
      await ctx.reply(box(`Countries (${filtered.length})`, out.slice(0, 3).join('\n\n')));
    },
  },
  {
    name: 'pickdate',
    aliases: ['randomdate'],
    category: 'tools',
    description: 'Pick a random date in the next year',
    run: async (ctx) => {
      const d = new Date(Date.now() + crypto.randomInt(1, 365) * 86400000);
      await ctx.reply(`📅 Random date: *${fmtDate(d)}*`);
    },
  },
  {
    name: 'streak',
    aliases: ['daynumber'],
    category: 'tools',
    description: 'Day of the year and week number',
    run: async (ctx) => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const day = Math.floor((now - start) / 86400000);
      const week = Math.ceil(day / 7);
      await ctx.reply(`📆 *Today*\n\n▸ Day of year: ${day}\n▸ Week: ${week}\n▸ Remaining days: ${365 - day}`);
    },
  },
  {
    name: 'ipinfo-mine',
    aliases: ['whereami'],
    category: 'tools',
    description: 'Geolocate the bot server',
    run: async (ctx) => {
      const data = await getJson('http://ip-api.com/json/?fields=status,country,city,isp,query');
      if (data.status !== 'success') throw new Error('Lookup failed.');
      await ctx.reply(`🌐 *Server location*\n\n▸ IP: ${data.query}\n▸ City: ${data.city}, ${data.country}\n▸ ISP: ${data.isp}`);
    },
  },
  {
    name: 'hashfile',
    aliases: ['filehash'],
    category: 'tools',
    description: 'SHA-256 of a replied file',
    run: async (ctx) => {
      if (!ctx.quoted?.message) return ctx.reply('Reply to a file with `.hashfile`.');
      const buf = await ctx.downloadQuoted('buffer');
      await ctx.reply(`🔐 *SHA-256*\n\n\`${crypto.createHash('sha256').update(buf).digest('hex')}\`\n\n▸ Size: ${fmtBytes(buf.length)}`);
    },
  },
  {
    name: 'split',
    aliases: ['chunktext'],
    category: 'tools',
    description: 'Split text into 100-character chunks',
    usage: '<text>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}split <long text>\``);
      const chunks = ctx.argText.match(/[\s\S]{1,100}/g) || [];
      await ctx.reply(chunks.map((c, i) => `*${i + 1}.* ${c}`).join('\n\n'));
    },
  },
  {
    name: 'wordfreq',
    aliases: ['freq'],
    category: 'tools',
    description: 'Most frequent words in text',
    usage: '<text>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}wordfreq <text>\``);
      const stop = new Set(['the', 'a', 'an', 'and', 'or', 'is', 'are', 'to', 'of', 'in', 'it', 'i', 'you', 'we', 'that', 'this']);
      const counts = {};
      for (const w of ctx.argText.toLowerCase().match(/[a-z']+/g) || []) {
        if (stop.has(w) || w.length < 2) continue;
        counts[w] = (counts[w] || 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      await ctx.reply(box('Word Frequency', top.map(([w, n], i) => `▸ ${i + 1}. ${w} — ${n}`).join('\n') || 'no words'));
    },
  },
  {
    name: 'isdown',
    aliases: ['sitecheck', 'updown'],
    category: 'tools',
    description: 'Check if a website is online',
    usage: '<url>',
    run: async (ctx) => {
      const url = (ctx.argText.match(/https?:\/\/\S+/) || [])[0] || (ctx.args[0] ? `https://${ctx.args[0]}` : '');
      if (!url) return ctx.reply(`Usage: \`${ctx.prefix}isdown google.com\``);
      const start = Date.now();
      try {
        const res = await axios.get(url, { timeout: 15000, headers: { 'User-Agent': randomUA() }, validateStatus: () => true });
        await ctx.reply(`🟢 *Online*\n\n▸ Status: ${res.status}\n▸ Time: ${Date.now() - start} ms\n▸ URL: ${url}`);
      } catch (err) {
        await ctx.reply(`🔴 *Offline / unreachable*\n\n▸ Error: ${truncate(err.message, 100)}\n▸ URL: ${url}`);
      }
    },
  },
  {
    name: 'headers',
    aliases: ['httpheaders'],
    category: 'tools',
    description: 'Show HTTP response headers for a URL',
    usage: '<url>',
    run: async (ctx) => {
      const url = (ctx.argText.match(/https?:\/\/\S+/) || [])[0];
      if (!url) return ctx.reply(`Usage: \`${ctx.prefix}headers https://example.com\``);
      const res = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': randomUA() }, validateStatus: () => true });
      const entries = Object.entries(res.headers).slice(0, 15).map(([k, v]) => `▸ ${k}: ${truncate(String(v), 60)}`);
      await ctx.reply(box(`Headers (${res.status})`, entries.join('\n')));
    },
  },
  {
    name: 'uuid-validate',
    aliases: ['checkuuid'],
    category: 'tools',
    description: 'Validate a UUID string',
    usage: '<uuid>',
    run: async (ctx) => {
      const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ctx.args[0] || '');
      await ctx.reply(ok ? '✅ Valid UUID v4.' : '❌ Not a valid UUID v4.');
    },
  },
];
