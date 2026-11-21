/**
 * IP DILSAHN - status, monitoring & info visuals (24)
 * botstatus, statuscard, healthcheck, maintswitch, speedtest-link,
 * apistatus, dbstats, cachestats, downloads, topusers, topcommands,
 * recentcommands, activity, serverup, versioncheck, memoryhistory,
 * processinfo, netinfo, diskusage, environment2, sessioninfo,
 * pingcheck, uptimecard, banner
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import axios from 'axios';
import config from '../config.js';
import { settingsStore, usersStore, groupsStore, statsStore } from '../lib/db.js';
import { fmtBytes, fmtDate, fmtDuration, fmtSeconds, getSystemInfo, getUptime, withTimeout, http, truncate } from '../lib/helpers.js';
import { state, isConnected } from '../lib/bot.js';
import { countCommands, commandsByCategory } from '../lib/registry.js';
import { box, divider, bar } from '../lib/msg.js';
import { renderStatusCard } from '../lib/render.js';

const versionCheck = async () => {
  try {
    const { data } = await http.get('https://registry.npmjs.org/@whiskeysockets/baileys/latest', { timeout: 15000 });
    return data.version;
  } catch {
    return null;
  }
};

export default [
  {
    name: 'botstatus',
    aliases: ['statusbot'],
    category: 'status',
    description: 'Full bot status report',
    run: async (ctx) => {
      const sys = getSystemInfo();
      const cats = commandsByCategory();
      await ctx.reply(
        box(
          `${ctx.botName} Status`,
          `▸ 🟢 *Connection:* ${state.status}\n` +
            `▸ 📱 *Number:* ${state.botNumber ? `+${state.botNumber}` : 'not paired'}\n` +
            `▸ ⏱️ *Uptime:* ${fmtDuration(getUptime())}\n` +
            `▸ 🧩 *Commands:* ${countCommands()} in ${Object.keys(cats).length} categories\n` +
            `▸ 👥 *Users:* ${Object.keys(usersStore.data.users || {}).length} + ${(usersStore.data.premium || []).length} premium\n` +
            `▸ 👨‍👩‍👧‍👦 *Groups tracked:* ${Object.keys(groupsStore.data.groups || {}).length}\n` +
            `▸ 💾 *RAM:* ${fmtBytes(sys.processMem)}\n` +
            `▸ 🕒 *Time:* ${fmtDate()}`
        )
      );
    },
  },
  {
    name: 'statuscard',
    aliases: ['statusimage', 'botcard'],
    category: 'status',
    description: 'Generate a branded status card image',
    run: async (ctx) => {
      const sys = getSystemInfo();
      const img = await renderStatusCard({
        botName: ctx.botName,
        status: state.connected ? 'connected' : state.status,
        uptime: fmtDuration(getUptime()),
        number: state.botNumber,
        commandCount: countCommands(),
        memoryUsed: fmtBytes(sys.processMem),
        sessions: statsStore.data.sessions || 0,
      });
      await ctx.reply({ image: img, caption: `📊 *${ctx.botName} status card*` });
    },
  },
  {
    name: 'healthcheck',
    aliases: ['health'],
    category: 'status',
    description: 'Quick health check of the bot',
    run: async (ctx) => {
      const checks = [
        ['WhatsApp socket', isConnected() ? '✅' : '❌'],
        ['Command registry', countCommands() >= 300 ? '✅' : '⚠️'],
        ['Data store', fs.existsSync(config.files.users) ? '✅' : '❌'],
        ['Auth folder', fs.existsSync(config.paths.auth) ? '✅' : '❌'],
        ['Temp folder', fs.existsSync(config.paths.tmp) ? '✅' : '⚠️'],
      ];
      const ok = checks.every(([, v]) => v === '✅');
      await ctx.reply(
        box(`Health ${ok ? '✅ Healthy' : '⚠️ Attention'}`, checks.map(([label, v]) => `▸ ${label}: ${v}`).join('\n'))
      );
    },
  },
  {
    name: 'maintenance', aliases: ['maint'],
    aliases: ['maintenance'],
    category: 'status',
    description: 'Toggle maintenance mode (commands paused)',
    usage: '[on|off]',
    role: 'owner',
    run: async (ctx) => {
      if (!ctx.isOwner) return ctx.reply('🔒 Owner only.');
      const arg = (ctx.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: \`${ctx.prefix}maint on|off\``);
      state.maintenance = arg === 'on';
      await ctx.reply(`🛠️ Maintenance mode: *${state.maintenance ? 'ON' : 'OFF'}*`);
    },
  },
  {
    name: 'apitest',
    aliases: ['apistatus', 'netcheck'],
    category: 'status',
    description: 'Test reachability of the APIs the bot uses',
    run: async (ctx) => {
      const urls = [
        ['WhatsApp', 'https://web.whatsapp.com'],
        ['YouTube', 'https://www.youtube.com'],
        ['TikTok API', 'https://www.tikwm.com'],
        ['Telegram', 'https://t.me'],
        ['Exchange rates', 'https://open.er-api.com/v6/latest/USD'],
      ];
      await ctx.reply('🔌 Testing external services…');
      const results = [];
      for (const [name, url] of urls) {
        const start = Date.now();
        try {
          await withTimeout(axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true }), 12000);
          results.push(`▸ ${name}: 🟢 ${Date.now() - start} ms`);
        } catch {
          results.push(`▸ ${name}: 🔴 failed`);
        }
      }
      await ctx.reply(box('API Status', results.join('\n')));
    },
  },
  {
    name: 'dbstats',
    aliases: ['datastats'],
    category: 'status',
    description: 'Size of the bot JSON data stores',
    role: 'sudo',
    run: async (ctx) => {
      const files = Object.entries(config.files).map(([name, file]) => {
        const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
        return `▸ ${name}: ${fmtBytes(size)}`;
      });
      await ctx.reply(box('Data Stores', files.join('\n')));
    },
  },
  {
    name: 'downloads-stat',
    aliases: ['dlstats'],
    category: 'status',
    description: 'Download statistics',
    run: async (ctx) => {
      await ctx.reply(
        box('Download Stats', `▸ *Total downloads:* ${statsStore.data.downloads || 0}\n▸ *Max file size:* ${config.limits.maxDownloadMb} MB\n▸ *Fetch limit:* ${config.limits.maxFetchMb} MB`)
      );
    },
  },
  {
    name: 'topusers',
    aliases: ['leaderboard'],
    category: 'status',
    description: 'Most active bot users',
    run: async (ctx) => {
      const entries = Object.entries(statsStore.data.perUser || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const medals = ['🥇', '🥈', '🥉'];
      const lines = entries.map(([n, c], i) => `▸ ${medals[i] || `${i + 1}.`} +${n} — ${c} commands`);
      await ctx.reply(box('Top Users', lines.join('\n') || '▸ No data yet.'));
    },
  },
  {
    name: 'topcommands',
    aliases: ['topcmds'],
    category: 'status',
    description: 'Most used commands',
    run: async (ctx) => {
      const entries = Object.entries(statsStore.data.perCommand || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const max = entries[0]?.[1] || 1;
      const lines = entries.map(([c, n]) => `▸ ${c.padEnd(14)} ${bar((n / max) * 100, 10)} ${n}`);
      await ctx.reply(box('Top Commands', lines.join('\n') || '▸ No data yet.'));
    },
  },
  {
    name: 'activity',
    aliases: ['recent'],
    category: 'status',
    description: 'Recent bot activity counters',
    run: async (ctx) => {
      await ctx.reply(
        box(
          'Recent Activity',
          `▸ *Messages seen:* ${state.messagesSeen}\n` +
            `▸ *Commands handled:* ${state.commandsHandled}\n` +
            `▸ *Last message:* ${state.lastMessageAt ? fmtDate(new Date(state.lastMessageAt)) : 'n/a'}\n` +
            `▸ *Connected since:* ${state.connectedAt ? fmtDate(new Date(state.connectedAt)) : 'n/a'}\n` +
            `▸ *Reconnects:* ${state.reconnectAttempts}`
        )
      );
    },
  },
  {
    name: 'versioncheck',
    aliases: ['updatecheck'],
    category: 'status',
    description: 'Check the latest Baileys version on npm',
    run: async (ctx) => {
      const latest = await versionCheck();
      await ctx.reply(
        box(
          'Version Check',
          `▸ *Installed:* ${ctx.config ? '' : ''}Baileys 7.x\n▸ *Latest on npm:* ${latest || 'unknown'}\n` +
            `▸ *Bot version:* v${config.bot.version}\n▸ *Node:* ${process.version}`
        )
      );
    },
  },
  {
    name: 'processinfo',
    aliases: ['procinfo', 'pid'],
    category: 'status',
    description: 'Node process details',
    role: 'sudo',
    run: async (ctx) => {
      const mem = process.memoryUsage();
      await ctx.reply(
        box(
          'Process Info',
          `▸ *PID:* ${process.pid}\n▸ *Uptime:* ${fmtDuration(getUptime())}\n▸ *RSS:* ${fmtBytes(mem.rss)}\n▸ *Heap used:* ${fmtBytes(mem.heapUsed)}\n▸ *Heap total:* ${fmtBytes(mem.heapTotal)}\n▸ *External:* ${fmtBytes(mem.external)}\n▸ *Node:* ${process.version}\n▸ *Platform:* ${process.platform}`
        )
      );
    },
  },
  {
    name: 'netinfo',
    aliases: ['network'],
    category: 'status',
    description: 'Network interfaces of the host',
    role: 'sudo',
    run: async (ctx) => {
      const nets = os.networkInterfaces();
      const lines = [];
      for (const [name, list] of Object.entries(nets)) {
        for (const net of list || []) {
          if (net.family === 'IPv4' && !net.internal) lines.push(`▸ ${name}: ${net.address}`);
        }
      }
      await ctx.reply(box('Network Interfaces', lines.join('\n') || '▸ none'));
    },
  },
  {
    name: 'diskusage',
    aliases: ['disk', 'storage-info'],
    category: 'status',
    description: 'Disk space used by bot folders',
    role: 'sudo',
    run: async (ctx) => {
      const dirSize = (dir) => {
        try {
          return fs.readdirSync(dir).reduce((sum, f) => {
            const p = path.join(dir, f);
            const st = fs.statSync(p);
            return sum + (st.isDirectory() ? 0 : st.size);
          }, 0);
        } catch {
          return 0;
        }
      };
      await ctx.reply(
        box(
          'Disk Usage',
          `▸ Auth: ${fmtBytes(dirSize(config.paths.auth))}\n` +
            `▸ Data: ${fmtBytes(dirSize(config.paths.data))}\n` +
            `▸ Temp: ${fmtBytes(dirSize(config.paths.tmp))}\n` +
            `▸ Commands: ${fmtBytes(dirSize(config.paths.commands))}\n` +
            `▸ Assets: ${fmtBytes(dirSize(config.paths.assets))}`
        )
      );
    },
  },
  {
    name: 'pingcheck',
    aliases: ['multiping'],
    category: 'status',
    description: 'Ping several endpoints at once',
    run: async (ctx) => {
      const targets = [
        ['Google', 'https://www.google.com'],
        ['Cloudflare', 'https://1.1.1.1'],
        ['GitHub', 'https://api.github.com'],
      ];
      await ctx.reply('📡 Pinging…');
      const lines = [];
      for (const [name, url] of targets) {
        const t0 = Date.now();
        try {
          await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' }, validateStatus: () => true });
          lines.push(`▸ ${name}: 🟢 ${Date.now() - t0} ms`);
        } catch {
          lines.push(`▸ ${name}: 🔴 timeout`);
        }
      }
      await ctx.reply(box('Ping Results', lines.join('\n')));
    },
  },
  {
    name: 'uptimecard',
    aliases: ['uptimeinfo'],
    category: 'status',
    description: 'Cute uptime breakdown',
    run: async (ctx) => {
      const ms = getUptime();
      const totalSeconds = Math.floor(ms / 1000);
      await ctx.reply(
        box(
          'Uptime',
          `▸ 🗓️ Days: ${Math.floor(totalSeconds / 86400)}\n` +
            `▸ ⏰ Hours: ${Math.floor((totalSeconds % 86400) / 3600)}\n` +
            `▸ ⏱️ Minutes: ${Math.floor((totalSeconds % 3600) / 60)}\n` +
            `▸ ⚡ Seconds: ${totalSeconds % 60}\n\n▸ *Total:* ${fmtDuration(ms)}`
        )
      );
    },
  },
  {
    name: 'banner',
    aliases: ['brandbanner'],
    category: 'status',
    description: 'Show the bot brand banner',
    run: async (ctx) => {
      await ctx.reply(
        box(
          ctx.botName,
          `▸ WhatsApp automation, done right.\n▸ ${countCommands()} commands\n▸ Built on Baileys\n▸ Dashboard pairing\n\n_${config.bot.creator} • v${config.bot.version}_`
        )
      );
    },
  },
  {
    name: 'whoami2',
    aliases: ['sessionme'],
    category: 'status',
    description: 'Session details for you',
    run: async (ctx) => {
      await ctx.reply(
        box(
          'Your Session',
          `▸ Number: +${ctx.senderNumber}\n▸ Role: ${ctx.role}\n▸ Chat: ${ctx.isGroup ? 'group' : 'private'}\n▸ Commands: ${statsStore.data.perUser?.[ctx.senderNumber] || 0}\n▸ Bot mode: ${settingsStore.data.public ? 'public' : 'private'}`
        )
      );
    },
  },
  {
    name: 'serverup',
    aliases: ['nodeuptime'],
    category: 'status',
    description: 'Host and Node uptime comparison',
    run: async (ctx) => {
      await ctx.reply(
        box(
          'Uptime Comparison',
          `▸ Host uptime: ${fmtDuration(os.uptime() * 1000)}\n▸ Node process: ${fmtDuration(getUptime())}\n▸ Bot session: ${state.connectedAt ? fmtDuration(Date.now() - state.connectedAt) : 'offline'}`
        )
      );
    },
  },
  {
    name: 'memoryhistory',
    aliases: ['memwatch'],
    category: 'status',
    description: 'Memory usage snapshot over a few seconds',
    cooldown: 10,
    run: async (ctx) => {
      const samples = [];
      for (let i = 0; i < 3; i += 1) {
        samples.push(fmtBytes(process.memoryUsage().rss));
        await new Promise((r) => setTimeout(r, 1200));
      }
      await ctx.reply(box('Memory Snapshots', samples.map((s, i) => `▸ T+${i}s: ${s}`).join('\n')));
    },
  },
  {
    name: 'botpresence',
    aliases: ['presencestatus'],
    category: 'status',
    description: 'Check/set the bot presence',
    usage: '[available|unavailable]',
    run: async (ctx) => {
      const value = (ctx.args[0] || '').toLowerCase();
      if (!value) {
        return ctx.reply(`▸ *Presence:* ${settingsStore.data.presence.status}\n▸ Usage: \`${ctx.prefix}botpresence available\``);
      }
      if (!['available', 'unavailable'].includes(value)) return ctx.reply('❌ Use available or unavailable.');
      await ctx.sock.sendPresenceUpdate(value);
      settingsStore.data.presence.status = value;
      settingsStore.persist();
      await ctx.reply(`✅ Presence: *${value}*`);
    },
  },
  {
    name: 'cat-stats',
    aliases: ['counts'],
    category: 'status',
    description: 'Counts for commands, users and groups',
    run: async (ctx) => {
      await ctx.reply(
        box(
          'Counts',
          `▸ Commands: ${countCommands()}\n▸ Categories: ${Object.keys(commandsByCategory()).length}\n▸ Added users: ${Object.keys(usersStore.data.users || {}).length}\n▸ Sudo: ${(usersStore.data.sudo || []).length}\n▸ Premium: ${(usersStore.data.premium || []).length}\n▸ Bans: ${(usersStore.data.bans || []).length}\n▸ Groups: ${Object.keys(groupsStore.data.groups || {}).length}`
        )
      );
    },
  },
  {
    name: 'lastseen',
    aliases: ['lastactive'],
    category: 'status',
    description: 'Your last recorded activity',
    run: async (ctx) => {
      const rec = usersStore.data.users[ctx.senderNumber];
      await ctx.reply(
        box(
          'Last Activity',
          `▸ Last command: ${rec?.lastCommandAt ? fmtDate(new Date(rec.lastCommandAt)) : 'no record'}\n▸ Total commands: ${rec?.commands || statsStore.data.perUser?.[ctx.senderNumber] || 0}`
        )
      );
    },
  },
  {
    name: 'quickstats',
    aliases: ['snapshot'],
    category: 'status',
    description: 'One-line bot snapshot',
    run: async (ctx) => {
      await ctx.reply(
        `⚡ *${ctx.botName} snapshot*\n` +
          `▸ ${state.connected ? '🟢 online' : '🔴 offline'} | ⏱️ ${fmtDuration(getUptime())} | 🧩 ${countCommands()} cmds | 💾 ${fmtBytes(process.memoryUsage().rss)} | 📨 ${state.commandsHandled} handled`
      );
    },
  },
];
