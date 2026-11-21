/**
 * IP DILSAHN - command registry
 * ------------------------------------------------------------------
 * Every command is a plain object:
 *   name, aliases[], category, description, usage, role, hidden, cooldown,
 *   run(ctx)
 * The loader (lib/commands.js) imports every file in commands/ and
 * validates the shape before registering it.
 */

const REQUIRED_ROLES = ['guest', 'user', 'premium', 'sudo', 'owner'];
const ROLE_RANK = { guest: 1, user: 2, premium: 3, sudo: 4, owner: 5 };

/** Commands live in a registry keyed by their canonical name */
export const registry = new Map();
/** name/alias -> canonical name (built after loading) */
export const lookup = new Map();
/** category -> [names] */
export const categories = new Map();

export class CommandValidationError extends Error {}

export const command = (definition) => {
  if (!definition || typeof definition !== 'object') throw new CommandValidationError('Command must be an object');
  const { name, run, description } = definition;
  if (!name || typeof name !== 'string') throw new CommandValidationError('Command is missing a name');
  if (typeof run !== 'function') throw new CommandValidationError(`Command "${name}" is missing a run() function`);
  if (!description) throw new CommandValidationError(`Command "${name}" is missing a description`);

  const normalized = {
    name: String(name).toLowerCase().trim(),
    aliases: (definition.aliases || []).map((a) => String(a).toLowerCase().trim()).filter(Boolean),
    category: definition.category || 'general',
    description,
    usage: definition.usage || '',
    example: definition.example || '',
    role: REQUIRED_ROLES.includes(definition.role) ? definition.role : 'guest',
    hidden: !!definition.hidden,
    /** only usable in groups / private chats */
    scope: definition.scope || 'any', // any | group | private
    cooldown: Number(definition.cooldown) || 0,
    run,
  };
  return normalized;
};

export const registerCommand = (cmd) => {
  if (registry.has(cmd.name)) throw new CommandValidationError(`Duplicate command name: ${cmd.name}`);
  registry.set(cmd.name, cmd);
  if (!categories.has(cmd.category)) categories.set(cmd.category, []);
  categories.get(cmd.category).push(cmd.name);
  return cmd;
};

/** Register an array and build the alias lookup table */
export const registerAll = (list) => {
  for (const cmd of list) registerCommand(cmd);

  lookup.clear();
  for (const [name, cmd] of registry) {
    lookup.set(name, name);
    for (const alias of cmd.aliases) {
      if (lookup.has(alias) && lookup.get(alias) !== name) {
        // duplicate alias -> keep the first, log a warning
        console.log(`⚠️  Alias "${alias}" already mapped to "${lookup.get(alias)}" (skipping for ${name})`);
        continue;
      }
      lookup.set(alias, name);
    }
  }

  for (const [, names] of categories) names.sort((a, b) => a.localeCompare(b));
  return { count: registry.size, aliases: lookup.size };
};

export const getCommand = (nameOrAlias = '') => {
  const key = String(nameOrAlias).toLowerCase();
  const canonical = lookup.get(key) || key;
  return registry.get(canonical);
};

export const resolveName = (nameOrAlias = '') => lookup.get(String(nameOrAlias).toLowerCase()) || null;

export const allCommands = () => [...registry.values()];

export const commandsByCategory = () => {
  const out = {};
  for (const [category, names] of categories) {
    out[category] = names.map((n) => registry.get(n)).filter(Boolean);
  }
  return out;
};

export const countCommands = () => registry.size;

export const countAliases = () => {
  let n = 0;
  for (const cmd of registry.values()) n += cmd.aliases.length;
  return n;
};

export const roleAllowed = (userRole, requiredRole) =>
  (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[requiredRole] || 0);

export const CATEGORY_META = {
  general: { emoji: '🏠', title: 'General' },
  users: { emoji: '👥', title: 'Users & Access' },
  download: { emoji: '📥', title: 'Downloaders' },
  media: { emoji: '🎨', title: 'Media & Stickers' },
  tools: { emoji: '🧰', title: 'Tools & Info' },
  group: { emoji: '👨‍👩‍👧‍👦', title: 'Group Management' },
  admin: { emoji: '🛡️', title: 'Bot Admin' },
  fun: { emoji: '🎲', title: 'Fun & Games' },
  text: { emoji: '🔤', title: 'Text Tools' },
  status: { emoji: '📊', title: 'Status & Stats' },
  anime: { emoji: '🌸', title: 'Anime & Cute' },
  converter: { emoji: '🔄', title: 'Converters' },
};
