export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      out._.push(token);
      continue;
    }
    const raw = token.slice(2);
    if (raw.startsWith('no-')) {
      out[raw.slice(3)] = false;
      continue;
    }
    const eq = raw.indexOf('=');
    if (eq >= 0) {
      out[raw.slice(0, eq)] = raw.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[raw] = next;
      i += 1;
    } else {
      out[raw] = true;
    }
  }
  return out;
}

export function requireArg(args, key, help = '') {
  const value = args[key];
  if (value === undefined || value === true || value === '') {
    throw new Error(`Missing --${key}${help ? ` (${help})` : ''}`);
  }
  return value;
}

export function envArg(args, key, envKey, fallback = undefined) {
  if (args[key] && args[key] !== true) return args[key];
  const envName = args[envKey];
  if (envName && envName !== true) return process.env[envName];
  return fallback;
}

export function boolArg(args, key, fallback = false) {
  if (!(key in args)) return fallback;
  if (typeof args[key] === 'boolean') return args[key];
  return ['1', 'true', 'yes', 'on'].includes(String(args[key]).toLowerCase());
}
