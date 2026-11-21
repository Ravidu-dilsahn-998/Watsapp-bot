/**
 * IP DILSAHN - general commands (24)
 * menu, commandinfo, donate, ping, alive, owner, botinfo, disclaimer,
 * totalcommands, stats, sysinfo, report, id, contactme, prefix, afk,
 * groupinvite, rules, version, privacy, suggest, source, plugins, restart
 */

import config from '../config.js';
import { getCommand, commandsByCategory, countCommands, countAliases, CATEGORY_META } from '../lib/registry.js';
import {
  getBotName,
  getPrefix,
  fmtDate,
  fmtDuration,
  fmtBytes,
  getUptime,
  getSystemInfo,
  mono,
} from '../lib/helpers.js';
import { state } from '../lib/bot.js';
import { renderMenuCard } from '../lib/render.js';
import { box, divider } from '../lib/msg.js';
import { settingsStore, statsStore } from '../lib/db.js';

const categoryOrder = ['general', 'users', 'download', 'media', 'tools', 'group', 'admin', 'fun', 'text', 'status', 'anime', 'converter'];

const buildCategoryMenu = (ctx, onlyCategory = null) => {
  const grouped = commandsByCategory();
  const lines = [];
  const cats = onlyCategory ? [onlyCategory] : categoryOrder.filter((c) => grouped[c]);

  for (const cat of cats) {
    const list = (grouped[cat] || []).filter((c) => !c.hidden);
    if (!list.length) continue;
    const meta = CATEGORY_META[cat] || { emoji: '📁', title: cat };
    lines.push(`\n${meta.emoji} *${meta.title.toUpperCase()}* (${list.length})`);
    lines.push(divider());
    for (const cmd of list) {
      const lock = cmd.role !== 'guest' ? ' 🔒' : '';
      lines.push(`▸ \`${ctx.prefix}${cmd.name}\`${lock} — ${cmd.description}`);
    }
  }
  return lines.join('\n');
};

const ownerJids = (ctx) =>
  (ctx.settings.ownerNumbers || config.owner.numbers || [])
    .map((n) => String(n).replace(/[^0-9]/g, ''))
    .filter(Boolean)
    .map((n) => `${n}@s.whatsapp.net`);

export default [
  {
    name: 'menu',
    aliases: ['list', 'help', 'commands', 'cmds'],
    category: 'general',
    description: 'Show the full command menu',
    usage: '[category]',
    example: '.menu download',
    run: async (ctx) => {
      const grouped = commandsByCategory();
      const visibleCats = categoryOrder.filter((c) => grouped[c]);
      const requested = (ctx.args[0] || '').toLowerCase();
      const only = visibleCats.includes(requested) ? requested : null;

      const totalVisible = Object.values(grouped).flat().filter((c) => !c.hidden).length;
      const header =
        `╭━━〔 *${getBotName()}* 〕━━╮\n` +
        `┃ 👤 *User:* ${ctx.pushName}\n` +
        `┃ 🎖️ *Access:* ${ctx.role}\n` +
        `┃ 🔑 *Prefix:* ${ctx.prefix}\n` +
        `┃ 📦 *Commands:* ${totalVisible} + ${countAliases()} aliases\n` +
        `┃ ⏱️ *Uptime:* ${fmtDuration(getUptime())}\n` +
        `┃ 🕒 *Time:* ${fmtDate()}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯`;

      const footer =
        `\n\n📌 Usage: \`${ctx.prefix}command\` or \`${ctx.prefix}command <args>\`\n` +
        `🔒 = restricted command\n` +
        `💡 \`${ctx.prefix}menu <category>\` shows one category`;

      const body = buildCategoryMenu(ctx, only);

      try {
        const img = await renderMenuCard({
          botName: getBotName(),
          prefix: ctx.prefix,
          commandCount: totalVisible,
          categoryCount: visibleCats.length,
          role: ctx.role,
          username: ctx.pushName,
        });
        await ctx.reply({ image: img, caption: `${header}\n${body}${footer}` });
      } catch {
        await ctx.reply(`${header}\n${body}${footer}`);
      }
    },
  },

  {
    name: 'commandinfo',
    aliases: ['cmdi', 'ci'],
    category: 'general',
    description: 'Show details of one command',
    usage: '<command>',
    run: async (ctx) => {
      const target = (ctx.args[0] || '').toLowerCase();
      if (!target) return ctx.reply(`Usage: \`${ctx.prefix}commandinfo <command>\``);
      const cmd = getCommand(target);
      if (!cmd) return ctx.reply(`❌ Unknown command: \`${target}\``);
      await ctx.reply(
        box(
          `Command: ${cmd.name}`,
          `▸ *Category:* ${cmd.category}\n` +
            `▸ *Role:* ${cmd.role}\n` +
            `▸ *Scope:* ${cmd.scope}\n` +
            `▸ *Usage:* ${cmd.usage ? `${ctx.prefix}${cmd.name} ${cmd.usage}` : `${ctx.prefix}${cmd.name}`}\n` +
            `▸ *Aliases:* ${cmd.aliases.length ? cmd.aliases.join(', ') : 'none'}\n\n` +
            `▸ *Description:* ${cmd.description}`
        )
      );
    },
  },

  {
    name: 'donate',
    aliases: ['support', 'contribute'],
    category: 'general',
    description: 'How to support the bot project',
    run: async (ctx) =>
      ctx.reply(
        box(
          `${getBotName()} Support`,
          `This bot is self-hosted and free.\n\n▸ ⭐ Star the project\n▸ 📢 Share it with friends\n▸ ☕ Say thanks to the owner\n\n_No payments are handled by the bot._`,
          'Thank you for using the bot!'
        )
      ),
  },

  {
    name: 'ping',
    aliases: ['pong', 'latency'],
    category: 'general',
    description: 'Measure the bot response speed',
    run: async (ctx) => {
      const start = Date.now();
      const sent = await ctx.reply('🏓 *Pinging…*');
      const latency = Date.now() - start;
      const verdict = latency < 700 ? '🟢 Excellent' : latency < 1500 ? '🟡 Good' : '🔴 Slow';
      const text =
        `🏓 *PONG!*\n\n` +
        `▸ *Round trip:* ${latency} ms\n` +
        `▸ *Quality:* ${verdict}\n` +
        `▸ *Server uptime:* ${fmtDuration(getUptime())}\n\n` +
        `_${getBotName()} is alive._`;
      try {
        await ctx.sock.sendMessage(ctx.chatId, { text, edit: sent.key }, { quoted: ctx.msg });
      } catch {
        await ctx.reply(text);
      }
    },
  },

  {
    name: 'alive',
    aliases: ['isalive'],
    category: 'general',
    description: 'Check if the bot is online',
    run: async (ctx) => {
      const sys = getSystemInfo();
      await ctx.reply(
        box(
          `${getBotName()} is Alive`,
          `▸ ✅ *Status:* ${state.connected ? 'Online' : 'Offline'}\n` +
            `▸ ⏱️ *Uptime:* ${fmtDuration(getUptime())}\n` +
            `▸ 📨 *Commands handled:* ${state.commandsHandled}\n` +
            `▸ 👀 *Messages seen:* ${state.messagesSeen}\n` +
            `▸ 💾 *Memory:* ${fmtBytes(sys.processMem)}\n` +
            `▸ 🖥️ *Node:* ${sys.node}\n` +
            `▸ 🕒 *Time:* ${fmtDate()}`
        )
      );
    },
  },

  {
    name: 'owner',
    aliases: ['creator'],
    category: 'general',
    description: 'Show the bot owner contact',
    run: async (ctx) => {
      const owners = (ctx.settings.ownerNumbers || config.owner.numbers || [])
        .map((n) => String(n).replace(/[^0-9]/g, ''))
        .filter(Boolean);
      const lines = owners.length
        ? owners.map((n, i) => `▸ Owner ${i + 1}: https://wa.me/${n}`).join('\n')
        : '▸ Owner contact not configured.';
      await ctx.reply(
        box(
          `Owner of ${getBotName()}`,
          `${lines}\n\n▸ *Name:* ${ctx.settings.ownerName || config.owner.name}`
        )
      );
    },
  },

  {
    name: 'botinfo',
    aliases: ['info', 'about'],
    category: 'general',
    description: 'Technical information about the bot',
    run: async (ctx) => {
      const sys = getSystemInfo();
      await ctx.reply(
        box(
          `${getBotName()} — Bot Info`,
          `▸ 🤖 *Name:* ${getBotName()}\n` +
            `▸ 🏷️ *Version:* v${config.bot.version}\n` +
            `▸ 🧩 *Commands:* ${countCommands()}\n` +
            `▸ 🔑 *Prefix:* ${getPrefix()}\n` +
            `▸ 👑 *Owner:* ${ctx.settings.ownerName || config.owner.name}\n` +
            `▸ 📱 *Bot number:* ${state.botNumber ? `+${state.botNumber}` : 'not paired'}\n` +
            `▸ 🟢 *Status:* ${state.status}\n` +
            `▸ ⏱️ *Uptime:* ${fmtDuration(getUptime())}\n` +
            `▸ 🖥️ *Platform:* ${sys.platform} (${sys.arch})\n` +
            `▸ ⚙️ *CPU:* ${sys.cpus} cores\n` +
            `▸ 💾 *RAM:* ${fmtBytes(sys.usedMem)} / ${fmtBytes(sys.totalMem)} (${sys.memPercent}%)\n` +
            `▸ 🟢 *Node.js:* ${sys.node}\n` +
            `▸ 📡 *Library:* Baileys 7.x`
        )
      );
    },
  },

  {
    name: 'disclaimer',
    aliases: ['terms', 'policy'],
    category: 'general',
    description: 'Read the usage disclaimer',
    run: async (ctx) =>
      ctx.reply(
        box(
          'Disclaimer',
          `This bot is an unofficial WhatsApp client.\n\n` +
            `▸ Not affiliated with WhatsApp or Meta.\n` +
            `▸ Use at your own risk — spam can get a number banned.\n` +
            `▸ Respect the terms of service of WhatsApp and of any source you download from.\n` +
            `▸ Keep the auth/ folder private.\n\n` +
            `_By using ${getBotName()} you accept these terms._`
        )
      ),
  },

  {
    name: 'totalcommands',
    aliases: ['cmdcount', 'cc'],
    category: 'general',
    description: 'Exact number of registered commands',
    run: async (ctx) => {
      const byCat = commandsByCategory();
      const lines = categoryOrder
        .filter((c) => byCat[c])
        .map((c) => {
          const meta = CATEGORY_META[c] || { emoji: '📁', title: c };
          return `▸ ${meta.emoji} ${meta.title}: ${byCat[c].length}`;
        })
        .join('\n');
      await ctx.reply(
        box('Command Count', `${lines}\n\n▸ *Total commands:* ${countCommands()}\n▸ *Aliases:* ${countAliases()}`)
      );
    },
  },

  {
    name: 'stats',
    aliases: ['botstats'],
    category: 'general',
    description: 'Bot usage statistics',
    run: async (ctx) => {
      const s = statsStore.data;
      const top = Object.entries(s.perCommand || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c, n], i) => `▸ ${i + 1}. ${c}: ${n}`)
        .join('\n');
      await ctx.reply(
        box(
          'Statistics',
          `▸ *Total commands:* ${s.totalCommands || 0}\n` +
            `▸ *Messages seen:* ${s.messagesSeen || 0}\n` +
            `▸ *Downloads:* ${s.downloads || 0}\n` +
            `▸ *Sessions:* ${s.sessions || 0}\n` +
            `▸ *Pairing codes:* ${s.pairingCodes || 0}\n\n` +
            `*Top commands:*\n${top || '▸ none yet'}`
        )
      );
    },
  },

  {
    name: 'sysinfo',
    aliases: ['system', 'memory', 'ram', 'sys'],
    category: 'general',
    description: 'CPU, memory and uptime of the host',
    run: async (ctx) => {
      const sys = getSystemInfo();
      const width = 14;
      const used = Math.round((sys.usedMem / sys.totalMem) * width);
      const bar = `${'▰'.repeat(used)}${'▱'.repeat(width - used)}`;
      await ctx.reply(
        box(
          'System Information',
          `▸ *Platform:* ${sys.platform}\n` +
            `▸ *Arch:* ${sys.arch}\n` +
            `▸ *CPUs:* ${sys.cpus}\n` +
            `▸ *CPU model:* ${String(sys.cpuModel).slice(0, 42)}\n` +
            `▸ *Memory:* ${bar} ${sys.memPercent}%\n` +
            `▸ *Used/Total:* ${fmtBytes(sys.usedMem)} / ${fmtBytes(sys.totalMem)}\n` +
            `▸ *Process RSS:* ${fmtBytes(sys.processMem)}\n` +
            `▸ *Node uptime:* ${fmtDuration(sys.uptime)}\n` +
            `▸ *Node version:* ${sys.node}`
        )
      );
    },
  },

  {
    name: 'report',
    aliases: ['bug', 'feedback'],
    category: 'general',
    description: 'Send a bug report to the owner',
    usage: '<message>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}report <message>\``);
      const targets = ownerJids(ctx);
      for (const jid of targets) {
        await ctx.sendTo(jid, `🐞 *New report from +${ctx.senderNumber}*\n\n${ctx.argText}\n\n📅 ${fmtDate()}`).catch(() => {});
      }
      await ctx.reply(targets.length ? '✅ Report sent to the owner. Thank you!' : '⚠️ No owner configured — report printed to server logs.');
      if (!targets.length) console.log('REPORT:', ctx.argText, 'from', ctx.senderNumber);
    },
  },

  {
    name: 'id',
    aliases: ['chatid', 'jid'],
    category: 'general',
    description: 'Show the current chat and sender IDs',
    run: async (ctx) =>
      ctx.reply(
        box(
          'Identifiers',
          `▸ *Chat JID:* ${mono(ctx.chatId)}\n` +
            `▸ *Sender JID:* ${mono(ctx.senderJid || 'n/a')}\n` +
            `▸ *Your number:* ${ctx.senderNumber ? `+${ctx.senderNumber}` : 'unknown'}\n` +
            `▸ *Role:* ${ctx.role}\n` +
            `▸ *In group:* ${ctx.isGroup ? 'yes' : 'no'}`
        )
      ),
  },

  {
    name: 'contactme',
    aliases: ['vcard', 'mycontact'],
    category: 'general',
    description: 'Get your own contact card',
    run: async (ctx) => {
      const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${ctx.pushName}\nTEL;type=CELL;type=VOICE;waid=${ctx.senderNumber}:+${ctx.senderNumber}\nEND:VCARD`;
      await ctx.send({ contacts: { displayName: ctx.pushName, contacts: [{ vcard }] } });
    },
  },

  {
    name: 'prefix',
    aliases: ['setprefix'],
    category: 'general',
    description: 'Show or change the command prefix',
    usage: '[set <char>]',
    run: async (ctx) => {
      const sub = (ctx.args[0] || '').toLowerCase();
      if (sub === 'set') {
        if (!ctx.isOwner && !ctx.isSudo) return ctx.reply('🔒 Only owner/sudo can change the prefix.');
        const next = ctx.args[1];
        if (!next) return ctx.reply(`Usage: \`${ctx.prefix}prefix set <char>\``);
        if (next.length > 3) return ctx.reply('❌ Prefix too long (max 3 characters).');
        settingsStore.data.prefix = next;
        settingsStore.persist();
        return ctx.reply(`✅ Prefix changed to *${next}*\nTry \`${next}menu\``);
      }
      await ctx.reply(
        `🔑 *Current prefix:* ${ctx.prefix}\n\nExample: \`${ctx.prefix}ping\`\nChange: \`${ctx.prefix}prefix set <char>\` (owner only).`
      );
    },
  },

  {
    name: 'afk',
    aliases: ['brb'],
    category: 'general',
    description: 'Announce that you are away',
    usage: '[reason]',
    run: async (ctx) => {
      await ctx.reply(`💤 *${ctx.pushName}* is now AFK.\n📝 Reason: ${ctx.argText || 'No reason given'}`);
    },
  },

  {
    name: 'groupinvite',
    aliases: ['grouplink'],
    category: 'general',
    description: 'Get this group invite link (admins)',
    scope: 'group',
    run: async (ctx) => {
      if (!ctx.isAdmin && !ctx.isOwner && !ctx.isSudo) return ctx.reply('🔒 Only group admins can get the invite link.');
      const code = await ctx.sock.groupInviteCode(ctx.chatId);
      await ctx.reply(`🔗 *Group invite link*\n\nhttps://chat.whatsapp.com/${code}\n\n_Share carefully._`);
    },
  },

  {
    name: 'rules',
    aliases: ['rule'],
    category: 'general',
    description: 'Show generic group rules',
    run: async (ctx) =>
      ctx.reply(
        box(
          'Group Rules',
          `1️⃣ Be respectful\n2️⃣ No spam or flooding\n3️⃣ No links without permission\n4️⃣ No NSFW content\n5️⃣ Follow admin instructions\n6️⃣ Have fun!`
        )
      ),
  },

  {
    name: 'version',
    aliases: ['ver'],
    category: 'general',
    description: 'Bot version and changelog',
    run: async (ctx) =>
      ctx.reply(
        box(
          `${getBotName()} v${config.bot.version}`,
          `▸ Built on Baileys 7.x multi-device\n` +
            `▸ Node.js ${process.version}\n` +
            `▸ Dashboard + pairing codes\n` +
            `▸ Modular command loader\n\n` +
            `*Changelog:*\n• Pairing-code dashboard\n• 300 commands\n• Media downloaders\n• Group moderation`
        )
      ),
  },

  {
    name: 'privacy',
    aliases: ['datapolicy'],
    category: 'general',
    description: 'How your data is handled',
    run: async (ctx) =>
      ctx.reply(
        box(
          'Privacy',
          `▸ Credentials stay on the host in the auth/ folder.\n` +
            `▸ Messages are processed in memory and only leave the server when you request a download/translation.\n` +
            `▸ No analytics or tracking.\n\n_Keep the dashboard password and auth folder secret._`
        )
      ),
  },

  {
    name: 'suggest',
    aliases: ['suggestion', 'idea'],
    category: 'general',
    description: 'Suggest a feature to the owner',
    usage: '<idea>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}suggest <your idea>\``);
      const targets = ownerJids(ctx);
      for (const jid of targets) {
        await ctx.sendTo(jid, `💡 *Suggestion from +${ctx.senderNumber}*\n\n${ctx.argText}`).catch(() => {});
      }
      await ctx.reply('✅ Thanks! Your suggestion was forwarded.');
    },
  },

  {
    name: 'source',
    aliases: ['repo'],
    category: 'general',
    description: 'About the source code',
    run: async (ctx) =>
      ctx.reply(
        box('Source', `Self-hosted Node.js project.\n\n▸ Express dashboard\n▸ Baileys socket\n▸ Modular commands/\n\n_Ask the owner for the repository link._`)
      ),
  },

  {
    name: 'plugins',
    aliases: ['modules'],
    category: 'general',
    description: 'List loaded command modules with counts',
    run: async (ctx) => {
      const byCat = commandsByCategory();
      const lines = Object.entries(byCat)
        .map(([cat, list]) => `▸ ${cat.padEnd(12)} ${list.length}`)
        .join('\n');
      await ctx.reply(box('Loaded Modules', `${lines}\n\n▸ *Total:* ${countCommands()}`));
    },
  },

  {
    name: 'restart',
    category: 'general',
    description: 'Soft-restart the WhatsApp socket',
    role: 'owner',
    run: async (ctx) => {
      await ctx.reply('♻️ Restarting the WhatsApp socket…');
      try {
        await ctx.sock.end?.(undefined);
      } catch {
        /* ignore */
      }
      const { startSocket } = await import('../lib/bot.js');
      setTimeout(() => startSocket().catch(() => {}), 2000);
    },
  },
];
