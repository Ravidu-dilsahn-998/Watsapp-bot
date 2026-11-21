/**
 * IP DILSAHN - pretty console logger (no pino transport to keep RAM low)
 */

import config from '../config.js';

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (color, text) => (useColor ? `${COLORS[color]}${text}${COLORS.reset}` : text);

const stamp = () => {
  const d = new Date();
  return d.toLocaleTimeString(config.bot.locale, { hour12: false });
};

const emit = (level, color, icon, args) => {
  const prefix = `${paint('dim', stamp())} ${paint(color, `${icon} ${level.toUpperCase()}`)}`;
  const line = args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
  console.log(`${prefix} ${line}`);
};

export const logger = {
  info: (...args) => emit('info', 'cyan', 'ℹ', args),
  success: (...args) => emit('ok', 'green', '✔', args),
  warn: (...args) => emit('warn', 'yellow', '⚠', args),
  error: (...args) => emit('error', 'red', '✖', args),
  debug: (...args) => {
    if (config.logLevel === 'debug') emit('debug', 'magenta', '🐞', args);
  },
  banner: (lines) => {
    console.log('');
    for (const line of lines) console.log(`  ${paint('cyan', line)}`);
    console.log('');
  },
};

export default logger;
