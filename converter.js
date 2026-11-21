/**
 * IP DILSAHN - converters & calculators (36)
 * temp, length, weight, speed, data, time-unit, angle, fuel, bmi, age,
 * currency, timezone, timenow, timestamp, unix, roman, numerals,
 * words-to-numbers, number-base, hex-to-rgb, rgb-to-hex, hsl, percent,
 * discount, tip, vat, interest, loan, square, cube, sqrt, factorial,
 * prime, fibonacci, gcd, lcm, round, evenodd
 */

import { box } from '../lib/msg.js';
import { http, fmtDate, fmtSeconds } from '../lib/helpers.js';
import config from '../config.js';

const num = (ctx, index = 0) => {
  const n = parseFloat(String(ctx.args[index] ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const pair = async (ctx, usage) => {
  const a = num(ctx, 0);
  const b = num(ctx, 1);
  if (a === null || b === null) {
    await ctx.reply(`Usage: \`${ctx.prefix}${usage}\``);
    return null;
  }
  return [a, b];
};

const fmtNum = (n) => (Number.isInteger(n) ? n.toLocaleString() : Number(n.toFixed(6)).toLocaleString());

const ROMAN = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const toRoman = (n) => {
  if (n < 1 || n > 3999) return null;
  let out = '';
  let value = n;
  for (const [v, s] of ROMAN) {
    while (value >= v) {
      out += s;
      value -= v;
    }
  }
  return out;
};

const fromRoman = (s) => {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  const str = String(s).toUpperCase();
  let total = 0;
  for (let i = 0; i < str.length; i += 1) {
    const cur = map[str[i]];
    const next = map[str[i + 1]];
    if (!cur) return null;
    total += next && cur < next ? -cur : cur;
  }
  return total;
};

const isPrime = (n) => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i += 1) if (n % i === 0) return false;
  return true;
};

export default [
  {
    name: 'temp',
    aliases: ['temperature', 'celsius'],
    category: 'converter',
    description: 'Convert temperature between C, F and K',
    usage: '<value> <c|f|k>',
    example: '.temp 100 c',
    run: async (ctx) => {
      const value = num(ctx);
      const unit = (ctx.args[1] || 'c').toLowerCase();
      if (value === null) return ctx.reply(`Usage: \`${ctx.prefix}temp 100 c\``);
      let c;
      if (unit.startsWith('f')) c = ((value - 32) * 5) / 9;
      else if (unit.startsWith('k')) c = value - 273.15;
      else c = value;
      await ctx.reply(
        box(
          'Temperature Converter',
          `▸ Celsius: *${fmtNum(c)}°C*\n▸ Fahrenheit: *${fmtNum((c * 9) / 5 + 32)}°F*\n▸ Kelvin: *${fmtNum(c + 273.15)}K*`
        )
      );
    },
  },
  {
    name: 'length',
    aliases: ['dist'],
    category: 'converter',
    description: 'Convert length units',
    usage: '<value> <from> <to>',
    example: '.length 5 km mi',
    run: async (ctx) => {
      const value = num(ctx);
      const from = (ctx.args[1] || '').toLowerCase();
      const to = (ctx.args[2] || '').toLowerCase();
      const units = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852 };
      if (value === null || !units[from] || !units[to]) {
        return ctx.reply(`Usage: \`${ctx.prefix}length 5 km mi\`\nUnits: ${Object.keys(units).join(', ')}`);
      }
      const meters = value * units[from];
      await ctx.reply(`📏 *${value} ${from}* = *${fmtNum(meters / units[to])} ${to}*`);
    },
  },
  {
    name: 'weight',
    aliases: ['mass'],
    category: 'converter',
    description: 'Convert weight units',
    usage: '<value> <from> <to>',
    example: '.weight 70 kg lb',
    run: async (ctx) => {
      const value = num(ctx);
      const from = (ctx.args[1] || '').toLowerCase();
      const to = (ctx.args[2] || '').toLowerCase();
      const units = { mg: 0.000001, g: 0.001, kg: 1, t: 1000, oz: 0.0283495, lb: 0.453592, st: 6.35029 };
      if (value === null || !units[from] || !units[to]) {
        return ctx.reply(`Usage: \`${ctx.prefix}weight 70 kg lb\`\nUnits: ${Object.keys(units).join(', ')}`);
      }
      const kg = value * units[from];
      await ctx.reply(`⚖️ *${value} ${from}* = *${fmtNum(kg / units[to])} ${to}*`);
    },
  },
  {
    name: 'speed',
    aliases: ['velocity'],
    category: 'converter',
    description: 'Convert speed units',
    usage: '<value> <from> <to>',
    example: '.speed 100 kmh mph',
    run: async (ctx) => {
      const value = num(ctx);
      const from = (ctx.args[1] || '').toLowerCase();
      const to = (ctx.args[2] || '').toLowerCase();
      const units = { ms: 1, kmh: 0.277778, mph: 0.44704, kn: 0.514444, fts: 0.3048 };
      if (value === null || !units[from] || !units[to]) {
        return ctx.reply(`Usage: \`${ctx.prefix}speed 100 kmh mph\`\nUnits: ${Object.keys(units).join(', ')}`);
      }
      await ctx.reply(`🚀 *${value} ${from}* = *${fmtNum((value * units[from]) / units[to])} ${to}*`);
    },
  },
  {
    name: 'data',
    aliases: ['datasize', 'storage'],
    category: 'converter',
    description: 'Convert data size units',
    usage: '<value> <from> <to>',
    example: '.data 2 gb mb',
    run: async (ctx) => {
      const value = num(ctx);
      const from = (ctx.args[1] || '').toLowerCase();
      const to = (ctx.args[2] || '').toLowerCase();
      const units = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
      if (value === null || !units[from] || !units[to]) {
        return ctx.reply(`Usage: \`${ctx.prefix}data 2 gb mb\`\nUnits: ${Object.keys(units).join(', ')}`);
      }
      await ctx.reply(`💾 *${value} ${from}* = *${fmtNum((value * units[from]) / units[to])} ${to}*`);
    },
  },
  {
    name: 'timeunit',
    aliases: ['timeconv'],
    category: 'converter',
    description: 'Convert seconds to human time',
    usage: '<seconds>',
    run: async (ctx) => {
      const s = num(ctx);
      if (s === null) return ctx.reply(`Usage: \`${ctx.prefix}timeunit 3661\``);
      await ctx.reply(`⏱️ *${s} seconds*\n\n▸ Clock: ${fmtSeconds(s)}\n▸ Minutes: ${fmtNum(s / 60)}\n▸ Hours: ${fmtNum(s / 3600)}\n▸ Days: ${fmtNum(s / 86400)}`);
    },
  },
  {
    name: 'angle',
    aliases: ['deg'],
    category: 'converter',
    description: 'Convert degrees ↔ radians',
    usage: '<value> <deg|rad>',
    run: async (ctx) => {
      const v = num(ctx);
      const unit = (ctx.args[1] || 'deg').toLowerCase();
      if (v === null) return ctx.reply(`Usage: \`${ctx.prefix}angle 180 deg\``);
      const deg = unit.startsWith('r') ? (v * 180) / Math.PI : v;
      await ctx.reply(`📐 *${v} ${unit}*\n\n▸ Degrees: ${fmtNum(deg)}°\n▸ Radians: ${fmtNum((deg * Math.PI) / 180)}\n▸ Gradians: ${fmtNum((deg * 10) / 9)}`);
    },
  },
  {
    name: 'bmi',
    aliases: ['bodyindex'],
    category: 'converter',
    description: 'Calculate body mass index',
    usage: '<weight kg> <height cm>',
    example: '.bmi 70 175',
    run: async (ctx) => {
      const [w, h] = (await pair(ctx, 'bmi 70 175')) || [];
      if (!w) return;
      const m = h / 100;
      const bmi = w / (m * m);
      const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
      await ctx.reply(`⚖️ *BMI:* ${bmi.toFixed(1)}\n\n▸ Category: *${cat}*\n▸ Weight: ${w} kg\n▸ Height: ${h} cm`);
    },
  },
  {
    name: 'age',
    aliases: ['agecalc'],
    category: 'converter',
    description: 'Calculate age from a birth date',
    usage: '<YYYY-MM-DD>',
    run: async (ctx) => {
      const dob = new Date(ctx.args[0] || '');
      if (Number.isNaN(dob.getTime())) return ctx.reply(`Usage: \`${ctx.prefix}age 2000-01-31\``);
      const now = new Date();
      let years = now.getFullYear() - dob.getFullYear();
      let months = now.getMonth() - dob.getMonth();
      if (now.getDate() < dob.getDate()) months -= 1;
      if (months < 0) {
        years -= 1;
        months += 12;
      }
      const days = Math.floor((now - dob) / 86400000);
      await ctx.reply(`🎂 *Age*\n\n▸ ${years} years, ${months} months\n▸ ${days.toLocaleString()} days lived\n▸ ${Math.floor(days / 7).toLocaleString()} weeks`);
    },
  },
  {
    name: 'currency',
    aliases: ['exchange', 'forex'],
    category: 'converter',
    description: 'Convert between currencies',
    usage: '<amount> <FROM> <TO>',
    example: '.currency 100 USD LKR',
    cooldown: 4,
    run: async (ctx) => {
      const amount = num(ctx);
      const from = (ctx.args[1] || '').toUpperCase();
      const to = (ctx.args[2] || '').toUpperCase();
      if (amount === null || !from || !to) return ctx.reply(`Usage: \`${ctx.prefix}currency 100 USD LKR\``);
      const { data } = await http.get(`https://open.er-api.com/v6/latest/${from}`);
      const rate = data?.rates?.[to];
      if (!rate) return ctx.reply(`❌ Unknown currency pair ${from} → ${to}`);
      await ctx.reply(
        `💱 *Currency Conversion*\n\n▸ ${fmtNum(amount)} ${from} = *${fmtNum(amount * rate)} ${to}*\n▸ Rate: 1 ${from} = ${rate} ${to}\n▸ Updated: ${data.time_last_update_utc || 'n/a'}`
      );
    },
  },
  {
    name: 'timezone',
    aliases: ['tz'],
    category: 'converter',
    description: 'Current time in a timezone',
    usage: '<Area/City>',
    example: '.timezone Asia/Colombo',
    run: async (ctx) => {
      const zone = ctx.args[0] || 'Asia/Colombo';
      try {
        const time = new Date().toLocaleString('en-GB', { timeZone: zone, dateStyle: 'full', timeStyle: 'medium' });
        await ctx.reply(`🌍 *${zone}*\n\n▸ ${time}`);
      } catch {
        await ctx.reply('❌ Invalid timezone. Example: `Asia/Colombo`, `Europe/London`, `America/New_York`');
      }
    },
  },
  {
    name: 'timenow',
    aliases: ['clock', 'time'],
    category: 'converter',
    description: 'Current bot server time',
    run: async (ctx) => {
      await ctx.reply(
        `🕒 *Current time*\n\n▸ Bot timezone: ${config.bot.timezone}\n▸ Local: ${fmtDate()}\n▸ UTC: ${new Date().toUTCString()}\n▸ Unix: \`${Math.floor(Date.now() / 1000)}\``
      );
    },
  },
  {
    name: 'timestamp',
    aliases: ['ts'],
    category: 'converter',
    description: 'Current unix timestamp in ms and s',
    run: async (ctx) => {
      await ctx.reply(`⏱️ *Timestamps*\n\n▸ Seconds: \`${Math.floor(Date.now() / 1000)}\`\n▸ Milliseconds: \`${Date.now()}\``);
    },
  },
  {
    name: 'unix',
    aliases: ['fromunix'],
    category: 'converter',
    description: 'Convert a unix timestamp to a date',
    usage: '<timestamp>',
    run: async (ctx) => {
      let n = num(ctx);
      if (n === null) return ctx.reply(`Usage: \`${ctx.prefix}unix 1700000000\``);
      if (n < 1e12) n *= 1000;
      const d = new Date(n);
      if (Number.isNaN(d.getTime())) return ctx.reply('❌ Invalid timestamp.');
      await ctx.reply(`📅 *Unix timestamp*\n\n▸ UTC: ${d.toUTCString()}\n▸ Local: ${fmtDate(d)}`);
    },
  },
  {
    name: 'roman',
    aliases: ['toroman'],
    category: 'converter',
    description: 'Convert a number to Roman numerals',
    usage: '<1-3999>',
    run: async (ctx) => {
      const n = parseInt(ctx.args[0], 10);
      if (!Number.isFinite(n)) return ctx.reply(`Usage: \`${ctx.prefix}roman 2024\``);
      const r = toRoman(n);
      await ctx.reply(r ? `🏛️ *${n}* = *${r}*` : '❌ Only numbers 1–3999 are supported.');
    },
  },
  {
    name: 'fromroman',
    aliases: ['unroman'],
    category: 'converter',
    description: 'Convert Roman numerals to a number',
    usage: '<roman numerals>',
    run: async (ctx) => {
      if (!ctx.args[0]) return ctx.reply(`Usage: \`${ctx.prefix}fromroman XIV\``);
      const n = fromRoman(ctx.args[0]);
      await ctx.reply(n ? `🏛️ *${ctx.args[0].toUpperCase()}* = *${n}*` : '❌ Invalid Roman numeral.');
    },
  },
  {
    name: 'numberbase',
    aliases: ['tobase', 'baseconv'],
    category: 'converter',
    description: 'Convert a number between bases 2–36',
    usage: '<number> <toBase> [fromBase]',
    example: '.numberbase 255 16',
    run: async (ctx) => {
      const fromBase = parseInt(ctx.args[2], 10) || 10;
      const toBase = parseInt(ctx.args[1], 10) || 16;
      const parsed = parseInt(ctx.args[0], fromBase);
      if (!Number.isFinite(parsed) || toBase < 2 || toBase > 36) return ctx.reply(`Usage: \`${ctx.prefix}numberbase 255 16\``);
      await ctx.reply(`🔢 *${ctx.args[0]}* (base ${fromBase}) = *${parsed.toString(toBase).toUpperCase()}* (base ${toBase})`);
    },
  },
  {
    name: 'hextorgb',
    aliases: ['hex2rgb'],
    category: 'converter',
    description: 'Convert a hex colour to RGB',
    usage: '<#hex>',
    run: async (ctx) => {
      const hex = (ctx.args[0] || '').replace('#', '');
      if (!/^[0-9a-f]{6}$/i.test(hex)) return ctx.reply(`Usage: \`${ctx.prefix}hextorgb #22d3ee\``);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      await ctx.reply(`🎨 *#${hex.toUpperCase()}*\n\n▸ RGB: rgb(${r}, ${g}, ${b})\n▸ R: ${r}  G: ${g}  B: ${b}`);
    },
  },
  {
    name: 'rgbtohex',
    aliases: ['rgb2hex'],
    category: 'converter',
    description: 'Convert RGB values to hex',
    usage: '<r> <g> <b>',
    run: async (ctx) => {
      const r = parseInt(ctx.args[0], 10);
      const g = parseInt(ctx.args[1], 10);
      const b = parseInt(ctx.args[2], 10);
      if ([r, g, b].some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return ctx.reply(`Usage: \`${ctx.prefix}rgbtohex 34 211 238\``);
      const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      await ctx.reply(`🎨 rgb(${r}, ${g}, ${b}) = *${hex}*`);
    },
  },
  {
    name: 'percent',
    aliases: ['percentage'],
    category: 'converter',
    description: 'What is X% of Y',
    usage: '<percent> <number>',
    run: async (ctx) => {
      const [p, n] = (await pair(ctx, 'percent 15 200')) || [];
      if (p === null) return;
      await ctx.reply(`📊 *${p}% of ${fmtNum(n)}* = *${fmtNum((p / 100) * n)}*`);
    },
  },
  {
    name: 'discount',
    aliases: ['sale'],
    category: 'converter',
    description: 'Calculate a discount price',
    usage: '<price> <discount %>',
    run: async (ctx) => {
      const [price, off] = (await pair(ctx, 'discount 2500 20')) || [];
      if (price === null) return;
      const save = (price * off) / 100;
      await ctx.reply(`🏷️ *Discount*\n\n▸ Original: ${fmtNum(price)}\n▸ Discount: ${off}% (−${fmtNum(save)})\n▸ Final: *${fmtNum(price - save)}*`);
    },
  },
  {
    name: 'tip',
    aliases: ['tipcalc'],
    category: 'converter',
    description: 'Calculate a tip and split a bill',
    usage: '<bill> <tip%> [people]',
    run: async (ctx) => {
      const bill = num(ctx);
      const tip = num(ctx, 1) ?? 10;
      const people = Math.max(1, parseInt(ctx.args[2], 10) || 1);
      if (bill === null) return ctx.reply(`Usage: \`${ctx.prefix}tip 5000 10 4\``);
      const tipAmount = (bill * tip) / 100;
      const total = bill + tipAmount;
      await ctx.reply(
        `🍽️ *Bill split*\n\n▸ Bill: ${fmtNum(bill)}\n▸ Tip (${tip}%): ${fmtNum(tipAmount)}\n▸ Total: *${fmtNum(total)}*\n▸ Per person: *${fmtNum(total / people)}* (${people})`
      );
    },
  },
  {
    name: 'vat',
    aliases: ['tax'],
    category: 'converter',
    description: 'Add or remove VAT/tax',
    usage: '<amount> <rate%> [remove]',
    run: async (ctx) => {
      const amount = num(ctx);
      const rate = num(ctx, 1) ?? 18;
      if (amount === null) return ctx.reply(`Usage: \`${ctx.prefix}vat 1000 18\``);
      const remove = /^(rm|remove|excl)/i.test(ctx.args[2] || '');
      const value = remove ? amount / (1 + rate / 100) : amount * (1 + rate / 100);
      await ctx.reply(`🧾 *${remove ? 'Excluding' : 'Including'} ${rate}% VAT*\n\n▸ Amount: ${fmtNum(amount)}\n▸ Result: *${fmtNum(value)}*\n▸ VAT: ${fmtNum(remove ? amount - value : value - amount)}`);
    },
  },
  {
    name: 'interest',
    aliases: ['simpleinterest'],
    category: 'converter',
    description: 'Simple interest calculator',
    usage: '<principal> <rate%> <years>',
    run: async (ctx) => {
      const p = num(ctx);
      const r = num(ctx, 1);
      const t = num(ctx, 2);
      if ([p, r, t].some((v) => v === null)) return ctx.reply(`Usage: \`${ctx.prefix}interest 10000 5 3\``);
      const interest = (p * r * t) / 100;
      await ctx.reply(`🏦 *Simple interest*\n\n▸ Principal: ${fmtNum(p)}\n▸ Rate: ${r}% / year\n▸ Time: ${t} years\n▸ Interest: *${fmtNum(interest)}*\n▸ Total: *${fmtNum(p + interest)}*`);
    },
  },
  {
    name: 'loan',
    aliases: ['emi'],
    category: 'converter',
    description: 'Loan EMI calculator',
    usage: '<amount> <annual rate%> <months>',
    run: async (ctx) => {
      const amount = num(ctx);
      const rate = (num(ctx, 1) || 0) / 1200;
      const months = num(ctx, 2);
      if ([amount, months].some((v) => v === null)) return ctx.reply(`Usage: \`${ctx.prefix}loan 500000 12 60\``);
      const emi = rate ? (amount * rate * (1 + rate) ** months) / ((1 + rate) ** months - 1) : amount / months;
      await ctx.reply(`🏦 *Loan EMI*\n\n▸ Amount: ${fmtNum(amount)}\n▸ Months: ${months}\n▸ EMI: *${fmtNum(emi)}* / month\n▸ Total payment: ${fmtNum(emi * months)}`);
    },
  },
  {
    name: 'square',
    aliases: ['sq'],
    category: 'converter',
    description: 'Square a number',
    usage: '<number>',
    run: async (ctx) => {
      const n = num(ctx);
      if (n === null) return ctx.reply(`Usage: \`${ctx.prefix}square 12\``);
      await ctx.reply(`🔢 *${n}²* = *${fmtNum(n * n)}*`);
    },
  },
  {
    name: 'cube',
    category: 'converter',
    description: 'Cube a number',
    usage: '<number>',
    run: async (ctx) => {
      const n = num(ctx);
      if (n === null) return ctx.reply(`Usage: \`${ctx.prefix}cube 5\``);
      await ctx.reply(`🔢 *${n}³* = *${fmtNum(n ** 3)}*`);
    },
  },
  {
    name: 'sqrt',
    aliases: ['squareroot'],
    category: 'converter',
    description: 'Square root of a number',
    usage: '<number>',
    run: async (ctx) => {
      const n = num(ctx);
      if (n === null || n < 0) return ctx.reply(`Usage: \`${ctx.prefix}sqrt 144\``);
      await ctx.reply(`√${n} = *${fmtNum(Math.sqrt(n))}*`);
    },
  },
  {
    name: 'factorial',
    aliases: ['fact2', 'nfact'],
    category: 'converter',
    description: 'Factorial of a number (max 20)',
    usage: '<0-20>',
    run: async (ctx) => {
      const n = parseInt(ctx.args[0], 10);
      if (!Number.isFinite(n) || n < 0 || n > 20) return ctx.reply(`Usage: \`${ctx.prefix}factorial 5\` (0–20)`);
      let out = 1n;
      for (let i = 2n; i <= BigInt(n); i += 1n) out *= i;
      await ctx.reply(`🔢 *${n}!* = *${out.toLocaleString()}*`);
    },
  },
  {
    name: 'prime',
    aliases: ['isprime'],
    category: 'converter',
    description: 'Check if a number is prime',
    usage: '<number>',
    run: async (ctx) => {
      const n = parseInt(ctx.args[0], 10);
      if (!Number.isFinite(n)) return ctx.reply(`Usage: \`${ctx.prefix}prime 97\``);
      await ctx.reply(`${isPrime(n) ? '✅' : '❌'} *${n}* is ${isPrime(n) ? '' : 'not '}a prime number.`);
    },
  },
  {
    name: 'fibonacci',
    aliases: ['fib'],
    category: 'converter',
    description: 'First N Fibonacci numbers (max 60)',
    usage: '<count>',
    run: async (ctx) => {
      const count = Math.min(60, Math.max(1, parseInt(ctx.args[0], 10) || 10));
      const seq = [0, 1];
      while (seq.length < count) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
      await ctx.reply(`🌀 *Fibonacci (${count})*\n\n${seq.slice(0, count).join(', ')}`);
    },
  },
  {
    name: 'gcd',
    aliases: ['hcf'],
    category: 'converter',
    description: 'Greatest common divisor',
    usage: '<a> <b>',
    run: async (ctx) => {
      const [a, b] = (await pair(ctx, 'gcd 24 36')) || [];
      if (a === null) return;
      const gcd = (x, y) => (y === 0 ? Math.abs(x) : gcd(y, x % y));
      await ctx.reply(`🔢 *GCD(${a}, ${b})* = *${gcd(a, b)}*`);
    },
  },
  {
    name: 'lcm',
    category: 'converter',
    description: 'Lowest common multiple',
    usage: '<a> <b>',
    run: async (ctx) => {
      const [a, b] = (await pair(ctx, 'lcm 4 6')) || [];
      if (a === null) return;
      const gcd = (x, y) => (y === 0 ? Math.abs(x) : gcd(y, x % y));
      await ctx.reply(`🔢 *LCM(${a}, ${b})* = *${Math.abs(a * b) / gcd(a, b)}*`);
    },
  },
  {
    name: 'round',
    aliases: ['roundnum'],
    category: 'converter',
    description: 'Round a decimal number',
    usage: '<number> [decimals]',
    run: async (ctx) => {
      const n = num(ctx);
      const d = Math.min(10, Math.max(0, parseInt(ctx.args[1], 10) || 0));
      if (n === null) return ctx.reply(`Usage: \`${ctx.prefix}round 3.14159 2\``);
      await ctx.reply(`🔢 *${n}* → *${n.toFixed(d)}*`);
    },
  },
  {
    name: 'numtowords',
    aliases: ['wordnum', 'spell'],
    category: 'converter',
    description: 'Spell a number in English words',
    usage: '<number>',
    run: async (ctx) => {
      const n = parseInt(ctx.args[0], 10);
      if (!Number.isFinite(n) || Math.abs(n) > 999999999) return ctx.reply(`Usage: \`${ctx.prefix}numtowords 1234\` (max 999,999,999)`);
      const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
      const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
      const under1000 = (x) => {
        let out = '';
        if (x >= 100) {
          out += `${ones[Math.floor(x / 100)]} hundred`;
          x %= 100;
          if (x) out += ' ';
        }
        if (x >= 20) {
          out += tens[Math.floor(x / 10)];
          if (x % 10) out += `-${ones[x % 10]}`;
        } else if (x > 0) out += ones[x];
        return out;
      };
      const spell = (x) => {
        if (x === 0) return 'zero';
        const parts = [];
        const million = Math.floor(x / 1000000);
        const thousand = Math.floor((x % 1000000) / 1000);
        const rest = x % 1000;
        if (million) parts.push(`${under1000(million)} million`);
        if (thousand) parts.push(`${under1000(thousand)} thousand`);
        if (rest) parts.push(under1000(rest));
        return parts.join(' ');
      };
      const words = `${n < 0 ? 'minus ' : ''}${spell(Math.abs(n))}`;
      await ctx.reply(`🔤 *${n}*\n\n${words.charAt(0).toUpperCase()}${words.slice(1)}`);
    },
  },
  {
    name: 'evenodd',
    aliases: ['parity'],
    category: 'converter',
    description: 'Check if a number is even or odd',
    usage: '<number>',
    run: async (ctx) => {
      const n = parseInt(ctx.args[0], 10);
      if (!Number.isFinite(n)) return ctx.reply(`Usage: \`${ctx.prefix}evenodd 7\``);
      await ctx.reply(`🔢 *${n}* is *${n % 2 === 0 ? 'EVEN' : 'ODD'}*`);
    },
  },
];
