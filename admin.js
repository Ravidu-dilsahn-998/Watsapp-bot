/**
 * IP DILSAHN - bot admin commands (28)
 * setpp, setstatus-bio, broadcasts, backup, reset, cleartmp, autostatus,
 * autoread, autoreply, antidelete, anticall, chatbot, keeponline,
 * autotyping, block, unblock, blocked, autocorrect, setpresence,
 * setwarnlimit, setloglevel, config, env, reload, eval-safe, sleep,
 * shutdown
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import config from '../config.js';
import { settingsStore, usersStore, groupsStore, statsStore, triggersStore, flushAll } from '../lib/db.js';
import { updateFeature, normalizeNumber } from '../lib/users.js';
import { fmtBytes, fmtDate, fmtDuration, cleanOldFiles, getUptime, getSystemInfo, truncate } from '../lib/helpers.js';
import { state, broadcastText } from '../lib/bot.js';
import { box } from '../lib/msg.js';
import { countCommands, commandsByCategory } from '../lib/registry.js';

const requireOwner = async (ctx) => {
  if (!ctx.isOwner) {
    await ctx.reply('🔒 *Owner only* command.');
    return false;
  }
  return true;
};

const toggleFeature = (name, label) => ({
  name,
  aliases: [],
  category: 'admin',
  description: `Toggle ${label}`,
  usage: '[on|off]',
  role: 'sudo',
  run: async (ctx) => {
    const arg = (ctx.args[0] || '').toLowerCase();
    const current = !!settingsStore.data.features[name];
    if (!arg) {
      return ctx.reply(`${current ? '🟢' : '🔴'} *${name}* is currently *${current ? 'ON' : 'OFF'}*\n\nUsage: \`${ctx.prefix}${name} on|off\``);
    }
    if (!['on', 'off'].includes(arg)) return ctx.reply(`Usage: \`${ctx.prefix}${name} on|off\``);
    updateFeature(name, arg === 'on');
    await ctx.reply(`${arg === 'on' ? '🟢 Enabled' : '🔴 Disabled'} *${label}*`);
  },
});

export default [
  {
    name: 'setpp',
    aliases: ['setprofilepic', 'botpp'],
    category: 'admin',
    description: 'Change the bot profile picture',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      if (!ctx.quoted?.message) return ctx.reply('Reply to an image with `.setpp`.');
      const buffer = await ctx.downloadQuoted('buffer');
      await ctx.sock.updateProfilePicture(ctx.sock.user.id, buffer);
      await ctx.reply('✅ Bot profile picture updated.');
    },
  },

  {
    name: 'setbio',
    aliases: ['setabout', 'setstatus-bio'],
    category: 'admin',
    description: 'Change the bot about/status text',
    usage: '<text>',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}setbio <text>\``);
      await ctx.sock.updateProfileStatus(ctx.argText.slice(0, 139));
      await ctx.reply('✅ Bot bio updated.');
    },
  },

  {
    name: 'broadcast',
    aliases: ['bc', 'announce'],
    category: 'admin',
    description: 'Send a message to all authorised users',
    usage: '<message>',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}broadcast <message>\``);
      await ctx.reply('📢 Broadcasting…');
      const sent = await broadcastText(`📢 *Announcement from ${ctx.botName}*\n\n${ctx.argText}\n\n_${fmtDate()}_`);
      await ctx.reply(`✅ Broadcast sent to ${sent} user(s).`);
    },
  },

  {
    name: 'backup',
    aliases: ['backupdata'],
    category: 'admin',
    description: 'Download a backup of the bot data (JSON files)',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const files = [config.files.settings, config.files.users, config.files.groups, config.files.stats, config.files.triggers];
      const payload = {};
      for (const file of files) {
        if (!fs.existsSync(file)) continue;
        payload[path.basename(file)] = JSON.parse(fs.readFileSync(file, 'utf8'));
      }
      flushAll();
      const buf = Buffer.from(JSON.stringify(payload, null, 2));
      await ctx.reply(
        { document: buf, mimetype: 'application/json', fileName: `dilsahn-backup-${Date.now()}.json`, caption: '💾 *Bot data backup*' },
        { quoted: ctx.msg }
      );
    },
  },

  {
    name: 'resetdata',
    aliases: ['resetstats'],
    category: 'admin',
    description: 'Reset statistics counters',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      statsStore.data.totalCommands = 0;
      statsStore.data.perCommand = {};
      statsStore.data.perUser = {};
      statsStore.persist();
      await ctx.reply('✅ Statistics reset.');
    },
  },

  {
    name: 'cleartmp',
    aliases: ['clearcache'],
    category: 'admin',
    description: 'Delete temporary download files',
    role: 'sudo',
    run: async (ctx) => {
      cleanOldFiles(0);
      const files = fs.existsSync(config.paths.tmp) ? fs.readdirSync(config.paths.tmp).length : 0;
      await ctx.reply(`🧹 Temp folder cleared. ${files} file(s) remaining.`);
    },
  },

  toggleFeature('autoreply', 'auto-reply triggers'),
  toggleFeature('autoread', 'auto-read receipts'),
  toggleFeature('autoviewstatus', 'auto-view status'),
  toggleFeature('autoreactstatus', 'auto-react to status'),
  {
    name: 'antilinkglobal',
    aliases: ['globalantilink'],
    category: 'admin',
    description: 'Toggle global anti-link for all groups',
    usage: '[on|off]',
    role: 'sudo',
    run: async (ctx) => {
      const arg = (ctx.args[0] || '').toLowerCase();
      const current = !!settingsStore.data.features.antilink;
      if (!['on', 'off'].includes(arg)) {
        return ctx.reply(`${current ? '🟢' : '🔴'} Global anti-link is *${current ? 'ON' : 'OFF'}*\n\nUsage: \`${ctx.prefix}antilinkglobal on|off\`\nPer-group control: \`${ctx.prefix}antilink\``);
      }
      updateFeature('antilink', arg === 'on');
      await ctx.reply(`${arg === 'on' ? '🟢 Enabled' : '🔴 Disabled'} global anti-link.`);
    },
  },
  toggleFeature('antidelete', 'anti-delete'),
  toggleFeature('anticall', 'anti-call'),
  toggleFeature('chatbot', 'chat-bot replies'),
  toggleFeature('keeponline', 'keep-online presence'),
  toggleFeature('autotyping', 'auto typing presence'),
  {
    name: 'welcomeglobal',
    aliases: ['globalwelcome'],
    category: 'admin',
    description: 'Toggle welcome messages globally',
    usage: '[on|off]',
    role: 'sudo',
    run: async (ctx) => {
      const arg = (ctx.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(arg)) {
        return ctx.reply(`${settingsStore.data.features.welcome ? '🟢' : '🔴'} Global welcome is *${settingsStore.data.features.welcome ? 'ON' : 'OFF'}*\n\nUsage: \`${ctx.prefix}welcomeglobal on|off\``);
      }
      updateFeature('welcome', arg === 'on');
      await ctx.reply(`${arg === 'on' ? '🟢 Enabled' : '🔴 Disabled'} global welcome messages.`);
    },
  },
  {
    name: 'goodbyeglobal',
    aliases: ['globalgoodbye'],
    category: 'admin',
    description: 'Toggle goodbye messages globally',
    usage: '[on|off]',
    role: 'sudo',
    run: async (ctx) => {
      const arg = (ctx.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(arg)) {
        return ctx.reply(`${settingsStore.data.features.goodbye ? '🟢' : '🔴'} Global goodbye is *${settingsStore.data.features.goodbye ? 'ON' : 'OFF'}*\n\nUsage: \`${ctx.prefix}goodbyeglobal on|off\``);
      }
      updateFeature('goodbye', arg === 'on');
      await ctx.reply(`${arg === 'on' ? '🟢 Enabled' : '🔴 Disabled'} global goodbye messages.`);
    },
  },
  toggleFeature('autosticker', 'auto-sticker mode'),

  {
    name: 'block',
    category: 'admin',
    description: 'Block a contact on WhatsApp',
    usage: '<number|@user>',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const n = ctx.mentions[0] ? ctx.mentions[0].split('@')[0] : normalizeNumber(ctx.args[0] || '');
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}block 94712345678\``);
      await ctx.sock.updateBlockStatus(`${n}@s.whatsapp.net`, 'block');
      await ctx.reply(`🚫 Blocked +${n}`);
    },
  },

  {
    name: 'unblock',
    category: 'admin',
    description: 'Unblock a contact',
    usage: '<number>',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const n = normalizeNumber(ctx.args[0] || '');
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}unblock 94712345678\``);
      await ctx.sock.updateBlockStatus(`${n}@s.whatsapp.net`, 'unblock');
      await ctx.reply(`✅ Unblocked +${n}`);
    },
  },

  {
    name: 'blocked',
    aliases: ['blocklist'],
    category: 'admin',
    description: 'Show locally banned numbers',
    role: 'sudo',
    run: async (ctx) => {
      const bans = usersStore.data.bans || [];
      const lines = bans.map((b, i) => `▸ ${i + 1}. +${normalizeNumber(b.number || b)}`);
      await ctx.reply(box('Local Bans', lines.join('\n') || '▸ none'));
    },
  },

  {
    name: 'setpresence',
    aliases: ['presence'],
    category: 'admin',
    description: 'Set the bot presence (available/unavailable)',
    usage: '<available|unavailable|composing|recording>',
    role: 'sudo',
    run: async (ctx) => {
      const value = (ctx.args[0] || '').toLowerCase();
      const allowed = ['available', 'unavailable', 'composing', 'recording', 'paused'];
      if (!allowed.includes(value)) return ctx.reply(`Usage: \`${ctx.prefix}setpresence <${allowed.join('|')}>\``);
      await ctx.sock.sendPresenceUpdate(value);
      settingsStore.data.presence.status = value;
      settingsStore.persist();
      await ctx.reply(`✅ Presence set to *${value}*`);
    },
  },

  {
    name: 'setwarnlimit',
    aliases: ['warnlimit'],
    category: 'admin',
    description: 'Set how many warnings before a kick',
    usage: '<number 1-10>',
    role: 'sudo',
    run: async (ctx) => {
      const limit = Math.min(10, Math.max(1, parseInt(ctx.args[0], 10) || 3));
      settingsStore.data.moderation.warnLimit = limit;
      settingsStore.persist();
      await ctx.reply(`✅ Warning limit set to *${limit}*`);
    },
  },

  {
    name: 'config',
    aliases: ['showconfig'],
    category: 'admin',
    description: 'Show the active bot configuration',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const safe = {
        botName: settingsStore.data.botName,
        prefix: settingsStore.data.prefix,
        ownerNumbers: settingsStore.data.ownerNumbers,
        public: settingsStore.data.public,
        features: settingsStore.data.features,
        moderation: settingsStore.data.moderation,
        limits: config.limits,
      };
      await ctx.reply(`⚙️ *Configuration*\n\n\`\`\`${JSON.stringify(safe, null, 2).slice(0, 1200)}\`\`\``);
    },
  },

  {
    name: 'env',
    aliases: ['environment'],
    category: 'admin',
    description: 'Show safe environment info',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const keys = ['PORT', 'NODE_ENV', 'BOT_NAME', 'BOT_PREFIX', 'OWNER_NUMBER', 'MAX_DOWNLOAD_MB', 'LOG_LEVEL'];
      const lines = keys.map((k) => `▸ ${k}: ${process.env[k] ?? '(not set)'}`);
      await ctx.reply(box('Environment', lines.join('\n')));
    },
  },

  {
    name: 'reload',
    category: 'admin',
    description: 'Reload the command registry from disk',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const { loadCommands } = await import('../lib/commands.js');
      const { registry, lookup } = await import('../lib/registry.js');
      registry.clear();
      lookup.clear();
      const res = await loadCommands();
      await ctx.reply(`✅ Reloaded *${res.count}* commands from ${res.files} files.`);
    },
  },

  {
    name: 'shutdown',
    aliases: ['poweroff'],
    category: 'admin',
    description: 'Stop the bot process',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      await ctx.reply('🛑 Shutting down. Restart the service from your host dashboard.');
      const { shutdown } = await import('../lib/bot.js');
      setTimeout(() => shutdown('command'), 1200);
    },
  },

  {
    name: 'sleepbot',
    aliases: ['sleepmode'],
    category: 'admin',
    description: 'Stop responding to commands for N minutes',
    usage: '<minutes>',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const minutes = Math.min(720, Math.max(1, parseInt(ctx.args[0], 10) || 5));
      state.sleepUntil = Date.now() + minutes * 60000;
      await ctx.reply(`😴 Bot will ignore commands for ${minutes} minute(s).`);
    },
  },

  {
    name: 'wake',
    aliases: ['wakeup'],
    category: 'admin',
    description: 'Wake the bot from sleep mode',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      state.sleepUntil = 0;
      await ctx.reply('☀️ Bot is awake and accepting commands.');
    },
  },

  {
    name: 'addtrigger',
    aliases: ['settrigger'],
    category: 'admin',
    description: 'Add an auto-reply trigger',
    usage: '<keyword> | <reply>',
    role: 'sudo',
    example: '.addtrigger price | Our prices are on the website',
    run: async (ctx) => {
      const [keyword, ...replyParts] = ctx.argText.split('|');
      if (!keyword?.trim() || !replyParts.length) {
        return ctx.reply(`Usage: \`${ctx.prefix}addtrigger keyword | reply text\``);
      }
      triggersStore.data.triggers[keyword.trim().toLowerCase()] = replyParts.join('|').trim();
      triggersStore.persist();
      await ctx.reply(`✅ Trigger added for *${keyword.trim()}*`);
    },
  },

  {
    name: 'deltrigger',
    aliases: ['removetrigger'],
    category: 'admin',
    description: 'Remove an auto-reply trigger',
    usage: '<keyword>',
    role: 'sudo',
    run: async (ctx) => {
      const key = ctx.argText.trim().toLowerCase();
      if (!key) return ctx.reply(`Usage: \`${ctx.prefix}deltrigger <keyword>\``);
      if (!(key in triggersStore.data.triggers)) return ctx.reply('❌ No such trigger.');
      delete triggersStore.data.triggers[key];
      triggersStore.persist();
      await ctx.reply(`🗑️ Trigger *${key}* removed.`);
    },
  },

  {
    name: 'listtriggers',
    aliases: ['triggers'],
    category: 'admin',
    description: 'List all auto-reply triggers',
    role: 'sudo',
    run: async (ctx) => {
      const entries = Object.entries(triggersStore.data.triggers || {});
      const lines = entries.map(([k, v], i) => `▸ ${i + 1}. *${k}* → ${truncate(String(v), 40)}`);
      await ctx.reply(box(`Triggers (${entries.length})`, lines.join('\n') || '▸ none'));
    },
  },

  {
    name: 'setloglevel',
    aliases: ['loglevel'],
    category: 'admin',
    description: 'Set console log level',
    usage: '<info|debug>',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      const level = (ctx.args[0] || '').toLowerCase();
      if (!['info', 'debug'].includes(level)) return ctx.reply(`Usage: \`${ctx.prefix}setloglevel info|debug\``);
      config.logLevel = level;
      await ctx.reply(`✅ Log level set to *${level}*`);
    },
  },

  {
    name: 'addgroup',
    aliases: ['registergroup'],
    category: 'admin',
    description: 'Register a group with custom settings',
    usage: '<group jid> [name]',
    role: 'sudo',
    run: async (ctx) => {
      const jid = ctx.args[0] || ctx.chatId;
      if (!jid.endsWith('@g.us')) return ctx.reply('❌ Provide a group JID ending with @g.us');
      groupsStore.data.groups ||= {};
      groupsStore.data.groups[jid] ||= { id: jid, welcome: true, goodbye: true, createdAt: new Date().toISOString() };
      groupsStore.data.groups[jid].name = ctx.args.slice(1).join(' ') || groupsStore.data.groups[jid].name;
      groupsStore.persist();
      await ctx.reply(`✅ Group registered: ${jid}`);
    },
  },

  {
    name: 'serverstats',
    aliases: ['hoststats'],
    category: 'admin',
    description: 'Detailed host statistics',
    role: 'sudo',
    run: async (ctx) => {
      const sys = getSystemInfo();
      const load = os.loadavg().map((n) => n.toFixed(2)).join(' / ');
      await ctx.reply(
        box(
          'Host Statistics',
          `▸ *Uptime:* ${fmtDuration(getUptime())}\n` +
            `▸ *Load avg:* ${load}\n` +
            `▸ *RAM used:* ${fmtBytes(sys.usedMem)} / ${fmtBytes(sys.totalMem)}\n` +
            `▸ *Process RSS:* ${fmtBytes(sys.processMem)}\n` +
            `▸ *CPUs:* ${sys.cpus}\n` +
            `▸ *Node:* ${sys.node}\n` +
            `▸ *Commands registered:* ${countCommands()}\n` +
            `▸ *Free tmp:* ${fmtBytes(os.freemem())}\n` +
            `▸ *Last update:* ${fmtDate()}`
        )
      );
    },
  },

  {
    name: 'sessions',
    aliases: ['sessioninfo'],
    category: 'admin',
    description: 'Inspect the stored auth session',
    role: 'owner',
    run: async (ctx) => {
      if (!(await requireOwner(ctx))) return;
      let files = 0;
      let size = 0;
      try {
        for (const f of fs.readdirSync(config.paths.auth)) {
          files += 1;
          size += fs.statSync(path.join(config.paths.auth, f)).size;
        }
      } catch {
        /* ignore */
      }
      await ctx.reply(
        box(
          'Session Info',
          `▸ *Auth files:* ${files}\n` +
            `▸ *Auth size:* ${fmtBytes(size)}\n` +
            `▸ *Connected:* ${state.connected ? 'yes' : 'no'}\n` +
            `▸ *Bot number:* ${state.botNumber ? `+${state.botNumber}` : 'n/a'}\n` +
            `▸ *Sessions started:* ${statsStore.data.sessions || 0}`
        )
      );
    },
  },

  {
    name: 'logs',
    aliases: ['recentlogs'],
    category: 'admin',
    description: 'Summary of recent activity',
    role: 'sudo',
    run: async (ctx) => {
      const perCmd = Object.entries(statsStore.data.perCommand || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      await ctx.reply(
        box(
          'Recent Activity',
          `▸ *Messages seen:* ${state.messagesSeen}\n` +
            `▸ *Commands handled:* ${state.commandsHandled}\n` +
            `▸ *Last command:* ${statsStore.data.lastCommandAt || 'n/a'}\n\n` +
            `*Top:*\n${perCmd.map(([c, n]) => `▸ ${c}: ${n}`).join('\n') || 'none'}`
        )
      );
    },
  },

  {
    name: 'diag',
    aliases: ['diagnose', 'doctor'],
    category: 'admin',
    description: 'Run a quick self-diagnostic',
    role: 'sudo',
    run: async (ctx) => {
      const checks = [];
      checks.push(`▸ Socket: ${state.connected ? '✅ connected' : '❌ disconnected'}`);
      checks.push(`▸ Commands loaded: ${countCommands() >= 300 ? '✅' : '⚠️'} ${countCommands()}`);
      checks.push(`▸ Auth folder: ${fs.existsSync(config.paths.auth) ? '✅' : '❌'}`);
      checks.push(`▸ Data folder: ${fs.existsSync(config.paths.data) ? '✅' : '❌'}`);
      try {
        const ffmpegPath = (await import('ffmpeg-static')).default;
        checks.push(`▸ ffmpeg: ${ffmpegPath && fs.existsSync(ffmpegPath) ? '✅' : '⚠️ missing'}`);
      } catch {
        checks.push('▸ ffmpeg: ⚠️ not found');
      }
      const cats = Object.keys(commandsByCategory()).length;
      checks.push(`▸ Categories: ${cats}`);
      await ctx.reply(box('Self Diagnostic', checks.join('\n')));
    },
  },
];
