#!/usr/bin/env node
import { parseArgs, requireArg, boolArg } from './lib/args.mjs';
import { readJson } from './lib/io.mjs';
import { requestJson, joinUrl } from './lib/http.mjs';
import { FuxaClient } from './lib/fuxa-client.mjs';

function getPath(obj, dotted) {
  if (!dotted) return obj;
  return String(dotted).split('.').filter(Boolean).reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function resolveHeaders(spec = {}) {
  const headers = {};
  for (const [name, value] of Object.entries(spec)) {
    if (typeof value === 'string') headers[name] = value;
    else if (value?.env) {
      const secret = process.env[value.env];
      if (!secret) throw new Error(`Missing environment variable required for header ${name}: ${value.env}`);
      headers[name] = `${value.prefix || ''}${secret}${value.suffix || ''}`;
    }
  }
  return headers;
}

function fuxaCredentials(cfg) {
  return {
    apiKey: cfg.apiKeyEnv ? process.env[cfg.apiKeyEnv] : cfg.apiKey,
    username: cfg.usernameEnv ? process.env[cfg.usernameEnv] : cfg.username,
    password: cfg.passwordEnv ? process.env[cfg.passwordEnv] : cfg.password
  };
}

const args = parseArgs();
const config = await readJson(requireArg(args, 'config'));
const cloud = config.industrialCloud || {};
const fuxaCfg = config.fuxa || {};
const dryRun = boolArg(args, 'dry-run', false);
const once = boolArg(args, 'once', false);
const interval = Number(config.pollIntervalMs || 3000);

const creds = fuxaCredentials(fuxaCfg);
const fuxa = new FuxaClient({
  baseUrl: fuxaCfg.url,
  ...creds,
  insecure: fuxaCfg.insecure === true,
  timeoutMs: Number(fuxaCfg.timeoutMs || 10000)
});

async function syncOnce() {
  const sourceUrl = joinUrl(cloud.baseUrl, cloud.snapshotEndpoint);
  const response = await requestJson(sourceUrl, {
    method: cloud.method || 'GET',
    headers: resolveHeaders(cloud.headers),
    timeoutMs: Number(cloud.timeoutMs || 10000),
    insecure: cloud.insecure === true
  });
  const root = getPath(response.data, cloud.valueRoot || '');
  const tags = [];
  const missing = [];
  for (const m of cloud.mapping || []) {
    const value = getPath(root, m.sourcePath);
    if (value === undefined) {
      missing.push(m.sourcePath);
      continue;
    }
    let normalized = value;
    if (m.scale !== undefined) normalized = Number(normalized) * Number(m.scale);
    if (m.offset !== undefined) normalized = Number(normalized) + Number(m.offset);
    tags.push({ id: m.fuxaTagId, value: normalized });
  }

  const summary = { at: new Date().toISOString(), sourceStatus: response.status, tagCount: tags.length, missing };
  if (dryRun) {
    console.log(JSON.stringify({ ...summary, tags }, null, 2));
    return;
  }
  if (!tags.length) throw new Error('No mapped values were found; refusing to send an empty tag update.');
  await fuxa.setTagValue({ tags });
  console.log(JSON.stringify(summary));
}

if (once) {
  await syncOnce();
} else {
  console.log(`Bridge started; interval=${interval}ms; mode=${dryRun ? 'dry-run' : 'write current values to FUXA tags'}`);
  let stopped = false;
  process.on('SIGINT', () => { stopped = true; });
  process.on('SIGTERM', () => { stopped = true; });
  while (!stopped) {
    try { await syncOnce(); }
    catch (error) { console.error(`[bridge] ${new Date().toISOString()} ${error.message}`); }
    await new Promise((r) => setTimeout(r, interval));
  }
}
