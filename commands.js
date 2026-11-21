/**
 * IP DILSAHN - command loader
 * ------------------------------------------------------------------
 * Dynamically imports every .js file in commands/ and registers the
 * exported commands. Files may export either:
 *   export default [cmd1, cmd2, ...]
 *   export const commands = [...]
 *   export default command({ ... })   (single command)
 *
 * The loader also does a full structural validation pass and prints a
 * report so startup fails loudly if any command is broken.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import config from '../config.js';
import logger from './logger.js';
import { registerAll, registry, command as defineCommand } from './registry.js';

export const loadCommands = async () => {
  const dir = config.paths.commands;
  if (!fs.existsSync(dir)) throw new Error(`Commands folder not found: ${dir}`);

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js') && !f.startsWith('_') && !f.startsWith('.'))
    .sort();

  const collected = [];
  const fileReport = [];

  for (const file of files) {
    const full = path.join(dir, file);
    try {
      const mod = await import(pathToFileURL(full).href);
      let exported = mod.default ?? mod.commands ?? [];

      if (typeof mod.default === 'function' && mod.default.definition) {
        exported = [mod.default.definition];
      }

      if (!Array.isArray(exported)) exported = [exported];

      const wrapped = [];
      for (const item of exported) {
        if (!item) continue;
        wrapped.push(item.__isRawCommand ? item : defineCommand(item));
      }

      collected.push(...wrapped);
      fileReport.push({ file, count: wrapped.length });
    } catch (err) {
      logger.error(`Failed loading commands/${file}: ${err.message}`);
      throw err;
    }
  }

  const { count } = registerAll(collected);

  logger.info(`Loaded ${count} commands from ${files.length} files`);
  return { count, files: files.length, report: fileReport };
};

export const getCounts = () => ({ commands: registry.size });
