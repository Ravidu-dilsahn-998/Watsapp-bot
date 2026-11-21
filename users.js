/**
 * IP DILSAHN - users & access commands (24)
 * adduser, addprem, addsudo, deluser, delprem, delsudo, listusers,
 * listprem, listsudo, myinfo, profile, ban, unban, listbans, setname,
 * setowner, setpublic, toggles, mycommands, whois, mentioninfo, promote...
 */

import config from '../config.js';
import {
  addUser,
  removeUser,
  addSudo,
  removeSudo,
  addPremium,
  removePremium,
  ban,
  unban,
  listUsers,
  roleOf,
  normalizeNumber,
  jidToNumber,
  bumpUserCommand,
} from '../lib/users.js';
import { settingsStore, usersStore, statsStore } from '../lib/db.js';
import { getBotName, isPublic, fmtDate, fmtDuration, mono } from '../lib/helpers.js';
import { state } from '../lib/bot.js';
import { box } from '../lib/msg.js';

const numberFrom = (ctx, index = 0) => {
  const mention = ctx.mentions?.[index];
  if (mention) return jidToNumber(mention);
  const raw = ctx.args[index] || '';
  return normalizeNumber(raw);
};

const requireTarget = async (ctx, usage) => {
  const n = numberFrom(ctx);
  if (!n) {
    await ctx.reply(`Usage: \`${ctx.prefix}${usage}\`\nYou can also mention a user or reply to their message.`);
    return '';
  }
  if (n === ctx.senderNumber) {
    await ctx.reply('❌ You cannot target yourself for this action.');
    return '';
  }
  return n;
};

/* Number resolution that also understands replies */
const resolveTargetNumber = async (ctx) => {
  const mentioned = ctx.mentions?.[0];
  if (mentioned) return jidToNumber(mentioned);
  if (ctx.args[0]) {
    const n = normalizeNumber(ctx.args[0]);
    if (n) return n;
  }
  if (ctx.quoted?.sender) return normalizeNumber(ctx.quoted.sender);
  return '';
};

export default [
  {
    name: 'adduser',
    aliases: ['add'],
    category: 'users',
    description: 'Authorise another user',
    usage: '<number>',
    role: 'sudo',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}adduser <number>\`\ne.g. \`${ctx.prefix}adduser 94712345678\``);
      const res = addUser(n, ctx.senderNumber, ctx.argText.slice(n.length).trim());
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`✅ *User added*\n\n▸ Number: +${res.number}\n▸ Added by: +${ctx.senderNumber}\n▸ Role: user\n\n_They can now use all public commands._`);
    },
  },

  {
    name: 'addprem',
    aliases: ['addpremium'],
    category: 'users',
    description: 'Grant premium access (unlimited downloads)',
    usage: '<number>',
    role: 'sudo',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}addprem <number>\``);
      const res = addPremium(n);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`⭐ *Premium granted* to +${res.number}\n\n_Benefits:_\n▸ Higher download limits\n▸ Priority queue\n▸ Premium-only commands`);
    },
  },

  {
    name: 'addsudo',
    aliases: ['addadmin'],
    category: 'users',
    description: 'Grant sudo (trusted admin) access',
    usage: '<number>',
    role: 'owner',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}addsudo <number>\``);
      const res = addSudo(n, ctx.senderNumber);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`🛡️ *Sudo granted* to +${res.number}\n\n_They can add/remove users and moderate groups._`);
    },
  },

  {
    name: 'deluser',
    aliases: ['removeuser'],
    category: 'users',
    description: 'Remove an authorised user',
    usage: '<number>',
    role: 'sudo',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}deluser <number>\``);
      if (roleOf(n) === 'owner') return ctx.reply('❌ You cannot remove the owner.');
      const res = removeUser(n);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`🗑️ *User removed:* +${res.number}`);
    },
  },

  {
    name: 'delprem',
    aliases: ['removepremium'],
    category: 'users',
    description: 'Revoke premium access',
    usage: '<number>',
    role: 'sudo',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}delprem <number>\``);
      const res = removePremium(n);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`⭐ Premium revoked from +${res.number}`);
    },
  },

  {
    name: 'delsudo',
    aliases: ['removesudo'],
    category: 'users',
    description: 'Revoke sudo access',
    usage: '<number>',
    role: 'owner',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}delsudo <number>\``);
      const res = removeSudo(n);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`🛡️ Sudo revoked from +${res.number}`);
    },
  },

  {
    name: 'listusers',
    aliases: ['users'],
    category: 'users',
    description: 'List all authorised users',
    role: 'sudo',
    run: async (ctx) => {
      const { owners, sudo, premium, added, bans } = listUsers();
      const lines = [
        `👑 *Owners (${owners.length})*`,
        ...owners.map((n) => `  ▸ +${n}`),
        '',
        `🛡️ *Sudo (${sudo.length})*`,
        ...sudo.map((n) => `  ▸ +${n}`),
        '',
        `⭐ *Premium (${premium.length})*`,
        ...premium.map((n) => `  ▸ +${n}`),
        '',
        `👥 *Users (${added.length})*`,
        ...added.map((u) => `  ▸ +${u.number}${u.note ? ` — ${u.note}` : ''}`),
        '',
        `🚫 *Bans (${bans.length})*`,
        ...bans.map((n) => `  ▸ +${n}`),
      ];
      await ctx.reply(box('Authorised Users', lines.join('\n')));
    },
  },

  {
    name: 'listprem',
    aliases: ['premiumlist'],
    category: 'users',
    description: 'List premium users',
    role: 'sudo',
    run: async (ctx) => {
      const { premium } = listUsers();
      await ctx.reply(
        box('Premium Users', premium.length ? premium.map((n, i) => `▸ ${i + 1}. +${n}`).join('\n') : '▸ No premium users yet.')
      );
    },
  },

  {
    name: 'listsudo',
    category: 'users',
    description: 'List sudo users',
    role: 'sudo',
    run: async (ctx) => {
      const { sudo } = listUsers();
      await ctx.reply(box('Sudo Users', sudo.length ? sudo.map((n, i) => `▸ ${i + 1}. +${n}`).join('\n') : '▸ No sudo users.'));
    },
  },

  {
    name: 'myinfo',
    aliases: ['me', 'whoami'],
    category: 'users',
    description: 'Show your role and status',
    run: async (ctx) => {
      const role = roleOf(ctx.senderNumber);
      const rec = usersStore.data.users[ctx.senderNumber];
      const stats = statsStore.data.perUser?.[ctx.senderNumber] || 0;
      await ctx.reply(
        box(
          'Your Profile',
          `▸ 👤 *Name:* ${ctx.pushName}\n` +
            `▸ 📱 *Number:* +${ctx.senderNumber}\n` +
            `▸ 🎖️ *Role:* ${role}\n` +
            `▸ ⭐ *Premium:* ${ctx.isPremium || role === 'owner' || role === 'sudo' ? 'yes' : 'no'}\n` +
            `▸ 📨 *Commands used:* ${stats}\n` +
            `▸ 📅 *Joined:* ${rec?.createdAt ? fmtDate(new Date(rec.createdAt)) : 'unknown'}\n` +
            `▸ 🔓 *Bot mode:* ${isPublic() ? 'public' : 'private'}`
        )
      );
    },
  },

  {
    name: 'profile',
    aliases: ['userinfo'],
    category: 'users',
    description: 'Show a user profile by number/mention',
    usage: '[number]',
    role: 'sudo',
    run: async (ctx) => {
      const n = (await resolveTargetNumber(ctx)) || ctx.senderNumber;
      const role = roleOf(n);
      const rec = usersStore.data.users[n];
      let ppUrl = '';
      try {
        ppUrl = (await ctx.sock.profilePictureUrl(`${n}@s.whatsapp.net`, 'image')) || '';
      } catch {
        /* private */
      }
      const text =
        box(
          'User Profile',
          `▸ 📱 *Number:* +${n}\n` +
            `▸ 🎖️ *Role:* ${role}\n` +
            `▸ 📨 *Commands:* ${statsStore.data.perUser?.[n] || 0}\n` +
            `▸ 📅 *Added:* ${rec?.createdAt ? fmtDate(new Date(rec.createdAt)) : 'not in list'}\n` +
            `▸ 🚫 *Banned:* ${(usersStore.data.bans || []).some((b) => normalizeNumber(b.number || b) === n) ? 'yes' : 'no'}`
        );
      if (ppUrl) {
        try {
          const { fetchBuffer } = await import('../lib/media.js');
          const buf = await fetchBuffer(ppUrl);
          return ctx.reply({ image: buf, caption: text });
        } catch {
          /* fall through */
        }
      }
      await ctx.reply(text);
    },
  },

  {
    name: 'ban',
    aliases: ['blacklist'],
    category: 'users',
    description: 'Block a user from using the bot',
    usage: '<number> [reason]',
    role: 'sudo',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}ban <number> [reason]\``);
      if (roleOf(n) === 'owner') return ctx.reply('❌ Cannot ban the owner.');
      const reason = ctx.argText.replace(/@?\d{7,16}/, '').trim() || 'No reason given';
      const res = ban(n, reason);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`🚫 *User banned*\n\n▸ Number: +${res.number}\n▸ Reason: ${reason}`);
    },
  },

  {
    name: 'unban',
    aliases: ['whitelist'],
    category: 'users',
    description: 'Unban a user',
    usage: '<number>',
    role: 'sudo',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}unban <number>\``);
      const res = unban(n);
      if (!res.ok) return ctx.reply(`❌ ${res.error}`);
      await ctx.reply(`✅ *Unbanned:* +${res.number}`);
    },
  },

  {
    name: 'listbans',
    aliases: ['bans'],
    category: 'users',
    description: 'List banned users',
    role: 'sudo',
    run: async (ctx) => {
      const bans = usersStore.data.bans || [];
      const lines = bans.map((b, i) => `▸ ${i + 1}. +${normalizeNumber(b.number || b)}${b.reason ? ` — ${b.reason}` : ''}`);
      await ctx.reply(box('Banned Users', lines.length ? lines.join('\n') : '▸ Nobody is banned. 🎉'));
    },
  },

  {
    name: 'setname',
    aliases: ['botname', 'renamebot'],
    category: 'users',
    description: 'Change the bot display name',
    usage: '<name>',
    role: 'owner',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}setname <new name>\``);
      const name = ctx.argText.slice(0, 40);
      settingsStore.data.botName = name;
      settingsStore.persist();
      await ctx.reply(`✅ Bot name changed to *${name}*`);
    },
  },

  {
    name: 'setowner',
    category: 'users',
    description: 'Set the owner display name',
    usage: '<name>',
    role: 'owner',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}setowner <name>\``);
      settingsStore.data.ownerName = ctx.argText.slice(0, 40);
      settingsStore.persist();
      await ctx.reply(`✅ Owner name set to *${ctx.argText.slice(0, 40)}*`);
    },
  },

  {
    name: 'setpublic',
    category: 'users',
    description: 'Open or close the bot for everyone',
    usage: '<on|off>',
    role: 'owner',
    run: async (ctx) => {
      const v = (ctx.args[0] || '').toLowerCase();
      if (!['on', 'off', 'true', 'false', '1', '0'].includes(v)) {
        return ctx.reply(`Usage: \`${ctx.prefix}setpublic <on|off>\`\nCurrent: *${isPublic() ? 'public' : 'private'}*`);
      }
      const enabled = ['on', 'true', '1'].includes(v);
      settingsStore.data.public = enabled;
      settingsStore.persist();
      await ctx.reply(`🔓 Bot mode: *${enabled ? 'PUBLIC' : 'PRIVATE'}*\n\n${enabled ? 'Anyone can use public commands.' : 'Only authorised users can use the bot.'}`);
    },
  },

  {
    name: 'toggles',
    aliases: ['features', 'flags'],
    category: 'users',
    description: 'Show or toggle bot features',
    usage: '[feature]',
    run: async (ctx) => {
      const features = settingsStore.data.features;
      const keys = Object.keys(features);
      const arg = (ctx.args[0] || '').toLowerCase();
      if (!arg) {
        const lines = keys.map((k) => `▸ ${k.padEnd(16)} ${features[k] ? '🟢 ON' : '🔴 OFF'}`).join('\n');
        return ctx.reply(box('Feature Toggles', `${lines}\n\n💡 \`${ctx.prefix}toggles <feature>\` to switch`));
      }
      if (!ctx.isOwner && !ctx.isSudo) return ctx.reply('🔒 Only owner/sudo can change features.');
      if (!(arg in features)) return ctx.reply(`❌ Unknown feature: \`${arg}\`\nAvailable: ${keys.join(', ')}`);
      features[arg] = !features[arg];
      settingsStore.persist();
      await ctx.reply(`${features[arg] ? '🟢 Enabled' : '🔴 Disabled'} *${arg}*`);
    },
  },

  {
    name: 'mycommands',
    aliases: ['myuse'],
    category: 'users',
    description: 'How many commands you have used',
    run: async (ctx) => {
      const perUser = statsStore.data.perUser || {};
      const entries = Object.entries(perUser).sort((a, b) => b[1] - a[1]);
      const rank = entries.findIndex(([n]) => n === ctx.senderNumber) + 1;
      await ctx.reply(
        box(
          'Your Usage',
          `▸ *Commands used:* ${perUser[ctx.senderNumber] || 0}\n` +
            `▸ *Rank:* ${rank ? `#${rank} of ${entries.length}` : 'unranked'}\n` +
            `▸ *Total bot commands:* ${statsStore.data.totalCommands || 0}`
        )
      );
    },
  },

  {
    name: 'whois',
    aliases: ['lookup'],
    category: 'users',
    description: 'Check if a number is on WhatsApp',
    usage: '<number>',
    role: 'user',
    run: async (ctx) => {
      const n = await resolveTargetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}whois <number>\``);
      const [result] = await ctx.sock.onWhatsApp(`${n}@s.whatsapp.net`);
      if (!result?.exists) {
        return ctx.reply(`❌ +${n} is not registered on WhatsApp.`);
      }
      await ctx.reply(
        box(
          'WhatsApp Lookup',
          `▸ *Number:* +${n}\n` +
            `▸ *JID:* ${mono(result.jid)}\n` +
            `▸ *Registered:* ✅ yes\n` +
            `▸ *Bot role:* ${roleOf(n)}`
        )
      );
    },
  },

  {
    name: 'mentioninfo',
    aliases: ['taginfo'],
    category: 'users',
    description: 'Details about mentioned users',
    usage: '@user',
    run: async (ctx) => {
      if (!ctx.mentions.length) return ctx.reply('Mention someone first, e.g. `.mentioninfo @user`.');
      const lines = ctx.mentions.map((jid) => {
        const n = jidToNumber(jid);
        return `▸ +${n} — role: ${roleOf(n)}`;
      });
      await ctx.reply(box('Mentioned Users', lines.join('\n')));
    },
  },

  {
    name: 'owners',
    category: 'users',
    description: 'List configured owner numbers',
    role: 'user',
    run: async (ctx) => {
      const owners = (settingsStore.data.ownerNumbers || config.owner.numbers || []).map((n) => normalizeNumber(n));
      await ctx.reply(box('Owner Numbers', owners.length ? owners.map((n) => `▸ +${n}`).join('\n') : '▸ Not configured.'));
    },
  },

  {
    name: 'role',
    aliases: ['checkrole'],
    category: 'users',
    description: 'Check the role of a number',
    usage: '<number|@user>',
    run: async (ctx) => {
      const n = (await resolveTargetNumber(ctx)) || ctx.senderNumber;
      await ctx.reply(`🎖️ *+${n}* has role: *${roleOf(n)}*`);
    },
  },
];
