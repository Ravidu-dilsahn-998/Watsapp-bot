#!/usr/bin/env node
/**
 * IP DILSAHN - project self-check
 * node scripts/check.js
 * Verifies syntax of every JS file and loads the command registry.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', 'auth', '.tmp', 'session', '.git'].includes(f)) continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (p.endsWith('.js')) targets.push(p);
  }
};
walk(root);

let failed = 0;
for (const file of targets) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('✔ syntax', path.relative(root, file));
  } catch (err) {
    failed += 1;
    console.log('✖ syntax', path.relative(root, file), String(err.stderr || err.message).split('\n').slice(0, 3).join(' '));
  }
}

const { loadCommands } = await import(pathToFileURL(path.join(root, 'lib/commands.js')).href);
const { countCommands, countAliases, commandsByCategory } = await import(pathToFileURL(path.join(root, 'lib/registry.js')).href);

await loadCommands();
const total = countCommands();
const cats = Object.keys(commandsByCategory()).length;
console.log('');
console.log(`Files checked : ${targets.length}`);
console.log(`Syntax errors : ${failed}`);
console.log(`Commands      : ${total}`);
console.log(`Aliases       : ${countAliases()}`);
console.log(`Categories    : ${cats}`);

if (failed) process.exit(1);
if (total < 300) {
  console.log('⚠️  Expected at least 300 commands');
  process.exit(1);
}
console.log('✅ Project is healthy.');
