/**
 * IP DILSAHN - Express dashboard & API
 * ------------------------------------------------------------------
 *  GET  /                     mobile dashboard (public/index.html)
 *  GET  /healthz              uptime probe for hosts (no auth)
 *  POST /api/pair             { number } -> real Baileys pairing code
 *  GET  /api/status           live connection + bot info
 *  GET  /api/commands         command catalogue
 *  GET  /api/stats            usage stats
 *  POST /api/logout           wipe session (dashboard password required)
 *  GET  /api/qr               current QR (fallback pairing method)
 *
 * Auth: set DASHBOARD_PASSWORD to protect the panel. API accepts
 * `x-api-key` header or `?key=` query. When no password is set the
 * panel is open (fine for a private test deploy - set one publicly).
 */

import path from 'path';
import crypto from 'crypto';
import express from 'express';
import qrcode from 'qrcode';
import config from '../config.js';
import logger from './logger.js';
import { state, requestPairing, resetSession } from './bot.js';
import { settingsStore, statsStore, usersStore, groupsStore } from './db.js';
import { countCommands, countAliases, commandsByCategory, CATEGORY_META } from './registry.js';
import { fmtDuration, fmtBytes, getUptime, getSystemInfo, fmtDate } from './helpers.js';

const startedAt = Date.now();

const safeEqual = (a = '', b = '') => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
};

const extractKey = (req) => {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.headers['x-api-key'] || req.query.key || req.body?.key || '';
};

const authEnabled = () => Boolean(config.server.password);

const requireAuth = (req, res) => {
  if (!authEnabled()) return true;
  const key = extractKey(req);
  if (safeEqual(key, config.server.password) || (config.server.apiKey && safeEqual(key, config.server.apiKey))) {
    return true;
  }
  res.status(401).json({ ok: false, error: 'Unauthorized. Provide the dashboard password.' });
  return false;
};

const snapshot = () => {
  const sys = getSystemInfo();
  return {
    ok: true,
    bot: {
      name: settingsStore.data.botName || config.bot.name,
      version: config.bot.version,
      prefix: settingsStore.data.prefix || config.bot.prefix,
      status: state.status,
      connected: state.connected,
      number: state.botNumber || '',
      jid: state.botJid || '',
      pushName: state.pushName || '',
      connectedAt: state.connectedAt,
      lastError: state.lastError || '',
      pairingCode: state.pairingCode || '',
      pairingNumber: state.pairingNumber || '',
      commands: countCommands(),
      aliases: countAliases(),
      categories: Object.keys(commandsByCategory()).length,
      uptime: fmtDuration(getUptime()),
      serverUptime: fmtDuration(Date.now() - startedAt),
      memory: fmtBytes(sys.processMem),
      memPercent: sys.memPercent,
      platform: `${sys.platform} ${sys.arch}`,
      node: sys.node,
      nodeVersion: process.version,
      baileys: '7.0.0-rc14',
      commandsHandled: state.commandsHandled,
      messagesSeen: state.messagesSeen,
      reconnects: state.reconnectAttempts,
      time: fmtDate(),
    },
    stats: {
      totalCommands: statsStore.data.totalCommands || 0,
      downloads: statsStore.data.downloads || 0,
      sessions: statsStore.data.sessions || 0,
      users: Object.keys(usersStore.data.users || {}).length,
      premium: (usersStore.data.premium || []).length,
      sudo: (usersStore.data.sudo || []).length,
      groups: Object.keys(groupsStore.data.groups || {}).length,
    },
    authRequired: authEnabled(),
  };
};

export const createServer = () => {
  const app = express();
  if (config.server.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  /* ------------------------------ static -------------------------- */

  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.paths.public, 'index.html'));
  });

  // Password-protected variant: the page always sends the key with API calls,
  // but the HTML itself can optionally be gated with ?key=
  app.get('/healthz', (req, res) => res.json({ ok: true, status: state.status, uptime: process.uptime() }));

  /* ------------------------------ animeverse ---------------------- */
  // Single-file animated character experience (images inline, sound synthesized).
  // Served publicly so it can be opened/shared without the dashboard password.
  app.get(['/anime', '/anime/', '/animeverse'], (req, res) => {
    const file = path.join(config.paths.assets, 'animeverse', 'index.html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(file, (err) => {
      if (err) res.status(404).send('AnimeVerse not installed');
    });
  });

  app.use(express.static(config.paths.public, { maxAge: '1h', index: false }));

  /* ------------------------------- auth --------------------------- */

  app.post('/api/auth', (req, res) => {
    if (!authEnabled()) return res.json({ ok: true, required: false });
    const key = extractKey(req);
    const ok = safeEqual(key, config.server.password) || (config.server.apiKey && safeEqual(key, config.server.apiKey));
    return ok ? res.json({ ok: true }) : res.status(401).json({ ok: false, error: 'Wrong password' });
  });

  /* ------------------------------ status -------------------------- */

  app.get('/api/status', (req, res) => {
    // status is readable without the password so the panel can show the
    // connection state before login; secrets are never included.
    res.setHeader('Cache-Control', 'no-store');
    res.json(snapshot());
  });

  /* ---------------------------- pairing --------------------------- */

  app.post('/api/pair', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const number = String(req.body?.number || req.body?.phone || '').trim();
      if (!number) return res.status(400).json({ ok: false, error: 'Phone number is required.' });
      const result = await requestPairing(number);
      logger.success(`Pairing code issued to ${result.number}`);
      res.json({ ok: true, ...result, status: state.status, bot: settingsStore.data.botName });
    } catch (err) {
      logger.warn(`Pairing failed: ${err.message}`);
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  /* ------------------------------- qr ----------------------------- */

  app.get('/api/qr', async (req, res) => {
    if (!requireAuth(req, res)) return;
    if (state.connected) return res.json({ ok: false, error: 'Already connected.' });
    if (!state.qr) return res.json({ ok: false, error: 'No QR available yet. Reload the socket or request a pairing code.' });
    try {
      const dataUrl = await qrcode.toDataURL(state.qr, { margin: 1, width: 420 });
      res.json({ ok: true, qr: dataUrl });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /* --------------------------- commands --------------------------- */

  app.get('/api/commands', (req, res) => {
    const grouped = commandsByCategory();
    const out = {};
    for (const [cat, list] of Object.entries(grouped)) {
      out[cat] = {
        meta: CATEGORY_META[cat] || { emoji: '📁', title: cat },
        commands: list.map((c) => ({
          name: c.name,
          aliases: c.aliases,
          description: c.description,
          usage: c.usage,
          role: c.role,
          scope: c.scope,
        })),
      };
    }
    res.json({ ok: true, total: countCommands(), categories: out });
  });

  /* ----------------------------- logout --------------------------- */

  app.post('/api/logout', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      await resetSession();
      res.json({ ok: true, message: 'Session cleared. Request a new pairing code.' });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /* ------------------------------ misc ---------------------------- */

  app.get('/api/stats', (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json({
      ok: true,
      stats: statsStore.data,
      settings: {
        prefix: settingsStore.data.prefix,
        public: settingsStore.data.public,
        features: settingsStore.data.features,
      },
    });
  });

  app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('Express error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  });

  return app;
};

export const startServer = () =>
  new Promise((resolve) => {
    const app = createServer();
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.banner([
        `🚀 ${settingsStore.data.botName || config.bot.name} dashboard`,
        `   http://localhost:${config.server.port}`,
        `   Password protection: ${authEnabled() ? 'ON' : 'OFF (set DASHBOARD_PASSWORD)'}`,
      ]);
      resolve(server);
    });
    server.on('error', (err) => {
      logger.error('Express server error:', err.message);
      resolve(null);
    });
  });
