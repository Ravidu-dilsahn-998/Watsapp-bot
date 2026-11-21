/**
 * IP DILSAHN - anime & cute pictures (24)
 * neko, waifu, husbando, hug, kiss, pat, slap, cuddle, poke, tickle,
 * bite, blush, dance, smile, wave, wink, highfive, handshake, panda,
 * koala, dog, cat, fox, duck
 */

import axios from 'axios';
import { http, randomUA, truncate } from '../lib/helpers.js';
import { box } from '../lib/msg.js';
import { fetchBuffer } from '../lib/media.js';

const NEKO = (reaction) => `https://nekos.life/api/v2/img/${reaction}`;

const sendImageUrl = async (ctx, url, caption) => {
  const buf = await fetchBuffer(url);
  await ctx.reply({ image: buf, caption });
};

const sendAnimatedOrImage = async (ctx, url, caption, gif = false) => {
  const buf = await fetchBuffer(url);
  const isGif = /\.gif($|\?)/i.test(url) || gif;
  if (isGif) {
    try {
      await ctx.reply({ video: buf, mimetype: 'image/gif', gifPlayback: true, caption }, { quoted: ctx.msg });
      return;
    } catch {
      /* fall back to sticker */
    }
  }
  await ctx.reply({ image: buf, caption }, { quoted: ctx.msg });
};

const reactionCmd = (name, emoji, text) => ({
  name,
  category: 'anime',
  description: `${text} (anime GIF)`,
  usage: '[@user]',
  cooldown: 3,
  run: async (ctx) => {
    const target = ctx.mentions[0] ? `@${ctx.mentions[0].split('@')[0]}` : '';
    const { data } = await http.get(NEKO(name === 'highfive' ? 'highfive' : name));
    const url = data?.url;
    if (!url) throw new Error('No image returned.');
    const caption = `${emoji} *${ctx.pushName}* ${text}${target ? ` ${target}` : ''}`;
    await sendAnimatedOrImage(ctx, url, caption);
  },
});

const animalCmd = (name, alias, endpoint, label) => ({
  name,
  aliases: [alias],
  category: 'anime',
  description: `Random ${label} picture`,
  cooldown: 2,
  run: async (ctx) => {
    const { data } = await http.get(endpoint);
    const url = data.image || data.message || data.url || data[0]?.url || data.link;
    if (!url) throw new Error('No image returned.');
    const caption = [`${label} 🐾`, data.fact ? `\n\n_${truncate(data.fact, 180)}_` : ''].join('');
    await sendImageUrl(ctx, url, caption);
  },
});

/* ---------------- AnimeVerse (interactive web app) ---------------- */
const AV_CHARS = [
  ['Kuro', 'Moonlit Wolf · සඳ එළියේ වෘක ලිය'],
  ['Akane', 'Crimson Koi · රතු කොයි මත්ස්‍ය දේවතාවිය'],
  ['Shizuku', 'Frost Oracle · හිම දේවිය'],
  ['Valkyrie', 'Crimson Blade · යකඩ හඬ'],
  ['Noa', 'Neon Dream · නියොන් සිහිනය'],
  ['Sakura', 'Blossom Dancer · පිපුණු මල් රජිනිය'],
];

const animeVerseCmd = {
  name: 'animeverse',
  aliases: ['av', 'animeapp', 'characters'],
  category: 'anime',
  description: 'AnimeVerse — 6 animated characters, each with its own animation + live sound (offline-capable web app)',
  usage: '[1-6]',
  cooldown: 4,
  run: async (ctx) => {
    const arg = String(ctx.args[0] || '').trim();
    const publicUrl = String(process.env.PUBLIC_URL || process.env.WEB_URL || '').replace(/\/+$/, '');
    const link = publicUrl ? `${publicUrl}/anime` : '';

    if (/^[1-6]$/.test(arg)) {
      const i = Number(arg) - 1;
      const [name, tagline] = AV_CHARS[i];
      return ctx.reply(
        box(
          `AnimeVerse · 0${i + 1}`,
          `*${name}*\n${tagline}\n\n` +
            'Full animation · unique soundscape · live particles\n' +
            (link ? `\n🔗 ${link}` : '\n_Open the bot dashboard and add /anime_'),
          'Each character has its own animation, palette and music'
        )
      );
    }

    return ctx.reply(
      box(
        'AnimeVerse · චරිත 6',
        AV_CHARS.map(([n, t], i) => `*0${i + 1}*  ${n}\n   ${t}`).join('\n') +
          (link ? `\n\n🔗 ${link}\n\n_.animeverse 1_ – 6 to pick one` : '\n\n_Serving at /anime on this bot_'),
        'Live WebAudio music · no audio files · works offline'
      )
    );
  },
};

export default [
  {
    name: 'neko',
    aliases: ['nekopic'],
    category: 'anime',
    description: 'Random neko image',
    cooldown: 2,
    run: async (ctx) => {
      const { data } = await http.get(NEKO('neko'));
      await sendImageUrl(ctx, data.url, '🐱 Neko!');
    },
  },
  {
    name: 'waifu',
    aliases: ['waifupic'],
    category: 'anime',
    description: 'Random waifu image',
    cooldown: 2,
    run: async (ctx) => {
      const { data } = await http.get('https://api.waifu.pics/sfw/waifu').catch(async () => {
        const fallback = await http.get(NEKO('neko'));
        return { data: { url: fallback.data.url } };
      });
      await sendImageUrl(ctx, data.url, '🌸 Waifu');
    },
  },
  {
    name: 'husbando',
    aliases: ['husbandopic'],
    category: 'anime',
    description: 'Random anime boy image',
    cooldown: 2,
    run: async (ctx) => {
      const { data } = await http.get('https://api.waifu.pics/sfw/husbando').catch(async () => {
        const fallback = await http.get(NEKO('neko'));
        return { data: { url: fallback.data.url } };
      });
      await sendImageUrl(ctx, data.url, '💙 Husbando');
    },
  },
  reactionCmd('hug', '🤗', 'hugs'),
  reactionCmd('kiss', '😘', 'kisses'),
  reactionCmd('pat', '👋', 'pats'),
  reactionCmd('slap', '✋', 'slaps'),
  reactionCmd('cuddle', '🥰', 'cuddles'),
  reactionCmd('poke', '👉', 'pokes'),
  reactionCmd('tickle', '🤣', 'tickles'),
  reactionCmd('bite', '😬', 'bites'),
  reactionCmd('blush', '😊', 'blushes at'),
  reactionCmd('dance', '💃', 'dances with'),
  reactionCmd('smile', '😁', 'smiles at'),
  reactionCmd('wave', '👋', 'waves at'),
  reactionCmd('wink', '😉', 'winks at'),
  reactionCmd('highfive', '🙌', 'high-fives'),
  animalCmd('panda', 'pandapic', 'https://some-random-api.com/animal/panda', 'Panda'),
  animalCmd('koala', 'koalapic', 'https://some-random-api.com/animal/koala', 'Koala'),
  animalCmd('dog', 'doggo', 'https://dog.ceo/api/breeds/image/random', 'Dog'),
  animalCmd('cat', 'kitty', 'https://api.thecatapi.com/v1/images/search', 'Cat'),
  animalCmd('fox', 'foxpic', 'https://randomfox.ca/floof/', 'Fox'),
  animalCmd('duck', 'duckpic', 'https://random-d.uk/api/v2/random', 'Duck'),
  animeVerseCmd,
];
