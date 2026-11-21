/**
 * IP DILSAHN - fun & games (36)
 * joke, dadjoke, chucknorris, meme, quote, fact, uselessfact, wouldyou,
 * truth, dare, dare2, ship, rate, gay, stupid, sim, pp, 8ball, dice,
 * coinflip, slot, rps, trivia, quiz, compliment, insult-safe, emojify,
 * reverse, confessions, horoscope, luckynumber, password-gen, magicball,
 * emojistorm, countdown, gamble
 */

import crypto from 'crypto';
import { http, randomItem, randomInt, shuffle, titleCase, sleep, fmtDate } from '../lib/helpers.js';
import { groupsStore } from '../lib/db.js';
import { box } from '../lib/msg.js';
import { fetchBuffer } from '../lib/media.js';

const jokes = [
  'Why do programmers prefer dark mode? Because light attracts bugs. 🐛',
  'I told my computer I needed a break… now it will not stop sending me KitKat ads. 🍫',
  'There are 10 types of people: those who understand binary and those who do not. 🤓',
  'Why did the developer go broke? Because he used up all his cache. 💸',
  'My code does not have bugs, it has random features. ✨',
];

const truths = [
  'What is the most embarrassing thing you have searched on the internet?',
  'Who was your first crush?',
  'What is the biggest lie you ever told?',
  'Have you ever pretended to be sick to skip something?',
  'What is your most useless talent?',
];

const dares = [
  'Send a selfie right now 📸',
  'Type your next message with your eyes closed 🙈',
  'Send the 5th photo in your gallery 🖼️',
  'Voice note yourself singing a chorus 🎤',
  'Change your WhatsApp status to "I love IP DILSAHN" for 1 hour 😅',
];

const fortunes = ['Yes, definitely ✅', 'No, not now ❌', 'Maybe — ask again later 🤔', 'Absolutely! 🌟', 'Very doubtful 💭', 'Most likely 👍', 'Do not count on it 🚫'];

const horoscopes = {
  aries: 'Energy is high today. Start that project you have been postponing. ♈',
  taurus: 'Stability brings rewards. A small financial win is near. ♉',
  gemini: 'Your words open doors. Have that conversation. ♊',
  cancer: 'Family matters need attention. Be gentle with yourself. ♋',
  leo: 'You will be noticed today. Use the spotlight wisely. ♌',
  virgo: 'Details matter — double-check your work. ♍',
  libra: 'Balance is key. Say no to one commitment. ♎',
  scorpio: 'Hidden opportunities appear. Trust your instincts. ♏',
  sagittarius: 'Adventure calls. Try something new today. ♐',
  capricorn: 'Hard work pays off. Your patience is noticed. ♑',
  aquarius: 'Creative ideas flow. Write them down. ♒',
  pisces: 'Your empathy helps someone today. ♓',
};

const compliments = [
  'You have an amazing smile 😊',
  'You are smarter than you think 🧠',
  'Your kindness makes the world better 💙',
  'You have great taste in music 🎵',
  'You light up the group chat ✨',
  'Your energy is unmatched ⚡',
];

const shuffleWord = (word) => {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
};

const rollDice = (sides = 6) => randomInt(1, sides);

const groupsStorePersist = () => {
  try {
    groupsStore.persist();
  } catch {
    /* ignore */
  }
};

/* two extra commands keep the fun module exactly at 36 */
export const extra = [
  {
    name: 'wyr',
    aliases: ['wouldyourather'],
    category: 'fun',
    description: 'Would you rather question',
    run: async (ctx) => {
      const pairs = [
        ['never use social media again', 'never watch another movie'],
        ['be rich but alone', 'be poor with great friends'],
        ['fly', 'be invisible'],
        ['always be 10 minutes late', 'always be 20 minutes early'],
        ['have unlimited data', 'have unlimited battery'],
      ];
      const [a, b] = randomItem(pairs);
      await ctx.reply(`🤔 *Would you rather…*

🅰️ ${a}
🅱️ ${b}

_Vote in your head 😄_`);
    },
  },
  {
    name: 'pick',
    aliases: ['decide'],
    category: 'fun',
    description: 'Pick one option for you',
    usage: 'option1 | option2 | ...',
    run: async (ctx) => {
      const options = ctx.argText.split('|').map((s) => s.trim()).filter(Boolean);
      if (options.length < 2) return ctx.reply(`Usage: \`${ctx.prefix}pick pizza | burger | sushi\``);
      await ctx.reply(`🎯 I choose: *${randomItem(options)}*`);
    },
  },
];

export default [
  {
    name: 'joke',
    aliases: ['jokes', 'funny'],
    category: 'fun',
    description: 'Get a random joke',
    run: async (ctx) => {
      try {
        const data = await http.get('https://v2.jokeapi.dev/joke/Any?type=single&blacklistFlags=nsfw');
        if (data.data?.joke) return ctx.reply(`😂 *Joke*\n\n${data.data.joke}`);
      } catch {
        /* fall through */
      }
      await ctx.reply(`😂 *Joke*\n\n${randomItem(jokes)}`);
    },
  },

  {
    name: 'dadjoke',
    aliases: ['dadjokes'],
    category: 'fun',
    description: 'A classic dad joke',
    run: async (ctx) => {
      try {
        const { data } = await http.get('https://icanhazdadjoke.com/slack');
        const text = data.attachments?.[0]?.text;
        if (text) return ctx.reply(`👨 *Dad joke*\n\n${text}`);
      } catch {
        /* ignore */
      }
      await ctx.reply('👨 *Dad joke*\n\nI am reading a book about anti-gravity — impossible to put down.');
    },
  },

  {
    name: 'chuck',
    aliases: ['chucknorris'],
    category: 'fun',
    description: 'Random Chuck Norris fact',
    run: async (ctx) => {
      const { data } = await http.get('https://api.chucknorris.io/jokes/random');
      await ctx.reply(`🥋 *Chuck Norris fact*\n\n${data.value}`);
    },
  },

  {
    name: 'meme',
    aliases: ['memes'],
    category: 'fun',
    description: 'Send a random meme from Reddit',
    run: async (ctx) => {
      const { data } = await http.get('https://meme-api.com/gimme');
      const img = await fetchBuffer(data.url);
      await ctx.reply({ image: img, caption: `😂 *${data.title}*\n▸ r/${data.subreddit} • 👍 ${data.ups}` });
    },
  },

  {
    name: 'quote',
    aliases: ['q'],
    category: 'fun',
    description: 'Random inspirational quote',
    run: async (ctx) => {
      try {
        const { data } = await http.get('https://zenquotes.io/api/random');
        if (data?.[0]?.q) return ctx.reply(`💬 *"${data[0].q}"*\n\n— ${data[0].a}`);
      } catch {
        /* ignore */
      }
      await ctx.reply('💬 *"The best way to predict the future is to invent it."*\n\n— Alan Kay');
    },
  },

  {
    name: 'fact',
    aliases: ['facts', 'randomfact'],
    category: 'fun',
    description: 'Random interesting fact',
    run: async (ctx) => {
      const { data } = await http.get('https://uselessfacts.jsph.pl/api/v2/facts/random');
      await ctx.reply(`🧠 *Did you know?*\n\n${data.text}`);
    },
  },

  {
    name: 'catfact',
    aliases: ['catfacts', 'meow'],
    category: 'fun',
    description: 'Random cat fact',
    run: async (ctx) => {
      const { data } = await http.get('https://catfact.ninja/fact');
      await ctx.reply(`🐱 *Cat fact*\n\n${data.fact}`);
    },
  },

  {
    name: 'advice',
    aliases: ['adv'],
    category: 'fun',
    description: 'Random advice',
    run: async (ctx) => {
      const { data } = await http.get('https://api.adviceslip.com/advice');
      await ctx.reply(`💡 *Advice*\n\n${data.slip.advice}`);
    },
  },

  {
    name: 'truth',
    aliases: ['truthq'],
    category: 'fun',
    description: 'A truth question for the group',
    run: async (ctx) => ctx.reply(`🤫 *Truth*\n\n${randomItem(truths)}`),
  },

  {
    name: 'dare',
    aliases: ['dareq'],
    category: 'fun',
    description: 'A dare for the group',
    run: async (ctx) => ctx.reply(`🔥 *Dare*\n\n${randomItem(dares)}`),
  },

  {
    name: 'ship',
    aliases: ['love', 'match'],
    category: 'fun',
    description: 'Calculate a love match percentage',
    usage: '@user1 @user2',
    run: async (ctx) => {
      const targets = ctx.mentions.length ? ctx.mentions.map((m) => m.split('@')[0]) : ctx.args;
      if (targets.length < 2) {
        return ctx.reply(`💕 Tag two people: \`${ctx.prefix}ship @user1 @user2\``);
      }
      const seed = targets.join('-').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const percent = seed % 101;
      const verdict = percent > 85 ? 'Soulmates 💍' : percent > 65 ? 'Great match 💖' : percent > 40 ? 'Give it a try 😊' : 'Just friends 🤝';
      await ctx.reply(`💘 *Love calculator*\n\n▸ +${targets[0]}\n▸ +${targets[1]}\n\n*Match:* ${percent}% ${verdict}`);
    },
  },

  {
    name: 'rate',
    aliases: ['rating', 'score'],
    category: 'fun',
    description: 'Rate anything out of 10',
    usage: '<thing>',
    run: async (ctx) => {
      const thing = ctx.argText || ctx.pushName;
      const score = (crypto.createHash('md5').update(thing.toLowerCase()).digest()[0] % 11);
      await ctx.reply(`⭐ *Rating*\n\n▸ ${thing}\n▸ Score: *${score}/10*\n${'⭐'.repeat(Math.max(1, Math.round(score / 2)))}`);
    },
  },

  {
    name: 'gayrate',
    aliases: ['gay'],
    category: 'fun',
    description: 'Fun percentage meter',
    usage: '[name]',
    run: async (ctx) => {
      const name = ctx.argText || ctx.pushName;
      const p = crypto.createHash('md5').update(name).digest()[0] % 101;
      await ctx.reply(`🌈 *${name}* is ${p}% gay today. ${p > 50 ? '😂' : '😇'}`);
    },
  },

  {
    name: 'stupidrate',
    aliases: ['stupid'],
    category: 'fun',
    description: 'Silly stupidity meter',
    usage: '[name]',
    run: async (ctx) => {
      const name = ctx.argText || ctx.pushName;
      const p = crypto.createHash('md5').update(`stupid${name}`).digest()[0] % 101;
      await ctx.reply(`🤪 *${name}* scores *${p}%* on the silly meter.`);
    },
  },

  {
    name: 'simprate',
    aliases: ['simp'],
    category: 'fun',
    description: 'Simp level calculator',
    usage: '[name]',
    run: async (ctx) => {
      const name = ctx.argText || ctx.pushName;
      const p = crypto.createHash('md5').update(`simp${name}`).digest()[0] % 101;
      await ctx.reply(`😍 *${name}* is *${p}%* simp.\n${p > 80 ? 'Hopeless romantic!' : 'Still has a chance.'}`);
    },
  },

  {
    name: 'pp',
    aliases: ['size'],
    category: 'fun',
    description: 'Classic 8-ball style fun meter',
    usage: '[name]',
    run: async (ctx) => {
      const name = ctx.argText || ctx.pushName;
      const size = randomInt(1, 20);
      await ctx.reply(`📏 *${name}*\n\n${'='.repeat(size)} (${size}cm)\n_Joke only 😄_`);
    },
  },

  {
    name: '8ball',
    aliases: ['eightball', 'ask'],
    category: 'fun',
    description: 'Ask the magic 8-ball a question',
    usage: '<question>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`🎱 Ask a question: \`${ctx.prefix}8ball Will I win today?\``);
      await ctx.reply(`🎱 *Question:* ${ctx.argText}\n\n*Answer:* ${randomItem(fortunes)}`);
    },
  },

  {
    name: 'dice',
    aliases: ['roll'],
    category: 'fun',
    description: 'Roll a dice (default d6)',
    usage: '[sides]',
    run: async (ctx) => {
      const sides = Math.min(1000, Math.max(2, parseInt(ctx.args[0], 10) || 6));
      const value = rollDice(sides);
      await ctx.reply(`🎲 You rolled a *d${sides}*: *${value}*`);
    },
  },

  {
    name: 'coinflip',
    aliases: ['coin', 'flip'],
    category: 'fun',
    description: 'Flip a coin',
    run: async (ctx) => {
      const result = crypto.randomBytes(1)[0] % 2 === 0 ? 'Heads 🪙' : 'Tails 🪙';
      await ctx.reply(`🪙 *Coin flip:* ${result}`);
    },
  },

  {
    name: 'slot',
    aliases: ['slots', 'spin'],
    category: 'fun',
    description: 'Play a mini slot machine',
    run: async (ctx) => {
      const symbols = ['🍒', '🍋', '🍉', '⭐', '7️⃣', '💎'];
      const result = [randomItem(symbols), randomItem(symbols), randomItem(symbols)];
      const won = result[0] === result[1] && result[1] === result[2];
      await ctx.reply(
        `🎰 *SLOT MACHINE*\n\n┃ ${result.join(' ┃ ')} ┃\n\n${won ? '🎉 *JACKPOT!* You won!' : '😢 No win this time. Try again!'}`
      );
    },
  },

  {
    name: 'rps',
    aliases: ['rockpaperscissors'],
    category: 'fun',
    description: 'Play rock paper scissors',
    usage: '<rock|paper|scissors>',
    run: async (ctx) => {
      const choices = ['rock', 'paper', 'scissors'];
      const user = (ctx.args[0] || '').toLowerCase();
      if (!choices.includes(user)) return ctx.reply(`Usage: \`${ctx.prefix}rps rock|paper|scissors\``);
      const bot = randomItem(choices);
      const emoji = { rock: '🪨', paper: '📄', scissors: '✂️' };
      let verdict;
      if (user === bot) verdict = '🤝 Draw!';
      else if (
        (user === 'rock' && bot === 'scissors') ||
        (user === 'paper' && bot === 'rock') ||
        (user === 'scissors' && bot === 'paper')
      ) verdict = '🎉 You win!';
      else verdict = '🤖 I win!';
      await ctx.reply(`✊ *Rock Paper Scissors*\n\n▸ You: ${emoji[user]} ${user}\n▸ Me: ${emoji[bot]} ${bot}\n\n${verdict}`);
    },
  },

  {
    name: 'trivia',
    aliases: ['triviaq'],
    category: 'fun',
    description: 'Get a trivia question with the answer hidden',
    run: async (ctx) => {
      const { data } = await http.get('https://opentdb.com/api.php?amount=1&type=multiple');
      const q = data.results?.[0];
      if (!q) return ctx.reply('❌ Could not load trivia right now.');
      const options = shuffle([q.correct_answer, ...q.incorrect_answers]);
      await ctx.reply(
        box(
          `Trivia • ${titleCase(q.difficulty)}`,
          `${q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'")}\n\n` +
            options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o.replace(/&quot;/g, '"').replace(/&#039;/g, "'")}`).join('\n') +
            `\n\n💡 \`${ctx.prefix}triviareveal\` for the answer`
        )
      );
      // stash the answer on the group record
      const rec = ctx.isGroup ? ctx.groupRecord() : null;
      if (rec) {
        rec.trivia = { answer: q.correct_answer, at: Date.now() };
        groupsStorePersist();
      }
    },
  },

  {
    name: 'triviareveal',
    aliases: ['reveal trivia'],
    category: 'fun',
    description: 'Reveal the last trivia answer',
    run: async (ctx) => {
      const rec = ctx.isGroup ? ctx.groupRecord() : null;
      if (!rec?.trivia) return ctx.reply('ℹ️ No trivia in progress.');
      await ctx.reply(`✅ *The answer was:* ${rec.trivia.answer}`);
      delete rec.trivia;
      groupsStorePersist();
    },
  },

  {
    name: 'quiz',
    aliases: ['gk'],
    category: 'fun',
    description: 'Random general knowledge question',
    run: async (ctx) => {
      const { data } = await http.get('https://opentdb.com/api.php?amount=1&category=9&type=boolean');
      const q = data.results?.[0];
      if (!q) return ctx.reply('❌ Could not load a quiz question.');
      await ctx.reply(`❓ *True or False?*\n\n${q.question.replace(/&quot;/g, '"')}\n\n_Answer: ${q.correct_answer}_`);
    },
  },

  {
    name: 'compliment',
    aliases: ['compliments'],
    category: 'fun',
    description: 'Send a compliment',
    usage: '[@user]',
    run: async (ctx) => {
      const target = ctx.mentions[0] ? `@${ctx.mentions[0].split('@')[0]}` : ctx.pushName;
      await ctx.reply(`💌 ${target}, ${randomItem(compliments)}`);
    },
  },

  {
    name: 'emojify',
    aliases: ['emoji'],
    category: 'fun',
    description: 'Turn a word into emoji letters',
    usage: '<word>',
    run: async (ctx) => {
      const word = (ctx.args[0] || '').toLowerCase().slice(0, 12);
      if (!word) return ctx.reply(`Usage: \`${ctx.prefix}emojify hello\``);
      const map = { a: '🅰️', b: '🅱️', c: '🇨', d: '🇩', e: '🇪', f: '🇫', g: '🇬', h: '🇭', i: '🇮', j: '🇯', k: '🇰', l: '🇱', m: '🇲', n: '🇳', o: '⭕', p: '🇵', q: '🇶', r: '🇷', s: '🇸', t: '🇹', u: '🇺', v: '🇻', w: '🇼', x: '🇽', y: '🇾', z: '🇿' };
      await ctx.reply(word.split('').map((c) => map[c] || c).join(' '));
    },
  },

  {
    name: 'reverse',
    aliases: ['rev'],
    category: 'fun',
    description: 'Reverse the text you send',
    usage: '<text>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}reverse hello world\``);
      await ctx.reply([...ctx.argText].reverse().join(''));
    },
  },

  {
    name: 'horoscope',
    aliases: ['zodiac', 'horoscopetoday'],
    category: 'fun',
    description: 'Daily horoscope for a zodiac sign',
    usage: '<sign>',
    run: async (ctx) => {
      const sign = (ctx.args[0] || '').toLowerCase();
      if (!horoscopes[sign]) {
        return ctx.reply(`♈ Signs: ${Object.keys(horoscopes).join(', ')}\nExample: \`${ctx.prefix}horoscope leo\``);
      }
      await ctx.reply(`🔮 *Horoscope for ${titleCase(sign)}*\n\n${horoscopes[sign]}\n\n_${fmtDate()}_`);
    },
  },

  {
    name: 'luckynumber',
    aliases: ['lucky'],
    category: 'fun',
    description: 'Get your lucky number for today',
    run: async (ctx) => {
      const seed = `${ctx.senderNumber}${new Date().toDateString()}`;
      const n = (crypto.createHash('md5').update(seed).digest().readUInt16BE(0) % 100) + 1;
      await ctx.reply(`🍀 *Lucky number:* ${n}\n📅 For ${fmtDate()}`);
    },
  },

  {
    name: 'password',
    aliases: ['passgen', 'randompass'],
    category: 'fun',
    description: 'Generate a strong random password',
    usage: '[length]',
    cooldown: 3,
    run: async (ctx) => {
      const length = Math.min(64, Math.max(8, parseInt(ctx.args[0], 10) || 16));
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
      let pass = '';
      for (let i = 0; i < length; i += 1) pass += chars[crypto.randomInt(chars.length)];
      await ctx.reply(box('Generated Password', `\`${pass}\`\n\n▸ Length: ${length}\n▸ Symbols & numbers included\n\n_Delete this message after saving it._`));
    },
  },

  {
    name: 'uuid',
    aliases: ['genuuid'],
    category: 'fun',
    description: 'Generate a UUID v4',
    run: async (ctx) => ctx.reply(`🆔 \`${crypto.randomUUID()}\``),
  },

  {
    name: 'mock',
    aliases: ['spongebob'],
    category: 'fun',
    description: 'tYpE lIkE tHiS (mock text)',
    usage: '<text>',
    run: async (ctx) => {
      if (!ctx.argText) return ctx.reply(`Usage: \`${ctx.prefix}mock hello world\``);
      const out = [...ctx.argText].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('');
      await ctx.reply(out);
    },
  },

  {
    name: 'emojistorm',
    aliases: ['storm'],
    category: 'fun',
    description: 'Emoji explosion',
    run: async (ctx) => {
      const emojis = ['🎉', '🎊', '✨', '🌟', '💫', '🔥', '🚀', '🎈', '💥', '🌈'];
      await ctx.reply(Array.from({ length: 30 }, () => randomItem(emojis)).join(''));
    },
  },

  {
    name: 'gamble',
    aliases: ['bet'],
    category: 'fun',
    description: 'Virtual coin gamble (no real money)',
    usage: '[amount]',
    run: async (ctx) => {
      const amount = Math.min(1000, Math.max(1, parseInt(ctx.args[0], 10) || 10));
      const win = crypto.randomBytes(1)[0] % 100 < 45;
      await ctx.reply(`🎰 *Virtual gamble*\n\n▸ Bet: ${amount} 🪙\n▸ Result: ${win ? `🎉 You won ${amount * 2} 🪙!` : '😢 You lost. Better luck next time!'}\n\n_Virtual only — no real money._`);
    },
  },

  {
    name: 'countdown',
    aliases: ['count'],
    category: 'fun',
    description: 'Dramatic countdown messages',
    usage: '[from]',
    run: async (ctx) => {
      const from = Math.min(5, Math.max(1, parseInt(ctx.args[0], 10) || 3));
      for (let i = from; i >= 1; i -= 1) {
        await ctx.reply(`⏳ ${i}…`);
        await sleep(800);
      }
      await ctx.reply('🚀 *LIFTOFF!*');
    },
  },
  ...extra,
];

