/**
 * IP DILSAHN - text utilities (36)
 * uppercase, lowercase, titlecase, smallcaps, bold, italic, strikethrough,
 * monospace, spoiler, vanish, charcount, wordcount, countletters,
 * countvowels, palindrome, anagram, camelcase, snakecase, kebabcase,
 * base64enc, base64dec, hexenc, hexdec, urlencode, urldecode, md5, sha1,
 * sha256, sha512, rot13, leetspeak, binary, unbinary, fancy, censor,
 * repeat, spacer, zalgo
 */

import crypto from 'crypto';
import { box } from '../lib/msg.js';

const needText = async (ctx, usage) => {
  if (ctx.argText) return ctx.argText;
  await ctx.reply(`✍️ Provide text.\nUsage: \`${ctx.prefix}${usage}\``);
  return '';
};

const hash = (algo, text) => crypto.createHash(algo).update(text).digest('hex');

const SMALL = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ',
  m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'Q', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
};

const FANCY = {
  a: '𝒂', b: '𝒃', c: '𝒄', d: '𝒅', e: '𝒆', f: '𝒇', g: '𝒈', h: '𝒉', i: '𝒊', j: '𝒋', k: '𝒌', l: '𝒍',
  m: '𝒎', n: '𝒏', o: '𝒐', p: '𝒑', q: '𝒒', r: '𝒓', s: '𝒔', t: '𝒕', u: '𝒖', v: '𝒗', w: '𝒘', x: '𝒙', y: '𝒚', z: '𝒛',
};

const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', l: '1', g: '9', b: '8' };

const transliterate = (map, text) =>
  [...text.toLowerCase()].map((c) => map[c] || c).join('');

const single = (name, aliases, description, transform, usage = '<text>') => ({
  name,
  aliases,
  category: 'text',
  description,
  usage,
  run: async (ctx) => {
    const text = await needText(ctx, `${name} ${usage}`);
    if (!text) return;
    const out = await transform(text);
    await ctx.reply(typeof out === 'string' ? out : out);
  },
});

const wrapIfLong = (body) => String(body);

export default [
  single('uppercase', ['upper', 'uc'], 'Convert text to UPPERCASE', (t) => t.toUpperCase()),
  single('lowercase', ['lower', 'lc'], 'Convert text to lowercase', (t) => t.toLowerCase()),
  single('titlecase', ['title'], 'Capitalise Each Word', (t) =>
    t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  ),
  single('smallcaps', ['small'], 'Convert text to small caps', (t) => transliterate(SMALL, t)),
  single('boldtext', ['bold'], 'Wrap text in WhatsApp bold', (t) => `*${t}*`),
  single('italictext', ['italic'], 'Wrap text in WhatsApp italics', (t) => `_${t}_`),
  single('strike', ['strikethrough'], 'Strike through your text', (t) => `~${t}~`),
  single('monotext', ['mono'], 'Wrap text in monospace', (t) => `\`\`\`${t}\`\`\``),
  single('spoiler', ['hide'], 'Hide text behind a spoiler', (t) => `||${t}||`),
  single('vanish', ['disappearing'], 'Send text as view-once style spoiler', (t) => `||${t}||`.replace(/\n/g, ' ') + '\n\n_View once_'),
  {
    name: 'charcount',
    aliases: ['charc', 'strlen'],
    category: 'text',
    description: 'Count characters in text',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'charcount <text>');
      if (!t) return;
      await ctx.reply(`🔢 *Characters:* ${t.length}\n▸ No spaces: ${t.replace(/\s/g, '').length}\n▸ With spaces: ${t.length}`);
    },
  },
  {
    name: 'wordcount',
    aliases: ['words', 'wc'],
    category: 'text',
    description: 'Count words in text',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'wordcount <text>');
      if (!t) return;
      const words = t.trim().split(/\s+/).filter(Boolean);
      const sentences = t.split(/[.!?]+/).filter((s) => s.trim()).length;
      await ctx.reply(`📝 *Words:* ${words.length}\n▸ Sentences: ${sentences}\n▸ Characters: ${t.length}\n▸ Reading time: ~${Math.max(1, Math.ceil(words.length / 200))} min`);
    },
  },
  {
    name: 'countletters',
    aliases: ['lettercount'],
    category: 'text',
    description: 'Break down the letters in your text',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'countletters <text>');
      if (!t) return;
      const counts = {};
      for (const c of t.toLowerCase()) if (/[a-z]/.test(c)) counts[c] = (counts[c] || 0) + 1;
      const lines = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([c, n]) => `▸ ${c}: ${n}`);
      await ctx.reply(box('Letter Count', lines.join('\n')));
    },
  },
  {
    name: 'countvowels',
    aliases: ['vowels'],
    category: 'text',
    description: 'Count vowels and consonants',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'countvowels <text>');
      if (!t) return;
      const vowels = (t.match(/[aeiou]/gi) || []).length;
      const consonants = (t.match(/[bcdfghjklmnpqrstvwxyz]/gi) || []).length;
      await ctx.reply(`🔤 *Vowels:* ${vowels}\n▸ Consonants: ${consonants}`);
    },
  },
  {
    name: 'palindrome',
    aliases: ['pal'],
    category: 'text',
    description: 'Check if text is a palindrome',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'palindrome <text>');
      if (!t) return;
      const clean = t.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isPal = clean && clean === [...clean].reverse().join('');
      await ctx.reply(`${isPal ? '✅' : '❌'} *${isPal ? 'Yes' : 'No'}* — "${t}" ${isPal ? 'is' : 'is not'} a palindrome.`);
    },
  },
  {
    name: 'anagram',
    aliases: ['scramble'],
    category: 'text',
    description: 'Scramble the letters of a word',
    usage: '<word>',
    run: async (ctx) => {
      const t = await needText(ctx, 'anagram <word>');
      if (!t) return;
      const letters = [...t];
      let out = t;
      let guard = 0;
      while (out === t && guard < 20) {
        for (let i = letters.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        out = letters.join('');
        guard += 1;
      }
      await ctx.reply(`🔀 ${out}`);
    },
  },
  single('camelcase', ['camel'], 'convert to camelCase', (t) =>
    t.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, c) => c.toUpperCase())
  ),
  single('snakecase', ['snake'], 'convert_to_snake_case', (t) =>
    t.trim().replace(/\s+/g, '_').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
  ),
  single('kebabcase', ['kebab'], 'convert-to-kebab-case', (t) =>
    t.trim().replace(/\s+/g, '-').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  ),
  single('base64', ['b64enc', 'encode'], 'Encode text to Base64', (t) => Buffer.from(t).toString('base64')),
  single('base64decode', ['b64dec', 'decode'], 'Decode Base64 text', (t) => {
    try {
      return Buffer.from(t, 'base64').toString('utf8') || '(empty)';
    } catch {
      return '❌ Invalid Base64.';
    }
  }),
  single('hexenc', ['tohex'], 'Convert text to hex', (t) => Buffer.from(t).toString('hex')),
  single('hexdec', ['fromhex'], 'Convert hex back to text', (t) => {
    try {
      return Buffer.from(t.replace(/\s/g, ''), 'hex').toString('utf8') || '(empty)';
    } catch {
      return '❌ Invalid hex.';
    }
  }),
  single('urlencode', ['urlenc'], 'URL-encode text', (t) => encodeURIComponent(t)),
  single('urldecode', ['urldec'], 'Decode a URL-encoded string', (t) => {
    try {
      return decodeURIComponent(t);
    } catch {
      return '❌ Invalid encoding.';
    }
  }),
  single('md5', ['md5hash'], 'MD5 hash of text', (t) => `\`${hash('md5', t)}\``),
  single('sha1', ['sha1hash'], 'SHA-1 hash of text', (t) => `\`${hash('sha1', t)}\``),
  single('sha256', ['sha256hash'], 'SHA-256 hash of text', (t) => `\`${hash('sha256', t)}\``),
  single('sha512', ['sha512hash'], 'SHA-512 hash of text', (t) => `\`${hash('sha512', t)}\``),
  single('rot13', ['caesar'], 'ROT13 cipher', (t) =>
    t.replace(/[a-zA-Z]/g, (c) => String.fromCharCode((c <= 'Z' ? 90 : 122) >= c.charCodeAt(0) + 13 ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13))
  ),
  single('leetspeak', ['leet', '1337'], 'Convert text to l33t sp34k', (t) => transliterate(LEET, t)),
  single('binary', ['tobin'], 'Convert text to binary', (t) =>
    [...t].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
  ),
  single('unbinary', ['frombin'], 'Convert binary back to text', (t) => {
    try {
      return t
        .trim()
        .split(/\s+/)
        .map((b) => String.fromCharCode(parseInt(b, 2)))
        .join('');
    } catch {
      return '❌ Invalid binary.';
    }
  }),
  single('fancy', ['fancytext', 'aesthetic'], 'Fancy unicode text', (t) => transliterate(FANCY, t)),
  {
    name: 'censor',
    aliases: ['mask'],
    category: 'text',
    description: 'Censor a word inside your text',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'censor <text>');
      if (!t) return;
      await ctx.reply(t.replace(/[aeiou]/gi, '*'));
    },
  },
  {
    name: 'repeat',
    aliases: ['spam'],
    category: 'text',
    description: 'Repeat text a few times (max 10)',
    usage: '<count> <text>',
    cooldown: 5,
    run: async (ctx) => {
      const count = Math.min(10, Math.max(1, parseInt(ctx.args[0], 10) || 3));
      const text = ctx.args.slice(1).join(' ');
      if (!text) return ctx.reply(`Usage: \`${ctx.prefix}repeat 3 hello\``);
      await ctx.reply(Array.from({ length: count }, () => text).join('\n'));
    },
  },
  {
    name: 'spacer',
    aliases: ['space'],
    category: 'text',
    description: 'Add spaces between letters',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'spacer <text>');
      if (!t) return;
      await ctx.reply([...t].join(' '));
    },
  },
  {
    name: 'zalgo',
    aliases: ['creepy'],
    category: 'text',
    description: 'Glitchy z̸a̷l̸g̷o̸ text',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'zalgo <text>');
      if (!t) return;
      const marks = ['\u0300', '\u0301', '\u0302', '\u0303', '\u0308', '\u030A', '\u0327', '\u0328', '\u0336'];
      const out = [...t.slice(0, 60)]
        .map((c) => (c === ' ' ? c : c + marks[Math.floor(Math.random() * marks.length)] + (Math.random() > 0.5 ? marks[Math.floor(Math.random() * marks.length)] : '')))
        .join('');
      await ctx.reply(wrapIfLong(out));
    },
  },
  {
    name: 'unzalgo',
    aliases: ['clean'],
    category: 'text',
    description: 'Remove zalgo / combining marks',
    usage: '<text>',
    run: async (ctx) => {
      const t = await needText(ctx, 'unzalgo <text>');
      if (!t) return;
      await ctx.reply(t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    },
  },
];
