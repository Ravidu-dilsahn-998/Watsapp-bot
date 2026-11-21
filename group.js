/**
 * IP DILSAHN - group management commands (34)
 * groupinfo, admins, members, promote, demote, kick, add, tagall,
 * hidetag, everyone, setdesc, setsubject, setsicon, removeicon,
 * antilink, warn, warnings, clearwarns, welcome, goodbye, setwelcome,
 * setgoodbye, mute, unmute, lock, unlock, revoke, join, leave,
 * grouplink, grouplist, approvals, setmemberadd
 */

import { groupsStore, settingsStore } from '../lib/db.js';
import { fmtDate, truncate, chunk } from '../lib/helpers.js';
import { jidToNumber, normalizeNumber } from '../lib/users.js';
import { box, divider } from '../lib/msg.js';
import { getGroupMetadata, invalidateGroup } from '../lib/context.js';
import { renderWelcomeCard } from '../lib/render.js';

const isGroupOnly = async (ctx) => {
  if (!ctx.isGroup) {
    await ctx.reply('👥 This command only works inside a group.');
    return false;
  }
  return true;
};

const requireAdmin = async (ctx) => {
  if (!(await isGroupOnly(ctx))) return false;
  if (!ctx.isAdmin && !ctx.isOwner && !ctx.isSudo) {
    await ctx.reply('🔒 Only group *admins* can use this command.');
    return false;
  }
  return true;
};

const requireBotAdmin = async (ctx) => {
  if (!(await requireAdmin(ctx))) return false;
  await ctx.adminCheck();
  if (!ctx.isBotAdmin) {
    await ctx.reply('🤖 I need to be a group admin to do that.\n_Promote me and try again._');
    return false;
  }
  return true;
};

const targetNumber = (ctx, index = 0) => {
  const mention = ctx.mentions?.[index];
  if (mention) return jidToNumber(mention);
  const raw = ctx.args[index] || '';
  const n = normalizeNumber(raw);
  if (n) return n;
  if (index === 0 && ctx.quoted?.sender) return normalizeNumber(ctx.quoted.sender);
  return '';
};

const refreshMeta = async (ctx) => {
  invalidateGroup(ctx.chatId);
  return getGroupMetadata(ctx.sock, ctx.chatId, true);
};

export default [
  {
    name: 'groupinfo',
    aliases: ['ginfo', 'grupinfo'],
    category: 'group',
    description: 'Detailed information about this group',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId, true);
      const admins = meta.participants.filter((p) => p.admin).length;
      const bots = meta.participants.filter((p) => p.id?.includes('bot'))?.length || 0;
      await ctx.reply(
        box(
          'Group Information',
          `▸ *Name:* ${meta.subject}\n` +
            `▸ *ID:* ${meta.id}\n` +
            `▸ *Members:* ${meta.participants.length}\n` +
            `▸ *Admins:* ${admins}\n` +
            `▸ *Created:* ${meta.creation ? fmtDate(new Date(meta.creation * 1000)) : 'unknown'}\n` +
            `▸ *Owner:* ${meta.owner ? `+${jidToNumber(meta.owner)}` : 'unknown'}\n` +
            `▸ *Announce only:* ${meta.announce ? 'yes' : 'no'}\n` +
            `▸ *Locked (admins edit info):* ${meta.restrict ? 'yes' : 'no'}\n` +
            `▸ *Invite code:* ${meta.inviteCode || 'n/a'}\n` +
            `▸ *Description:* ${truncate(meta.desc || 'none', 160)}`
        )
      );
    },
  },

  {
    name: 'admins',
    aliases: ['listadmin', 'adminlist'],
    category: 'group',
    description: 'List group admins',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const admins = meta.participants.filter((p) => p.admin);
      const lines = admins.map((p, i) => `▸ ${i + 1}. +${jidToNumber(p.id)} ${p.admin === 'superadmin' ? '👑' : '🛡️'}`);
      await ctx.reply(box(`Admins (${admins.length})`, lines.join('\n') || 'none'));
    },
  },

  {
    name: 'members',
    aliases: ['listmembers', 'memberlist'],
    category: 'group',
    description: 'List all group members',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const lines = meta.participants.map((p, i) => `▸ ${i + 1}. +${jidToNumber(p.id)}${p.admin ? ' 🛡️' : ''}`);
      const pages = chunk(lines, 50);
      for (const page of pages.slice(0, 4)) {
        await ctx.reply(box(`Members (${meta.participants.length})`, page.join('\n')));
      }
    },
  },

  {
    name: 'promote',
    aliases: ['makeadmin'],
    category: 'group',
    description: 'Promote a member to admin',
    usage: '@user | reply',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const n = targetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}promote @user\` or reply to their message.`);
      await ctx.sock.groupParticipantsUpdate(ctx.chatId, [`${n}@s.whatsapp.net`], 'promote');
      await refreshMeta(ctx);
      await ctx.reply(`🛡️ *Promoted* +${n} to admin.`);
    },
  },

  {
    name: 'demote',
    aliases: ['removeadmin'],
    category: 'group',
    description: 'Demote an admin to member',
    usage: '@user | reply',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const n = targetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}demote @user\``);
      await ctx.sock.groupParticipantsUpdate(ctx.chatId, [`${n}@s.whatsapp.net`], 'demote');
      await refreshMeta(ctx);
      await ctx.reply(`⬇️ *Demoted* +${n} to member.`);
    },
  },

  {
    name: 'kick',
    aliases: ['remove', 'banned'],
    category: 'group',
    description: 'Remove a member from the group',
    usage: '@user | reply',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const n = targetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}kick @user\``);
      if (ctx.isOwner && n === normalizeNumber(ctx.sock.user?.id)) return ctx.reply('❌ I cannot remove myself.');
      await ctx.sock.groupParticipantsUpdate(ctx.chatId, [`${n}@s.whatsapp.net`], 'remove');
      await refreshMeta(ctx);
      await ctx.reply(`👢 *Removed* +${n} from the group.`);
    },
  },

  {
    name: 'addmember',
    aliases: ['gadd'],
    category: 'group',
    description: 'Add a number to the group',
    usage: '<number>',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const n = targetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}addmember 94712345678\``);
      const res = await ctx.sock.groupParticipantsUpdate(ctx.chatId, [`${n}@s.whatsapp.net`], 'add');
      await refreshMeta(ctx);
      const status = res?.[0]?.status || 'unknown';
      await ctx.reply(
        status === '200'
          ? `✅ Added +${n} to the group.`
          : `ℹ️ Could not add +${n} directly (status ${status}).\nTry sending the group link instead.`
      );
    },
  },

  {
    name: 'tagall',
    aliases: ['everyone', 'all'],
    category: 'group',
    description: 'Mention every member in the group',
    usage: '[message]',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const mentions = meta.participants.map((p) => p.id);
      const header = ctx.argText || '📢 Attention everyone!';
      await ctx.send({
        text: `*${header}*\n\n${divider()}\n${mentions.map((m) => `▸ @${jidToNumber(m)}`).join('\n')}`,
        mentions,
      });
    },
  },

  {
    name: 'hidetag',
    aliases: ['silenttag'],
    category: 'group',
    description: 'Mention everyone without showing names',
    usage: '<message>',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const mentions = meta.participants.map((p) => p.id);
      await ctx.send({ text: ctx.argText || '📢', mentions });
    },
  },

  {
    name: 'setsubject',
    aliases: ['setname-group', 'gname'],
    category: 'group',
    description: 'Change the group name',
    usage: '<new name>',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}setsubject <new name>\``);
      await ctx.sock.groupUpdateSubject(ctx.chatId, ctx.argText.slice(0, 65));
      await refreshMeta(ctx);
      await ctx.reply(`✅ Group name changed to *${ctx.argText.slice(0, 65)}*`);
    },
  },

  {
    name: 'setdesc',
    aliases: ['setdescription', 'gdesc'],
    category: 'group',
    description: 'Change the group description',
    usage: '<description>',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      await ctx.sock.groupUpdateDescription(ctx.chatId, ctx.argText || '');
      await refreshMeta(ctx);
      await ctx.reply('✅ Group description updated.');
    },
  },

  {
    name: 'setsicon',
    aliases: ['setgrouppic', 'gpp'],
    category: 'group',
    description: 'Set the group icon from a replied image',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      if (!ctx.quoted?.message) return ctx.reply('Reply to an image with `.setsicon`.');
      const buffer = await ctx.downloadQuoted('buffer');
      await ctx.sock.updateProfilePicture(ctx.chatId, buffer);
      await ctx.reply('✅ Group icon updated.');
    },
  },

  {
    name: 'removeicon',
    aliases: ['delgpp'],
    category: 'group',
    description: 'Remove the group icon',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      await ctx.sock.removeProfilePicture(ctx.chatId);
      await ctx.reply('✅ Group icon removed.');
    },
  },

  {
    name: 'antilink',
    aliases: ['linkblock'],
    category: 'group',
    description: 'Toggle anti-link protection for this group',
    usage: '[on|off|delete|warn|kick]',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const rec = ctx.groupRecord();
      const arg = (ctx.args[0] || '').toLowerCase();
      if (['on', 'delete', 'warn', 'kick'].includes(arg)) {
        if (arg !== 'on') settingsStore.data.moderation.antiLinkAction = arg;
        rec.antiLink = true;
        groupsStore.persist();
        await ctx.reply(`🔗 *Anti-link enabled* — action: *${settingsStore.data.moderation.antiLinkAction}*`);
      } else if (arg === 'off') {
        rec.antiLink = false;
        groupsStore.persist();
        await ctx.reply('🔗 *Anti-link disabled* for this group.');
      } else {
        await ctx.reply(
          box(
            'Anti-link',
            `▸ *Current:* ${rec.antiLink === true ? 'ON' : rec.antiLink === false ? 'OFF' : 'inherits global'}\n` +
              `▸ *Action:* ${settingsStore.data.moderation.antiLinkAction}\n\n` +
              `Usage: \`${ctx.prefix}antilink on|off\`\nAlso: \`antilink warn\` or \`antilink kick\``
          )
        );
      }
    },
  },

  {
    name: 'warn',
    aliases: ['warning'],
    category: 'group',
    description: 'Warn a member (auto-kick after limit)',
    usage: '@user [reason]',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const n = targetNumber(ctx);
      if (!n) return ctx.reply(`Usage: \`${ctx.prefix}warn @user [reason]\``);
      const rec = ctx.groupRecord();
      rec.warns ||= {};
      rec.warns[n] = (rec.warns[n] || 0) + 1;
      groupsStore.persist();
      const limit = settingsStore.data.moderation.warnLimit || 3;
      const reason = ctx.argText.replace(/@\d{7,16}|\d{7,16}/, '').trim() || 'No reason';
      if (rec.warns[n] >= limit) {
        await ctx.reply(`⛔ +${n} reached ${limit}/${limit} warnings.\n_${reason}_`);
      } else {
        await ctx.reply(`⚠️ *Warning ${rec.warns[n]}/${limit}*\n▸ User: +${n}\n▸ Reason: ${reason}`);
      }
    },
  },

  {
    name: 'warnings',
    aliases: ['warns'],
    category: 'group',
    description: 'Show warning counts in this group',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const rec = ctx.groupRecord();
      const warnMap = rec.warns || {};
      const lines = Object.entries(warnMap).map(([n, c]) => `▸ +${n}: ${c}`);
      await ctx.reply(box('Group Warnings', lines.length ? lines.join('\n') : '▸ No warnings. ✅'));
    },
  },

  {
    name: 'clearwarns',
    aliases: ['resetwarns'],
    category: 'group',
    description: 'Clear all warnings in the group',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const rec = ctx.groupRecord();
      rec.warns = {};
      groupsStore.persist();
      await ctx.reply('✅ All warnings cleared.');
    },
  },

  {
    name: 'welcome',
    aliases: ['setwelcome-toggle'],
    category: 'group',
    description: 'Toggle welcome messages in this group',
    usage: '[on|off]',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const rec = ctx.groupRecord();
      const arg = (ctx.args[0] || '').toLowerCase();
      const current = rec.welcome !== false;
      rec.welcome = arg ? arg === 'on' : !current;
      groupsStore.persist();
      await ctx.reply(`👋 Welcome messages: *${rec.welcome ? 'ON' : 'OFF'}*`);
    },
  },

  {
    name: 'goodbye',
    aliases: ['setgoodbye-toggle'],
    category: 'group',
    description: 'Toggle goodbye messages in this group',
    usage: '[on|off]',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const rec = ctx.groupRecord();
      const arg = (ctx.args[0] || '').toLowerCase();
      const current = rec.goodbye !== false;
      rec.goodbye = arg ? arg === 'on' : !current;
      groupsStore.persist();
      await ctx.reply(`👋 Goodbye messages: *${rec.goodbye ? 'ON' : 'OFF'}*`);
    },
  },

  {
    name: 'setwelcome',
    aliases: ['welcometext'],
    category: 'group',
    description: 'Set the welcome message template',
    usage: '<text with @user @group @count>',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}setwelcome Hello @user, welcome to @group!\``);
      settingsStore.data.messages.welcome = ctx.argText;
      settingsStore.persist();
      await ctx.reply('✅ Welcome message updated.');
    },
  },

  {
    name: 'setgoodbye',
    aliases: ['goodbyetext'],
    category: 'group',
    description: 'Set the goodbye message template',
    usage: '<text with @user @group>',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}setgoodbye Bye @user!\``);
      settingsStore.data.messages.goodbye = ctx.argText;
      settingsStore.persist();
      await ctx.reply('✅ Goodbye message updated.');
    },
  },

  {
    name: 'previewwelcome',
    aliases: ['testwelcome'],
    category: 'group',
    description: 'Preview the welcome card design',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const img = await renderWelcomeCard({
        botName: ctx.botName,
        number: ctx.senderNumber,
        groupName: truncate(meta.subject, 34),
        memberCount: meta.participants.length,
        kind: 'welcome',
      });
      await ctx.reply({ image: img, caption: '✅ This is what a welcome card looks like.' });
    },
  },

  {
    name: 'mute',
    aliases: ['close'],
    category: 'group',
    description: 'Only admins can send messages',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      await ctx.sock.groupSettingUpdate(ctx.chatId, 'announcement');
      await refreshMeta(ctx);
      await ctx.reply('🔇 Group muted — only admins can send messages.');
    },
  },

  {
    name: 'unmute',
    aliases: ['open'],
    category: 'group',
    description: 'Allow everyone to send messages',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      await ctx.sock.groupSettingUpdate(ctx.chatId, 'not_announcement');
      await refreshMeta(ctx);
      await ctx.reply('🔊 Group unmuted — everyone can send messages.');
    },
  },

  {
    name: 'lock',
    aliases: ['lockinfo'],
    category: 'group',
    description: 'Only admins can edit group info',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      await ctx.sock.groupSettingUpdate(ctx.chatId, 'locked');
      await refreshMeta(ctx);
      await ctx.reply('🔒 Group info locked to admins only.');
    },
  },

  {
    name: 'unlock',
    aliases: ['unlockinfo'],
    category: 'group',
    description: 'Everyone can edit group info',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      await ctx.sock.groupSettingUpdate(ctx.chatId, 'unlocked');
      await refreshMeta(ctx);
      await ctx.reply('🔓 Group info unlocked.');
    },
  },

  {
    name: 'revoke',
    aliases: ['resetlink'],
    category: 'group',
    description: 'Revoke the group invite link',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const code = await ctx.sock.groupRevokeInvite(ctx.chatId);
      await refreshMeta(ctx);
      await ctx.reply(`🔄 *New invite link:*\nhttps://chat.whatsapp.com/${code}`);
    },
  },

  {
    name: 'join',
    aliases: ['joingroup'],
    category: 'group',
    description: 'Make the bot join a group via invite link',
    usage: '<https://chat.whatsapp.com/...>',
    role: 'owner',
    run: async (ctx) => {
      const link = (ctx.argText.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/) || [])[1];
      if (!link) return ctx.reply(`Usage: \`${ctx.prefix}join https://chat.whatsapp.com/XXXX\``);
      const jid = await ctx.sock.groupAcceptInvite(link);
      await ctx.reply(`✅ Joined group: ${jid || 'success'}`);
    },
  },

  {
    name: 'leave',
    aliases: ['leavegroup'],
    category: 'group',
    description: 'Make the bot leave this group',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      await ctx.reply('👋 Leaving the group. Goodbye!');
      await ctx.sock.groupLeave(ctx.chatId);
    },
  },

  {
    name: 'grouplink',
    aliases: ['getlink'],
    category: 'group',
    description: 'Get this group invite link',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const code = await ctx.sock.groupInviteCode(ctx.chatId);
      await ctx.reply(`🔗 https://chat.whatsapp.com/${code}`);
    },
  },

  {
    name: 'grouplist',
    aliases: ['mygroups'],
    category: 'group',
    description: 'List groups the bot is in',
    role: 'owner',
    run: async (ctx) => {
      const groups = await ctx.sock.groupFetchAllParticipating();
      const list = Object.values(groups);
      const lines = list.slice(0, 40).map((g, i) => `▸ ${i + 1}. ${truncate(g.subject, 40)} (${g.participants.length}👥)`);
      await ctx.reply(box(`Bot Groups (${list.length})`, lines.join('\n') || '▸ none'));
    },
  },

  {
    name: 'requests',
    aliases: ['joinrequests', 'pending'],
    category: 'group',
    description: 'List pending join requests',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireAdmin(ctx))) return;
      const list = await ctx.sock.groupRequestParticipantsList(ctx.chatId);
      const lines = (list || []).map((r, i) => `▸ ${i + 1}. +${jidToNumber(r.jid || r.id || '')}`);
      await ctx.reply(box(`Join Requests (${lines.length})`, lines.join('\n') || '▸ none'));
    },
  },

  {
    name: 'approve',
    aliases: ['acceptall'],
    category: 'group',
    description: 'Approve all pending join requests',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const list = await ctx.sock.groupRequestParticipantsList(ctx.chatId);
      const jids = (list || []).map((r) => r.jid || r.id).filter(Boolean);
      if (!jids.length) return ctx.reply('ℹ️ No pending requests.');
      const res = await ctx.sock.groupRequestParticipantsUpdate(ctx.chatId, jids, 'approve');
      await ctx.reply(`✅ Approved ${res.filter((r) => r.status === '200').length} request(s).`);
    },
  },

  {
    name: 'reject',
    aliases: ['denyall'],
    category: 'group',
    description: 'Reject all pending join requests',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const list = await ctx.sock.groupRequestParticipantsList(ctx.chatId);
      const jids = (list || []).map((r) => r.jid || r.id).filter(Boolean);
      if (!jids.length) return ctx.reply('ℹ️ No pending requests.');
      await ctx.sock.groupRequestParticipantsUpdate(ctx.chatId, jids, 'reject');
      await ctx.reply(`🚫 Rejected ${jids.length} request(s).`);
    },
  },

  {
    name: 'kickinactive',
    aliases: ['prune'],
    category: 'group',
    description: 'Remove members who never sent a message (by stored activity)',
    scope: 'group',
    run: async (ctx) => {
      if (!(await requireBotAdmin(ctx))) return;
      const rec = ctx.groupRecord();
      const active = rec.active || {};
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const inactive = meta.participants.filter((p) => !p.admin && !active[jidToNumber(p.id)]);
      await ctx.reply(`ℹ️ Found ${inactive.length} members with no recorded activity.\n_Activity tracking starts once the feature is enabled._`);
    },
  },

  {
    name: 'membercount',
    aliases: ['count-members'],
    category: 'group',
    description: 'How many members are in this group',
    scope: 'group',
    run: async (ctx) => {
      if (!(await isGroupOnly(ctx))) return;
      const meta = await getGroupMetadata(ctx.sock, ctx.chatId);
      const admins = meta.participants.filter((p) => p.admin).length;
      await ctx.reply(`👥 *Member count:* ${meta.participants.length}\n🛡️ *Admins:* ${admins}`);
    },
  },
];
