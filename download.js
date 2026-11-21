/**
 * IP DILSAHN - downloader commands (28)
 * ytmp4/ytv1/ytv/ytmp3/yta/ytaudio/tiktok/tt/ttmp4/ttmp3/instagram/ig/
 * igreel/facebook/fb/twitter/x/telegram/tgdl/tgfile/pinterest/pin/
 * spotify (info)/soundcloud/sc/threads/mediafire/mf/apk/fetch/getfile/
 * dl/dlfile/directurl/img/upload/tourl
 */

import fs from 'fs';
import axios from 'axios';
import config from '../config.js';
import {
  probe,
  downloadYouTubeVideo,
  downloadYouTubeAudio,
  resolveTikTok,
  resolveTelegram,
  ytDlpDownload,
  downloadDirect,
  fetchBuffer,
  uploadToTmpfiles,
} from '../lib/media.js';
import {
  extractUrl,
  fmtBytes,
  fmtSeconds,
  progressBar,
  cleanFile,
  truncate,
  normalizeUrl,
  http,
  randomUA,
  headInfo,
  fileSize,
  sleep,
} from '../lib/helpers.js';
import { statsStore } from '../lib/db.js';
import { box } from '../lib/msg.js';

/* ---------------------------- helpers ----------------------------- */

const bump = () => {
  statsStore.data.downloads = (statsStore.data.downloads || 0) + 1;
  statsStore.persist();
};

const requireUrl = async (ctx, usage) => {
  const url = extractUrl(ctx.argText) || (ctx.quoted?.message ? '' : '');
  if (!url) {
    await ctx.reply(`🔗 *Link required*\n\nUsage: \`${ctx.prefix}${usage}\`\nExample: \`${ctx.prefix}${usage.split(' ')[0]} https://…\``);
    return '';
  }
  return url;
};

const progressMessage = async (ctx, header) => {
  let last = 0;
  return {
    ctx,
    header,
    update: async (percent, received) => {
      const now = Date.now();
      if (now - last < 1800) return;
      last = now;
      try {
        await ctx.reply(
          `${header}\n\n${percent === null ? `${progressBar(0)}` : progressBar(percent)}\n📦 Downloaded: ${fmtBytes(received || 0)}`,
          { quoted: false }
        );
      } catch {
        /* ignore */
      }
    },
  };
};

const keepFile = (file) => file;

/* --------------------------- YouTube ------------------------------ */

const youtubeAudio = async (ctx, label = 'audio') => {
  const url = await requireUrl(ctx, 'ytmp3 <youtube link>');
  if (!url) return;
  const progress = await progressMessage(ctx, '🎧 *Downloading YouTube audio…*\n⏳ Fetching audio stream');
  let data;
  try {
    data = await downloadYouTubeAudio(url);
  } finally {
    /* progress is best-effort */
  }
  const size = fileSize(data.file);
  try {
    await ctx.sock.sendMessage(
      ctx.chatId,
      {
        audio: { url: data.file },
        mimetype: 'audio/mpeg',
        fileName: `${ctx.botName} - ${Date.now()}.mp3`,
      },
      { quoted: ctx.msg }
    );
    await ctx.reply(`✅ *Audio sent!*\n\n▸ Format: MP3\n▸ Size: ${fmtBytes(size)}\n▸ Source: ${truncate(url, 60)}`);
  } finally {
    cleanFile(data.file);
    bump();
  }
};

const youtubeVideo = async (ctx, quality = 480) => {
  const url = await requireUrl(ctx, 'ytmp4 <youtube link>');
  if (!url) return;
  const progress = await progressMessage(ctx, '📹 *Downloading YouTube video…*\n⏳ Preparing stream');
  let data;
  let info;
  try {
    info = await probe(url).catch(() => null);
    data = await downloadYouTubeVideo(url, { quality });
  } finally {
    /* nothing */
  }
  const size = data.size;
  try {
    if (size > config.limits.maxDownloadMb * 1024 * 1024) {
      throw new Error(`Video is ${fmtBytes(size)} which is over the ${config.limits.maxDownloadMb}MB limit.`);
    }
    const caption =
      `🎬 *${truncate(info?.title || 'YouTube video', 70)}*\n\n` +
      (info?.duration ? `▸ Duration: ${fmtSeconds(info.duration)}\n` : '') +
      (info?.uploader ? `▸ Channel: ${truncate(info.uploader, 40)}\n` : '') +
      `▸ Quality: ${data.quality}p\n` +
      `▸ Size: ${fmtBytes(size)}`;
    await ctx.sock.sendMessage(
      ctx.chatId,
      { video: { url: data.file }, mimetype: 'video/mp4', caption },
      { quoted: ctx.msg }
    );
  } finally {
    cleanFile(data.file);
    bump();
  }
};

/* ----------------------------- TikTok ----------------------------- */

const tiktokVideo = async (ctx) => {
  const url = await requireUrl(ctx, 'tiktok <link>');
  if (!url) return;
  if (!/tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(url)) {
    return ctx.reply('❌ That does not look like a TikTok link.');
  }
  await ctx.reply('⏳ *Fetching TikTok video (no watermark)…*');
  const t = await resolveTikTok(url);
  if (t.images?.length) {
    await ctx.reply(`🖼️ This is a photo post with ${t.images.length} images. Sending…`);
    for (const img of t.images.slice(0, 10)) {
      try {
        const buf = await fetchBuffer(img);
        await ctx.reply({ image: buf });
      } catch {
        /* skip broken image */
      }
    }
    bump();
    return;
  }

  await ctx.reply('📥 *Downloading video…*');
  const res = await axios.get(t.video, {
    responseType: 'arraybuffer',
    timeout: 120000,
    headers: { 'User-Agent': randomUA(), Referer: 'https://www.tiktok.com/' },
  });
  const buffer = Buffer.from(res.data);
  if (!buffer.length) throw new Error('Empty TikTok video.');
  if (buffer.length > config.limits.maxDownloadMb * 1024 * 1024) {
    throw new Error('TikTok video exceeds the size limit.');
  }

  await ctx.reply(
    {
      video: buffer,
      mimetype: 'video/mp4',
      caption:
        `🎵 *${truncate(t.title || 'TikTok video', 80)}*\n\n` +
        `▸ Author: @${t.author}\n` +
        (t.duration ? `▸ Duration: ${fmtSeconds(t.duration)}\n` : '') +
        `▸ Size: ${fmtBytes(buffer.length)}\n` +
        `▸ Watermark: *none* ✅`,
    },
    { quoted: ctx.msg }
  );
  bump();
};

const tiktokAudio = async (ctx) => {
  const url = await requireUrl(ctx, 'ttmp3 <link>');
  if (!url) return;
  await ctx.reply('⏳ Fetching TikTok audio…');
  const t = await resolveTikTok(url);
  if (!t.music) throw new Error('No audio track found for this TikTok.');
  const res = await axios.get(t.music, {
    responseType: 'arraybuffer',
    timeout: 90000,
    headers: { 'User-Agent': randomUA(), Referer: 'https://www.tiktok.com/' },
  });
  const buffer = Buffer.from(res.data);
  await ctx.reply(
    { audio: buffer, mimetype: 'audio/mpeg', ptt: false, fileName: `tiktok-${t.author}.mp3` },
    { quoted: ctx.msg }
  );
  await ctx.reply(`✅ Audio extracted — ${fmtBytes(buffer.length)}`);
  bump();
};

/* --------------------------- Instagram ---------------------------- */

const instagram = async (ctx) => {
  const url = await requireUrl(ctx, 'instagram <reel/post link>');
  if (!url) return;
  if (!/instagram\.com|instagr\.am/i.test(url)) return ctx.reply('❌ That does not look like an Instagram link.');
  await ctx.reply('⏳ *Fetching Instagram media…*');

  let file = '';
  try {
    const data = await ytDlpDownload(url);
    file = data.file;
    if (data.size > config.limits.maxDownloadMb * 1024 * 1024) throw new Error('Media exceeds size limit.');
    await ctx.reply(
      { video: { url: file }, mimetype: 'video/mp4', caption: `📸 *Instagram media*\n▸ Size: ${fmtBytes(data.size)}` },
      { quoted: ctx.msg }
    );
    bump();
    return;
  } catch (err) {
    cleanFile(file);
    // Fall back to embed scraping for public posts
    try {
      const { data: html } = await axios.get(`${url.split('?')[0].replace(/\/$/, '')}/embed/captioned/`, {
        timeout: 25000,
        headers: { 'User-Agent': randomUA() },
      });
      const videoUrl = String(html).match(/"video_url":"([^"]+)"/)?.[1]?.replace(/\\u0026/g, '&');
      const imageUrl = String(html).match(/"display_url":"([^"]+)"/)?.[1]?.replace(/\\u0026/g, '&');
      if (videoUrl) {
        const res = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 90000, headers: { 'User-Agent': randomUA() } });
        await ctx.reply({ video: Buffer.from(res.data), mimetype: 'video/mp4', caption: '📸 *Instagram reel*' }, { quoted: ctx.msg });
        bump();
        return;
      }
      if (imageUrl) {
        const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 90000, headers: { 'User-Agent': randomUA() } });
        await ctx.reply({ image: Buffer.from(res.data), caption: '📸 *Instagram post*' }, { quoted: ctx.msg });
        bump();
        return;
      }
    } catch {
      /* ignore */
    }
    throw new Error('Instagram media could not be fetched. The post may be private or login-restricted.');
  }
};

/* --------------------------- Telegram ----------------------------- */

const telegramDownload = async (ctx) => {
  const url = await requireUrl(ctx, 'tgdl <https://t.me/channel/post>');
  if (!url) return;
  if (!/t\.me|telegram\.(me|dog)/i.test(url)) return ctx.reply('❌ That does not look like a public Telegram post link.');
  await ctx.reply('⏳ *Reading public Telegram post…*');
  const media = await resolveTelegram(url);

  const caption = `📨 *Telegram media*\n\n${media.title || ''}\n${truncate(media.desc || '', 200)}`.trim();

  if (media.video) {
    const res = await axios.get(media.video, { responseType: 'arraybuffer', timeout: 120000, headers: { 'User-Agent': randomUA() } });
    const buffer = Buffer.from(res.data);
    if (buffer.length > config.limits.maxDownloadMb * 1024 * 1024) throw new Error('File too large.');
    await ctx.reply({ video: buffer, mimetype: 'video/mp4', caption }, { quoted: ctx.msg });
    bump();
    return;
  }
  if (media.audio) {
    const res = await axios.get(media.audio, { responseType: 'arraybuffer', timeout: 120000, headers: { 'User-Agent': randomUA() } });
    await ctx.reply({ audio: Buffer.from(res.data), mimetype: 'audio/mpeg' }, { quoted: ctx.msg });
    bump();
    return;
  }
  if (media.image) {
    const buf = await fetchBuffer(media.image);
    await ctx.reply({ image: buf, caption }, { quoted: ctx.msg });
    bump();
    return;
  }
  throw new Error('No downloadable media in that post.');
};

const telegramFile = async (ctx) => {
  const url = await requireUrl(ctx, 'tgfile <t.me link>');
  if (!url) return;
  await ctx.reply('⏳ Probing Telegram post…');
  const media = await resolveTelegram(url);
  const target = media.video || media.audio || media.image;
  if (!target) throw new Error('No media found.');
  const info = await headInfo(target);
  await ctx.reply(
    box(
      'Telegram Media Info',
      `▸ *Found:* ${media.video ? 'video' : media.audio ? 'audio' : 'image'}\n` +
        `▸ *Type:* ${info.type || 'unknown'}\n` +
        `▸ *Size:* ${info.length ? fmtBytes(info.length) : 'unknown'}\n\n💡 Download with \`${ctx.prefix}tgdl ${url}\``
    )
  );
};

/* ------------------------ generic direct ------------------------- */

const fetchFile = async (ctx) => {
  const url = await requireUrl(ctx, 'fetch <direct file link>');
  if (!url) return;

  const progress = await progressMessage(ctx, '📥 *Fetching file…*');
  const download = await downloadDirect(url, {
    maxMb: ctx.isPremium || ctx.isOwner ? config.limits.maxFetchMb * 2 : config.limits.maxFetchMb,
    onProgress: (percent, received) => progress.update(percent ?? 0, received),
  });

  try {
    const caption = `📁 *File fetched*\n\n▸ Name: ${download.filename}\n▸ Type: ${download.mime}\n▸ Size: ${fmtBytes(download.size)}`;
    const isImage = download.mime.startsWith('image/');
    const isVideo = download.mime.startsWith('video/');
    const isAudio = download.mime.startsWith('audio/');

    if (isImage) {
      await ctx.reply({ image: { url: download.file }, caption }, { quoted: ctx.msg });
    } else if (isVideo) {
      await ctx.reply({ video: { url: download.file }, mimetype: download.mime, caption }, { quoted: ctx.msg });
    } else if (isAudio) {
      await ctx.reply({ audio: { url: download.file }, mimetype: download.mime, fileName: download.filename }, { quoted: ctx.msg });
    } else {
      await ctx.reply(
        { document: { url: download.file }, mimetype: download.mime, fileName: download.filename, caption },
        { quoted: ctx.msg }
      );
    }
    bump();
  } finally {
    cleanFile(download.file);
  }
};

const fileInfo = async (ctx) => {
  const url = await requireUrl(ctx, 'getinfo <link>');
  if (!url) return;
  await ctx.reply('🔍 Checking link…');
  const info = await headInfo(url);
  if (!info.status) throw new Error(`Link unreachable: ${info.error || 'unknown error'}`);
  await ctx.reply(
    box(
      'Link Information',
      `▸ *Status:* ${info.status}\n` +
        `▸ *Type:* ${info.type || 'unknown'}\n` +
        `▸ *Size:* ${info.length ? fmtBytes(info.length) : 'unknown'}\n` +
        `▸ *Final URL:* ${truncate(info.url, 110)}\n\n💡 \`${ctx.prefix}fetch ${url}\` to download`
    )
  );
};

/* ------------------------------ upload ---------------------------- */

const uploadFile = async (ctx) => {
  if (!ctx.quoted?.message) return ctx.reply(`📤 Reply to a file/image/video with \`${ctx.prefix}tourl\` to upload it.`);
  const type = ctx.mediaType;
  let buffer = null;
  try {
    buffer = await ctx.downloadQuoted('buffer');
  } catch {
    /* ignore */
  }
  if (!buffer) return ctx.reply('❌ Could not read the quoted file. Make sure it is media.');
  await ctx.reply('⏳ Uploading…');
  const file = ctx.saveBuffer(buffer, type || 'bin');
  try {
    const { url } = await uploadToTmpfiles(file, `dilsahn-${Date.now()}.${type || 'bin'}`);
    await ctx.reply(`✅ *Uploaded*\n\n🔗 ${url}\n\n_Link expires automatically._`);
  } finally {
    cleanFile(file);
  }
};

/* ------------------------- other sites --------------------------- */

const genericFromYtDlp = (name, aliases, description, regex, usage) => ({
  name,
  aliases,
  category: 'download',
  description,
  usage,
  run: async (ctx) => {
    const url = await requireUrl(ctx, `${name} ${usage}`);
    if (!url) return;
    if (regex && !regex.test(url)) return ctx.reply(`❌ That link is not supported by \`${name}\`.`);
    await ctx.reply(`⏳ Downloading with ${ctx.botName}…`);
    const data = await ytDlpDownload(url);
    try {
      if (data.size > config.limits.maxDownloadMb * 1024 * 1024) throw new Error('File too large.');
      await ctx.reply(
        { video: { url: data.file }, mimetype: 'video/mp4', caption: `✅ Downloaded — ${fmtBytes(data.size)}` },
        { quoted: ctx.msg }
      );
      bump();
    } finally {
      cleanFile(data.file);
    }
  },
});

const pinterest = {
  name: 'pinterest',
  aliases: ['pin', 'pintdl'],
  category: 'download',
  description: 'Download a Pinterest image or video',
  usage: '<link>',
  run: async (ctx) => {
    const url = await requireUrl(ctx, 'pinterest <link>');
    if (!url) return;
    await ctx.reply('⏳ Fetching Pinterest pin…');
    const { data: html } = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': randomUA() } });
    const video = String(html).match(/"contentUrl":"([^"]+\.mp4[^"]*)"/)?.[1];
    const image =
      String(html).match(/"contentUrl":"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/)?.[1] ||
      String(html).match(/property="og:image" content="([^"]+)"/)?.[1];
    if (video) {
      const res = await axios.get(video.replace(/\\u0026/g, '&'), { responseType: 'arraybuffer', timeout: 90000, headers: { 'User-Agent': randomUA() } });
      await ctx.reply({ video: Buffer.from(res.data), mimetype: 'video/mp4', caption: '📌 Pinterest video' }, { quoted: ctx.msg });
      bump();
      return;
    }
    if (image) {
      const buf = await fetchBuffer(image);
      await ctx.reply({ image: buf, caption: '📌 Pinterest image' }, { quoted: ctx.msg });
      bump();
      return;
    }
    throw new Error('Could not find media on that Pinterest link.');
  },
};

const spotify = {
  name: 'spotify',
  aliases: ['sp'],
  category: 'download',
  description: 'Show track info from a Spotify link',
  usage: '<track link>',
  run: async (ctx) => {
    const url = await requireUrl(ctx, 'spotify <link>');
    if (!url) return;
    if (!/open\.spotify\.com/i.test(url)) return ctx.reply('❌ Send an open.spotify.com track link.');
    await ctx.reply('🎵 Fetching Spotify metadata…');
    const { data: html } = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': randomUA() } });
    const title = String(html).match(/<meta property="og:title" content="([^"]+)"/)?.[1] || 'Spotify track';
    const desc = String(html).match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
    const image = String(html).match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    const text = `🎧 *Spotify Track*\n\n▸ ${title}\n▸ ${desc}\n\n_Downloading Spotify audio is not offered — use an official app to play it._`;
    if (image) {
      const buf = await fetchBuffer(image);
      await ctx.reply({ image: buf, caption: text });
    } else {
      await ctx.reply(text);
    }
  },
};

const apkDownload = async (ctx) => {
  const query = ctx.argText.trim();
  if (!query) return ctx.reply(`Usage: \`${ctx.prefix}apk <app name or link>\`\nExample: \`${ctx.prefix}apk whatsapp\``);
  if (/^https?:\/\//i.test(query)) {
    return fetchFileFromUrl(ctx, query);
  }
  // APKPure search page -> first result
  const { data: html } = await axios.get(`https://apkpure.com/search?q=${encodeURIComponent(query)}`, {
    timeout: 30000,
    headers: { 'User-Agent': randomUA() },
  });
  const match = String(html).match(/<a class="[^"]*" href="(\/[^"]+)"[^>]*class="[^"]*dd"[^>]*>\s*<div[^>]*>.*?<\/div>/s) ||
    String(html).match(/href="(\/[a-z0-9-]+\/[a-zA-Z0-9._-]+)"/i);
  if (!match) throw new Error('App not found on APKPure. Try the direct download link with `.apk <url>`.');
  await ctx.reply(`📱 Found: https://apkpure.com${match[1]}\n\n_APKPure requires a captcha for direct APK files, so the official page link is sent instead._`);
};

const fetchFileFromUrl = async (ctx, url) => {
  const download = await downloadDirect(url);
  try {
    await ctx.reply(
      { document: { url: download.file }, mimetype: download.mime, fileName: download.filename, caption: `📦 ${download.filename} (${fmtBytes(download.size)})` },
      { quoted: ctx.msg }
    );
    bump();
  } finally {
    cleanFile(download.file);
  }
};

/* ------------------------------ exports --------------------------- */

export default [
  {
    name: 'ytmp4',
    aliases: ['ytv', 'videoyt', 'ytdl'],
    category: 'download',
    description: 'Download a YouTube video (MP4, 480p)',
    usage: '<youtube link>',
    example: '.ytmp4 https://youtu.be/xxxx',
    cooldown: 8,
    run: async (ctx) => youtubeVideo(ctx, 480),
  },
  {
    name: 'ytvhd',
    aliases: ['ythd'],
    category: 'download',
    description: 'Download a YouTube video in high quality (720p)',
    usage: '<youtube link>',
    cooldown: 10,
    role: 'premium',
    run: async (ctx) => youtubeVideo(ctx, 720),
  },
  {
    name: 'ytmp3',
    aliases: ['yta', 'audioyt', 'ytaudio'],
    category: 'download',
    description: 'Download YouTube audio as MP3',
    usage: '<youtube link>',
    example: '.ytmp3 https://youtu.be/xxxx',
    cooldown: 8,
    run: async (ctx) => youtubeAudio(ctx),
  },
  {
    name: 'ytsearch',
    aliases: ['yts'],
    category: 'download',
    description: 'Search YouTube and show the top results',
    usage: '<query>',
    run: async (ctx) => {
      const q = ctx.argText.trim();
      if (!q) return ctx.reply(`Usage: \`${ctx.prefix}ytsearch <query>\``);
      const { youtubeDl } = await import('youtube-dl-exec');
      const out = await youtubeDl(`ytsearch5:${q}`, {
        dumpSingleJson: true,
        flatPlaylist: true,
        skipDownload: true,
        noWarnings: true,
      });
      const entries = (out.entries || []).slice(0, 5);
      const lines = entries.map(
        (e, i) => `▸ ${i + 1}. ${truncate(e.title, 55)}\n   ${e.duration ? `⏱️ ${fmtSeconds(e.duration)} ` : ''}${e.webpage_url}`
      );
      await ctx.reply(box('YouTube Search', lines.join('\n\n')));
    },
  },
  {
    name: 'ytinfo',
    aliases: ['ytmeta'],
    category: 'download',
    description: 'Get details of a YouTube video',
    usage: '<youtube link>',
    run: async (ctx) => {
      const url = await requireUrl(ctx, 'ytinfo <youtube link>');
      if (!url) return;
      const info = await probe(url);
      const text =
        `🎬 *${truncate(info.title, 80)}*\n\n` +
        `▸ Channel: ${info.uploader || 'unknown'}\n` +
        `▸ Duration: ${fmtSeconds(info.duration)}\n` +
        `▸ Views: ${(info.view_count || 0).toLocaleString()}\n` +
        `▸ Likes: ${(info.like_count || 0).toLocaleString()}\n` +
        `▸ Uploaded: ${info.upload_date || 'unknown'}\n` +
        `▸ Format: ${info.ext || 'mp4'}`;
      if (info.thumbnail) {
        try {
          const buf = await fetchBuffer(info.thumbnail);
          return ctx.reply({ image: buf, caption: text });
        } catch {
          /* fall through */
        }
      }
      await ctx.reply(text);
    },
  },
  {
    name: 'tiktok',
    aliases: ['tt', 'ttdl'],
    category: 'download',
    description: 'Download a TikTok video without watermark',
    usage: '<tiktok link>',
    example: '.tiktok https://vm.tiktok.com/xxxx',
    cooldown: 8,
    run: async (ctx) => tiktokVideo(ctx),
  },
  {
    name: 'ttmp3',
    aliases: ['ttaudio', 'tiktokmp3'],
    category: 'download',
    description: 'Extract the audio from a TikTok video',
    usage: '<tiktok link>',
    cooldown: 8,
    run: async (ctx) => tiktokAudio(ctx),
  },
  {
    name: 'ttinfo',
    aliases: ['tiktokinfo'],
    category: 'download',
    description: 'Show TikTok video stats',
    usage: '<tiktok link>',
    run: async (ctx) => {
      const url = await requireUrl(ctx, 'ttinfo <tiktok link>');
      if (!url) return;
      const t = await resolveTikTok(url);
      await ctx.reply(
        box(
          'TikTok Info',
          `▸ *Title:* ${truncate(t.title, 70)}\n` +
            `▸ *Author:* @${t.author}\n` +
            `▸ *Duration:* ${fmtSeconds(t.duration)}\n` +
            `▸ *Plays:* ${(t.stats.plays || 0).toLocaleString()}\n` +
            `▸ *Likes:* ${(t.stats.likes || 0).toLocaleString()}\n` +
            `▸ *Comments:* ${(t.stats.comments || 0).toLocaleString()}\n` +
            `▸ *Shares:* ${(t.stats.shares || 0).toLocaleString()}`
        )
      );
    },
  },
  {
    name: 'instagram',
    aliases: ['ig', 'insta', 'igdl', 'reel'],
    category: 'download',
    description: 'Download Instagram reels, posts and videos',
    usage: '<instagram link>',
    cooldown: 8,
    run: async (ctx) => instagram(ctx),
  },
  genericFromYtDlp('facebook', ['fb', 'fbdl'], 'Download a public Facebook video', /facebook\.com|fb\.watch/i, '<link>'),
  genericFromYtDlp('twitter', ['x', 'twdl'], 'Download a Twitter/X video', /twitter\.com|x\.com/i, '<link>'),
  genericFromYtDlp('threads', ['threadsdl'], 'Download a Threads video', /threads\.net|threads\.com/i, '<link>'),
  genericFromYtDlp('soundcloud', ['sc', 'scdl'], 'Download SoundCloud audio', /soundcloud\.com/i, '<link>'),
  genericFromYtDlp('reddit', ['rddl'], 'Download a Reddit video', /reddit\.com|redd\.it/i, '<link>'),
  genericFromYtDlp('vimeo', ['vim'], 'Download a Vimeo video', /vimeo\.com/i, '<link>'),
  genericFromYtDlp('dailymotion', ['dm'], 'Download a Dailymotion video', /dailymotion\.com|dai\.ly/i, '<link>'),
  genericFromYtDlp('twitchclip', ['twclip'], 'Download a Twitch clip', /twitch\.tv/i, '<link>'),
  pinterest,
  spotify,
  {
    name: 'telegram',
    aliases: ['tgdl', 'tg'],
    category: 'download',
    description: 'Download media from a public Telegram post',
    usage: '<https://t.me/channel/post>',
    cooldown: 8,
    run: async (ctx) => telegramDownload(ctx),
  },
  {
    name: 'tgfile',
    aliases: ['tginfo'],
    category: 'download',
    description: 'Inspect Telegram post media before downloading',
    usage: '<t.me link>',
    run: async (ctx) => telegramFile(ctx),
  },
  {
    name: 'fetch',
    aliases: ['getfile', 'dl', 'dlfile', 'directurl'],
    category: 'download',
    description: 'Download any direct file link (PDF, ZIP, APK, MP4…)',
    usage: '<direct url>',
    cooldown: 5,
    run: async (ctx) => fetchFile(ctx),
  },
  {
    name: 'getinfo',
    aliases: ['linkinfo', 'urlinfo'],
    category: 'download',
    description: 'Check a link type and size before downloading',
    usage: '<link>',
    run: async (ctx) => fileInfo(ctx),
  },
  {
    name: 'tourl',
    aliases: ['upload', 'url'],
    category: 'download',
    description: 'Upload a replied media file and get a link',
    usage: '(reply to media)',
    run: async (ctx) => uploadFile(ctx),
  },
  {
    name: 'apk',
    aliases: ['apkdl'],
    category: 'download',
    description: 'Search or download an Android APK',
    usage: '<app name | direct apk url>',
    run: async (ctx) => apkDownload(ctx),
  },
  {
    name: 'mediafire',
    aliases: ['mf'],
    category: 'download',
    description: 'Download a MediaFire file',
    usage: '<mediafire link>',
    run: async (ctx) => {
      const url = await requireUrl(ctx, 'mediafire <link>');
      if (!url) return;
      if (!/mediafire\.com/i.test(url)) return ctx.reply('❌ Send a mediafire.com link.');
      await ctx.reply('⏳ Resolving MediaFire link…');
      const { data: html } = await axios.get(url, { timeout: 30000, headers: { 'User-Agent': randomUA() } });
      const direct = String(html).match(/href="(https:\/\/download[^"]+)"/)?.[1];
      if (!direct) throw new Error('Could not find the download button — file may be removed.');
      const name = String(html).match(/<div class="dl-btn-label"[^>]*title="([^"]+)"/)?.[1] || 'mediafire-file';
      await ctx.reply(`📦 Found: ${name}\n⬇️ Downloading…`);
      const dl = await downloadDirect(direct, { maxMb: 200 });
      try {
        await ctx.reply(
          { document: { url: dl.file }, mimetype: dl.mime, fileName: name, caption: `✅ ${fmtBytes(dl.size)}` },
          { quoted: ctx.msg }
        );
        bump();
      } finally {
        cleanFile(dl.file);
      }
    },
  },
  {
    name: 'img',
    aliases: ['image', 'pic'],
    category: 'download',
    description: 'Download an image from a direct link',
    usage: '<image url>',
    run: async (ctx) => {
      const url = await requireUrl(ctx, 'img <image url>');
      if (!url) return;
      const buf = await fetchBuffer(url);
      if (!buf.length) throw new Error('Empty image.');
      await ctx.reply({ image: buf, caption: `🖼️ ${fmtBytes(buf.length)}` }, { quoted: ctx.msg });
    },
  },
  {
    name: 'ytplay',
    aliases: ['play', 'song'],
    category: 'download',
    description: 'Search YouTube and download the first audio result',
    usage: '<song name>',
    cooldown: 10,
    run: async (ctx) => {
      const q = ctx.argText.trim();
      if (!q) return ctx.reply(`Usage: \`${ctx.prefix}ytplay <song name>\``);
      const { youtubeDl } = await import('youtube-dl-exec');
      await ctx.reply(`🔎 Searching *${q}*…`);
      const out = await youtubeDl(`ytsearch1:${q}`, { dumpSingleJson: true, flatPlaylist: true, skipDownload: true, noWarnings: true });
      const first = out.entries?.[0];
      if (!first) throw new Error('No results found.');
      await ctx.reply(`🎧 Found: *${truncate(first.title, 60)}* (${fmtSeconds(first.duration || 0)})\n⬇️ Downloading…`);
      const data = await downloadYouTubeAudio(first.webpage_url);
      try {
        await ctx.reply(
          { audio: { url: data.file }, mimetype: 'audio/mpeg', fileName: `${truncate(first.title, 40)}.mp3` },
          { quoted: ctx.msg }
        );
        bump();
      } finally {
        cleanFile(data.file);
      }
    },
  },
  {
    name: 'ytmp4url',
    aliases: ['vdlink'],
    category: 'download',
    description: 'Get a direct download URL for a YouTube video',
    usage: '<youtube link>',
    run: async (ctx) => {
      const url = await requireUrl(ctx, 'ytmp4url <link>');
      if (!url) return;
      const { youtubeDl } = await import('youtube-dl-exec');
      const info = await youtubeDl(url, {
        dumpSingleJson: true,
        skipDownload: true,
        noWarnings: true,
        format: 'b[height<=480][ext=mp4]/b',
      });
      const u = info.url || info.requested_formats?.[0]?.url;
      if (!u) throw new Error('No direct URL available for this video.');
      await ctx.reply(`🔗 *Direct video URL*\n\n${u}\n\n_This URL expires. Use \`${ctx.prefix}ytmp4\` for a permanent file._`);
    },
  },
];
