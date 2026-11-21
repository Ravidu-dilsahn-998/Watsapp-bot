#!/usr/bin/env node
/**
 * IP DILSAHN - command counter
 * node scripts/count.js [--list]
 *
 * Prints per-file and per-category command counts, verifies there are
 * no duplicate names/aliases and that the total is >= 300.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

const { loadCommands } = await import(pathToFileURL(path.join(root, 'lib/commands.js')).href);
const { registry, categories, countAliases, countCommands } = await import(pathToFileURL(path.join(root, 'lib/registry.js')).href);

const result = await loadCommands();
const showList = process.argv.includes('--list');

console.log('\n📦 Per file');
for (const r of result.report) console.log(`   ${r.file.padEnd(18)} ${String(r.count).padStart(3)}`);

console.log('\n🗂  Per category');
for (const [cat, names] of [...categories.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`   ${cat.padEnd(14)} ${String(names.length).padStart(3)}`);
}

console.log(`\n✅ ${countCommands()} commands · ${countAliases()} aliases · ${categories.size} categories\n`);

if (showList) {
  for (const [cat, names] of categories) {
    console.log(`\n[${cat}]`);
    console.log(names.map((n) => `.${n}`).join('  '));
  }
}

const aliasSeen = new Map();
let collisions = 0;
for (const cmd of registry.values()) {
  for (const alias of cmd.aliases) {
    if (aliasSeen.has(alias) && aliasSeen.get(alias) !== cmd.name) {
      console.log(`⚠️  alias "${alias}" used by both ${aliasSeen.get(alias)} and ${cmd.name}`);
      collisions += 1;
    }
    aliasSeen.set(alias, cmd.name);
  }
}
if (!collisions) console.log('✅ No alias collisions.');
if (countCommands() < 300) {
  console.log('✖ Fewer than 300 commands!');
  process.exit(1);
}
