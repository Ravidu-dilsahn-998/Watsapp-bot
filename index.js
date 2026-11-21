/**
 * IP DILSAHN — main entry point
 * ------------------------------------------------------------------
 *  1. Load config + persistent stores
 *  2. Load and validate every command module
 *  3. Start the Express dashboard
 *  4. Boot the WhatsApp socket (QR / pairing codes)
 *  5. Handle shutdown cleanly on every host (Koyeb / Render / Railway)
 */

import process from 'process';
import config from './config.js';
import logger from './lib/logger.js';
import { flushAll, scheduleFlush, settingsStore } from './lib/db.js';
import { loadCommands } from './lib/commands.js';
import { countCommands, countAliases, commandsByCategory } from './lib/registry.js';
import { startServer } from './lib/server.js';
import { startSocket, shutdown, state, bus } from './lib/bot.js';
import { cleanOldFiles, fmtBytes, getSystemInfo, sleep } from './lib/helpers.js';

const printBanner = (counts) => {
  const sys = getSystemInfo();
  console.log('');
  console.log('  ╔════════════════════════════════════════════════╗');
  console.log('  ║          🤖  IP DILSAHN  WhatsApp Bot          ║');
  console.log('  ║          Baileys 7 · Node.js · Express         ║');
  console.log('  ╚════════════════════════════════════════════════╝');
  console.log(`   Bot name   : ${config.bot.name}`);
  console.log(`   Prefix     : ${config.bot.prefix}`);
  console.log(`   Commands   : ${counts.commands} (${counts.aliases} aliases)`);
  console.log(`   Categories : ${counts.categories}`);
  console.log(`   Port       : ${config.server.port}`);
  console.log(`   Node       : ${sys.node} on ${sys.platform}`);
  console.log(`   Memory     : ${fmtBytes(sys.processMem)} RSS`);
  console.log(`   Dashboard  : ${config.server.password ? 'password protected 🔒' : 'open ⚠️'}`);
  console.log('');
};

const boot = async () => {
  process.env.TZ = process.env.TZ || config.bot.timezone;

  const loaded = await loadCommands();
  const counts = {
    commands: countCommands(),
    aliases: countAliases(),
    categories: Object.keys(commandsByCategory()).length,
    files: loaded.files,
  };

  printBanner(counts);

  // Friendly first-run guidance
  if (!config.owner.numbers.length && !(settingsStore.data.ownerNumbers || []).length) {
    logger.warn('No OWNER_NUMBER configured! Set the OWNER_NUMBER env var (e.g. 947XXXXXXXX) so you get owner access + the connection alert.');
  }
  if (!config.server.password) {
    logger.warn('DASHBOARD_PASSWORD is empty — anyone with the URL can request pairing codes. Set it before going public.');
  }

  if (counts.commands < 300) {
    logger.warn(`Only ${counts.commands} commands registered — expected at least 300.`);
  } else {
    logger.success(`Command registry healthy: ${counts.commands} commands loaded.`);
  }

  // Housekeeping
  cleanOldFiles();
  setInterval(() => {
    cleanOldFiles();
    scheduleFlush();
  }, 1000 * 60 * 10).unref?.();

  // Web dashboard
  await startServer();

  // WhatsApp
  logger.info('Starting WhatsApp socket…');
  await startSocket();

  // Occasional status log
  setInterval(() => {
    if (state.connected) {
      logger.debug(`♻️ heartbeat · status=${state.status} · handled=${state.commandsHandled} · mem=${fmtBytes(process.memoryUsage().rss)}`);
    }
  }, 1000 * 60).unref?.();

  bus.on('status', ({ status }) => {
    if (status === 'connected') logger.success('WhatsApp session is live ✅');
    if (status === 'disconnected') logger.warn('WhatsApp session is offline');
  });
};

/* ----------------------------- lifecycle ---------------------------- */

const fail = async (err) => {
  logger.error('Fatal startup error:', err?.stack || err?.message || err);
  try {
    flushAll();
  } catch {
    /* ignore */
  }
  await sleep(500);
  process.exit(1);
};

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err?.stack || err?.message || err);
});
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err?.stack || err?.message || err);
});
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

boot().catch(fail);
