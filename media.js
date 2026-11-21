/**
 * IP DILSAHN - media & sticker commands (26)
 * sticker, toimg, tovideo, toaudio, tovn, tomp3, take, emojimix,
 * blur, grayscale, invert, rotate, flip, sharpen, circle, thumbnail,
 * resize, photofunia, gif, qrmake (image), qrdecode, removebg,
 * blackwhite, sepia, brightness
 */

import fs from 'fs';
import sharp from 'sharp';
import config from '../config.js';
import {
  imageToSticker,
  videoToSticker,
  ffmpeg,
  fetchBuffer,
  toMp3,
  FFMPEG,
  toJpeg,
  makeThumb,
} from '../lib/media.js';
import { cleanFile, fmtBytes, tmpPath, fileSize } from '../lib/helpers.js';
import { box } from '../lib/msg.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const grabMedia = async (ctx) => {
  if (ctx.quoted?.message && ctx.hasQuotedMedia()) {
    return { buffer: await ctx.downloadQuoted('buffer'), fromQuoted: true, type: quotedType(ctx) };
  }
  if (ctx.hasMedia()) {
    return { buffer: await ctx.downloadMedia('buffer'), fromQuoted: false, type: ctx.mediaType };
  }
  const url = /^https?:\/\//i.test(ctx.argText.trim()) ? ctx.argText.trim() : '';
  if (url) {
    return { buffer: await fetchBuffer(url), fromQuoted: false, type: 'url' };
  }
  return null;
};

const quotedType = (ctx) => {
  const m = ctx.quoted?.message || {};
  const key = Object.keys(m).find((k) => /Message$/.test(k));
  return key ? key.replace('Message', '') : 'unknown';
};

const needMedia = (ctx, usage = 'Reply to an image/video/sticker, or send one with the command.') =>
  ctx.reply(`🖼️ *Media required*\n\n${usage}`);

/* ------------------------------ stickers -------------------------- */

const stickerCmd = {
  name: 'sticker',
  aliases: ['s', 'stiker', 'stickerize'],
  category: 'media',
  description: 'Convert an image or short video to a WhatsApp sticker',
  usage: '(reply to image/video/gif)',
  cooldown: 4,
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);

    const type = media.type;
    let sticker;
    if (type === 'video' || type === 'gif') {
      const videoFile = tmpPath('mp4');
      fs.writeFileSync(videoFile, media.buffer);
      try {
        sticker = await videoToSticker(videoFile);
      } finally {
        cleanFile(videoFile);
      }
    } else {
      // try image -> webp; if the input was already webp just pass through
      try {
        sticker = media.buffer.slice(0, 4).toString() === 'RIFF' ? media.buffer : await imageToSticker(media.buffer);
      } catch {
        sticker = await imageToSticker(await toJpeg(media.buffer));
      }
    }
    if (!sticker?.length) throw new Error('Sticker conversion failed.');
    await ctx.reply({ sticker }, { quoted: ctx.msg });
  },
};

const takeSticker = {
  name: 'take',
  aliases: ['steal', 'wm'],
  category: 'media',
  description: 'Re-send a replied sticker with a custom pack name',
  usage: '[pack name]',
  run: async (ctx) => {
    if (!ctx.quoted?.message) return ctx.reply('Reply to a sticker with `.take <pack name>`.');
    const buffer = await ctx.downloadQuoted('buffer');
    const packname = (ctx.argText || `${ctx.botName} Stickers`).slice(0, 30);
    await ctx.reply({ sticker: buffer, packname, author: ctx.botName }, { quoted: ctx.msg });
  },
};

/* --------------------------- conversions -------------------------- */

const toimg = {
  name: 'toimg',
  aliases: ['toimage', 'stickertoimg'],
  category: 'media',
  description: 'Convert a sticker to a PNG image',
  usage: '(reply to a sticker)',
  run: async (ctx) => {
    if (!ctx.quoted?.message && !ctx.hasMedia()) return ctx.reply('Reply to a sticker with `.toimg`.');
    const buffer = ctx.quoted ? await ctx.downloadQuoted('buffer') : await ctx.downloadMedia('buffer');
    let png;
    try {
      png = await sharp(buffer).png().toBuffer();
    } catch {
      // animated webp: grab first frame via ffmpeg
      const inFile = tmpPath('webp');
      const outFile = tmpPath('png');
      fs.writeFileSync(inFile, buffer);
      try {
        await ffmpeg(['-i', inFile, '-vframes', '1', outFile]);
        png = fs.readFileSync(outFile);
      } finally {
        cleanFile(inFile);
        cleanFile(outFile);
      }
    }
    await ctx.reply({ image: png, caption: '✅ Sticker converted to PNG.' }, { quoted: ctx.msg });
  },
};

const tovideo = {
  name: 'tovideo',
  aliases: ['tovid'],
  category: 'media',
  description: 'Convert an animated sticker to MP4',
  usage: '(reply to animated sticker)',
  run: async (ctx) => {
    if (!ctx.quoted?.message) return ctx.reply('Reply to an animated sticker with `.tovideo`.');
    const buffer = await ctx.downloadQuoted('buffer');
    const inFile = tmpPath('webp');
    const outFile = tmpPath('mp4');
    fs.writeFileSync(inFile, buffer);
    try {
      await ffmpeg(['-i', inFile, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', outFile]);
      if (!fileSize(outFile)) throw new Error('This sticker is static (not animated) — use `.toimg` instead.');
      await ctx.reply({ video: { url: outFile }, mimetype: 'video/mp4', caption: '✅ Sticker → MP4' }, { quoted: ctx.msg });
    } finally {
      cleanFile(inFile);
      cleanFile(outFile);
    }
  },
};

const tomp3 = {
  name: 'tomp3',
  aliases: ['tomp3audio'],
  category: 'media',
  description: 'Convert a replied video/audio to MP3',
  usage: '(reply to video or audio)',
  run: async (ctx) => {
    if (!ctx.quoted?.message && !ctx.hasMedia()) return ctx.reply('Reply to a video/audio with `.tomp3`.');
    const buffer = ctx.quoted ? await ctx.downloadQuoted('buffer') : await ctx.downloadMedia('buffer');
    const inFile = tmpPath('bin');
    fs.writeFileSync(inFile, buffer);
    let out = '';
    try {
      out = await toMp3(inFile);
      await ctx.reply(
        { audio: { url: out }, mimetype: 'audio/mpeg', fileName: `audio-${Date.now()}.mp3` },
        { quoted: ctx.msg }
      );
    } finally {
      cleanFile(inFile);
      cleanFile(out);
    }
  },
};

const tovn = {
  name: 'tovn',
  aliases: ['vn', 'tovoicenote'],
  category: 'media',
  description: 'Convert audio to a voice note',
  usage: '(reply to audio)',
  run: async (ctx) => {
    if (!ctx.quoted?.message && !ctx.hasMedia()) return ctx.reply('Reply to an audio file with `.tovn`.');
    const buffer = ctx.quoted ? await ctx.downloadQuoted('buffer') : await ctx.downloadMedia('buffer');
    const inFile = tmpPath('bin');
    const outFile = tmpPath('ogg');
    fs.writeFileSync(inFile, buffer);
    try {
      await ffmpeg(['-i', inFile, '-c:a', 'libopus', '-b:a', '64k', '-ar', '48000', '-ac', '1', outFile]);
      await ctx.reply({ audio: { url: outFile }, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: ctx.msg });
    } finally {
      cleanFile(inFile);
      cleanFile(outFile);
    }
  },
};

const toaudio = {
  name: 'toaudio',
  aliases: ['extractaudio'],
  category: 'media',
  description: 'Extract audio from a replied video (audio track)',
  usage: '(reply to video)',
  run: async (ctx) => {
    if (!ctx.quoted?.message) return ctx.reply('Reply to a video with `.toaudio`.');
    const buffer = await ctx.downloadQuoted('buffer');
    const inFile = tmpPath('mp4');
    const outFile = tmpPath('m4a');
    fs.writeFileSync(inFile, buffer);
    try {
      await ffmpeg(['-i', inFile, '-vn', '-c:a', 'aac', '-b:a', '96k', outFile]);
      await ctx.reply({ audio: { url: outFile }, mimetype: 'audio/mp4' }, { quoted: ctx.msg });
    } finally {
      cleanFile(inFile);
      cleanFile(outFile);
    }
  },
};

/* ------------------------- image filters -------------------------- */

const filterCmd = (name, aliases, description, transform) => ({
  name,
  aliases,
  category: 'media',
  description,
  usage: '(reply to image)',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const out = await transform(media.buffer);
    await ctx.reply({ image: out, caption: `✅ ${description}` }, { quoted: ctx.msg });
  },
});

const blurImage = filterCmd('blur', ['blurimg'], 'Blur an image', (b) => sharp(b).blur(14).jpeg().toBuffer());
const grayImage = filterCmd('grayscale', ['gray', 'grey'], 'Convert an image to grayscale', (b) => sharp(b).grayscale().jpeg().toBuffer());
const invertImage = filterCmd('invert', ['negative'], 'Invert image colours', (b) => sharp(b).negate({ alpha: false }).jpeg().toBuffer());
const rotateImage = filterCmd('rotate', ['rotateimg'], 'Rotate an image 90°', (b) => sharp(b).rotate(90).jpeg().toBuffer());
const flipImage = filterCmd('flip', ['mirror'], 'Mirror an image horizontally', (b) => sharp(b).flop().jpeg().toBuffer());
const sharpenImage = filterCmd('sharpen', ['sharp'], 'Sharpen an image', (b) => sharp(b).sharpen().jpeg().toBuffer());
const sepiaImage = filterCmd('sepia', ['sepiaimg'], 'Apply a sepia tone', (b) => sharp(b).tint({ r: 112, g: 66, b: 20 }).jpeg().toBuffer());
const brightImage = filterCmd('brightness', ['bright'], 'Increase image brightness', (b) => sharp(b).modulate({ brightness: 1.4 }).jpeg().toBuffer());

const circleImage = {
  name: 'circle',
  aliases: ['roundpic', 'toppng'],
  category: 'media',
  description: 'Crop an image into a circle (PNG)',
  usage: '(reply to image)',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const meta = await sharp(media.buffer).metadata();
    const size = Math.min(meta.width || 512, meta.height || 512);
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    );
    const out = await sharp(media.buffer)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    await ctx.reply({ image: out, caption: '✅ Circle image created.' }, { quoted: ctx.msg });
  },
};

const thumbnail = {
  name: 'thumbnail',
  aliases: ['thumb'],
  category: 'media',
  description: 'Create a small thumbnail from an image',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const out = await sharp(media.buffer).resize(160, 160, { fit: 'cover' }).jpeg({ quality: 70 }).toBuffer();
    await ctx.reply({ image: out, caption: `✅ Thumbnail (${fmtBytes(out.length)})` }, { quoted: ctx.msg });
  },
};

const resizeImage = {
  name: 'resize',
  aliases: ['resizeimg'],
  category: 'media',
  description: 'Resize an image to a width in pixels',
  usage: '[width] (reply to image)',
  run: async (ctx) => {
    const width = Math.min(2000, Math.max(64, parseInt(ctx.args[0], 10) || 512));
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const out = await sharp(media.buffer).resize({ width }).jpeg({ quality: 88 }).toBuffer();
    await ctx.reply({ image: out, caption: `✅ Resized to ${width}px wide — ${fmtBytes(out.length)}` }, { quoted: ctx.msg });
  },
};

/* ---------------------------- utilities --------------------------- */

const removebg = {
  name: 'removebg',
  aliases: ['nobg', 'rmbg'],
  category: 'media',
  description: 'Remove simple solid backgrounds (white) from an image',
  usage: '(reply to image)',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const { data, info } = await sharp(media.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // naive but real white-background removal
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 235 && g > 235 && b > 235) data[i + 3] = 0;
    }
    const out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    await ctx.reply(
      { image: out, caption: '✅ Background (white areas) removed.\n_For complex photos use a dedicated AI service._' },
      { quoted: ctx.msg }
    );
  },
};

const emojiMix = {
  name: 'emojimix',
  aliases: ['mixemoji', 'emix'],
  category: 'media',
  description: 'Combine two emojis into one image',
  usage: '<emoji1> <emoji2>',
  example: '.emojimix 😂 😍',
  run: async (ctx) => {
    const emojis = ctx.args.join(' ').match(/\p{Extended_Pictographic}/gu) || [];
    if (emojis.length < 2) return ctx.reply(`Usage: \`${ctx.prefix}emojimix 😂 😍\``);
    const url = `https://emojik.vercel.app/s/${encodeURIComponent(emojis[0])}_${encodeURIComponent(emojis[1])}?size=256`;
    try {
      const buf = await fetchBuffer(url);
      if (buf.length < 100) throw new Error('no mix');
      const sticker = await imageToSticker(buf);
      await ctx.reply({ sticker }, { quoted: ctx.msg });
    } catch {
      // client-side composite fallback using twemoji images
      const code = (emo) => [...emo].map((c) => c.codePointAt(0).toString(16)).join('-');
      const a = await fetchBuffer(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code(emojis[0])}.png`);
      const b = await fetchBuffer(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code(emojis[1])}.png`);
      const out = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([
          { input: await sharp(a).resize(300).toBuffer(), left: 20, top: 120 },
          { input: await sharp(b).resize(300).toBuffer(), left: 200, top: 120 },
        ])
        .png()
        .toBuffer();
      await ctx.reply({ sticker: await imageToSticker(out) }, { quoted: ctx.msg });
    }
  },
};

const qrMakeImage = {
  name: 'qrimage',
  aliases: ['qrpic'],
  category: 'media',
  description: 'Generate a QR code image',
  usage: '<text or link>',
  run: async (ctx) => {
    if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}qrimage <text>\``);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(ctx.argText)}`;
    const buf = await fetchBuffer(url);
    await ctx.reply({ image: buf, caption: `🔳 QR for: ${ctx.argText.slice(0, 80)}` }, { quoted: ctx.msg });
  },
};

const photoFunia = {
  name: 'photofunia',
  aliases: ['fx'],
  category: 'media',
  description: 'Add a frame effect to an image (instantly)',
  usage: '(reply to image)',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const out = await sharp(media.buffer)
      .resize(800, 800, { fit: 'cover' })
      .extend({ top: 30, bottom: 30, left: 30, right: 30, background: { r: 11, g: 23, b: 41, alpha: 1 } })
      .jpeg()
      .toBuffer();
    await ctx.reply({ image: out, caption: '🖼️ Framed image' }, { quoted: ctx.msg });
  },
};

const gifToVideo = {
  name: 'togif',
  aliases: ['gif'],
  category: 'media',
  description: 'Convert a short video to a GIF',
  usage: '(reply to video)',
  run: async (ctx) => {
    if (!ctx.quoted?.message) return ctx.reply('Reply to a video with `.togif`.');
    const buffer = await ctx.downloadQuoted('buffer');
    const inFile = tmpPath('mp4');
    const outFile = tmpPath('gif');
    fs.writeFileSync(inFile, buffer);
    try {
      await ffmpeg(['-ss', '0', '-t', '5', '-i', inFile, '-vf', 'fps=10,scale=320:-1:flags=lanczos', outFile]);
      await ctx.reply({ video: { url: outFile }, mimetype: 'video/mp4', gifPlayback: true, caption: '✅ GIF (5s)' }, { quoted: ctx.msg });
    } finally {
      cleanFile(inFile);
      cleanFile(outFile);
    }
  },
};

const videoInfo = {
  name: 'videoinfo',
  aliases: ['vidinfo'],
  category: 'media',
  description: 'Show metadata of a replied video/audio',
  run: async (ctx) => {
    if (!ctx.quoted?.message) return ctx.reply('Reply to a video or audio with `.videoinfo`.');
    const buffer = await ctx.downloadQuoted('buffer');
    const file = tmpPath('bin');
    fs.writeFileSync(file, buffer);
    try {
      const { stderr } = await execFileAsync(FFMPEG, ['-i', file], { maxBuffer: 4 * 1024 * 1024 }).catch((e) => e);
      const text = String(stderr || '');
      const duration = text.match(/Duration:\s*([\d:.]+)/)?.[1] || 'unknown';
      const video = text.match(/Video:\s*([^\n,]+)(?:,\s*([^\n,]+))?/);
      const audio = text.match(/Audio:\s*([^\n,]+)/);
      await ctx.reply(
        box(
          'Media Info',
          `▸ *Size:* ${fmtBytes(buffer.length)}\n` +
            `▸ *Duration:* ${duration}\n` +
            `▸ *Video:* ${video?.[1] || 'none'}\n` +
            `▸ *Resolution:* ${video?.[2] || 'n/a'}\n` +
            `▸ *Audio:* ${audio?.[1] || 'none'}`
        )
      );
    } finally {
      cleanFile(file);
    }
  },
};

const imageInfo = {
  name: 'imageinfo',
  aliases: ['imginfo'],
  category: 'media',
  description: 'Show an image resolution and format',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const meta = await sharp(media.buffer).metadata();
    await ctx.reply(
      box(
        'Image Info',
        `▸ *Format:* ${meta.format}\n▸ *Width:* ${meta.width}px\n▸ *Height:* ${meta.height}px\n▸ *Channels:* ${meta.channels}\n▸ *Size:* ${fmtBytes(media.buffer.length)}`
      )
    );
  },
};

const stickerInfo = {
  name: 'stickerinfo',
  aliases: ['stkinfo'],
  category: 'media',
  description: 'Details about a replied sticker',
  run: async (ctx) => {
    if (!ctx.quoted?.message) return ctx.reply('Reply to a sticker with `.stickerinfo`.');
    const buffer = await ctx.downloadQuoted('buffer');
    await ctx.reply(
      box(
        'Sticker Info',
        `▸ *Type:* ${buffer.slice(0, 4).toString() === 'RIFF' ? 'WebP' : 'unknown'}\n` +
          `▸ *Size:* ${fmtBytes(buffer.length)}\n` +
          `▸ *Animated:* ${buffer.includes(Buffer.from('ANIM')) ? 'yes' : 'no'}`
      )
    );
  },
};

const avatar = {
  name: 'avatar',
  aliases: ['profilepic', 'getpp'],
  category: 'media',
  description: 'Get a user profile picture',
  usage: '[number]',
  run: async (ctx) => {
    const target = ctx.mentions[0] || ctx.quoted?.senderJid || `${ctx.senderNumber}@s.whatsapp.net`;
    const url = await ctx.sock.profilePictureUrl(target, 'image').catch(() => null);
    if (!url) return ctx.reply('❌ No profile picture found (it may be private).');
    const buf = await fetchBuffer(url);
    await ctx.reply({ image: await makeThumb(buf), caption: '👤 Profile picture' }, { quoted: ctx.msg });
  },
};

const watermark = {
  name: 'watermark',
  aliases: ['wmtext'],
  category: 'media',
  description: 'Add a text watermark to an image',
  usage: '<text> (reply to image)',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const text = (ctx.argText || ctx.botName).slice(0, 40).replace(/[<>&]/g, '');
    const meta = await sharp(media.buffer).metadata();
    const svg = `<svg width="${meta.width}" height="${meta.height}"><text x="${Math.round(meta.width * 0.04)}" y="${Math.round(meta.height * 0.92)}" font-family="sans-serif" font-size="${Math.round(meta.width * 0.045)}" fill="white" opacity="0.75">${text}</text></svg>`;
    const out = await sharp(media.buffer)
      .composite([{ input: Buffer.from(svg) }])
      .jpeg()
      .toBuffer();
    await ctx.reply({ image: out, caption: '✅ Watermark added' }, { quoted: ctx.msg });
  },
};

const cropSquare = {
  name: 'cropsquare',
  aliases: ['squarecrop'],
  category: 'media',
  description: 'Crop an image to a square',
  run: async (ctx) => {
    const media = await grabMedia(ctx);
    if (!media) return needMedia(ctx);
    const size = 512;
    const out = await sharp(media.buffer).resize(size, size, { fit: 'cover' }).jpeg().toBuffer();
    await ctx.reply({ image: out, caption: '✅ Square image' }, { quoted: ctx.msg });
  },
};

export default [
  stickerCmd,
  takeSticker,
  toimg,
  tovideo,
  tomp3,
  tovn,
  toaudio,
  blurImage,
  grayImage,
  invertImage,
  rotateImage,
  flipImage,
  sharpenImage,
  sepiaImage,
  brightImage,
  circleImage,
  thumbnail,
  resizeImage,
  removebg,
  emojiMix,
  qrMakeImage,
  photoFunia,
  gifToVideo,
  videoInfo,
  imageInfo,
  stickerInfo,
  avatar,
  watermark,
  cropSquare,
];
