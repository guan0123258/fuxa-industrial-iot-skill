#!/usr/bin/env node
import { parseArgs, requireArg } from './lib/args.mjs';
import { readJson, writeJson } from './lib/io.mjs';
import { requestJson } from './lib/http.mjs';
import { FuxaClient } from './lib/fuxa-client.mjs';
import { parseSemver, compareSemver } from './lib/semver.mjs';

const args = parseArgs();
const cfg = await readJson(requireArg(args, 'config'));
let latest = cfg.latestRelease?.fallbackVersion || '1.3.4';
let latestSource = 'configured-fallback';

if (cfg.latestRelease?.provider === 'github' && !args['offline']) {
  try {
    const repo = cfg.latestRelease.repo || 'frangoteam/FUXA';
    const r = await requestJson(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'User-Agent': 'fuxa-industrial-iot-skill', Accept: 'application/vnd.github+json' },
      timeoutMs: 7000
    });
    const candidate = r.data?.tag_name || r.data?.name;
    if (parseSemver(candidate)) {
      latest = parseSemver(candidate).raw;
      latestSource = 'github-releases';
    }
  } catch (error) {
    latestSource = `fallback (${error.message})`;
  }
}

const results = [];
for (const instance of cfg.instances || []) {
  const client = new FuxaClient({
    baseUrl: instance.url,
    apiKey: instance.apiKeyEnv ? process.env[instance.apiKeyEnv] : instance.apiKey,
    username: instance.usernameEnv ? process.env[instance.usernameEnv] : instance.username,
    password: instance.passwordEnv ? process.env[instance.passwordEnv] : instance.password,
    insecure: instance.insecure === true,
    timeoutMs: Number(instance.timeoutMs || 7000)
  });
  const row = { name: instance.name, url: instance.url, reachable: false, version: null, latest, status: 'unknown', capabilities: {} };
  try {
    row.version = await client.getVersion();
    row.reachable = true;
    const cmp = compareSemver(row.version, latest);
    row.status = cmp === null ? 'version-unparseable' : cmp < 0 ? 'behind-latest' : cmp === 0 ? 'latest' : 'newer-than-public-latest';
    row.capabilities.project = await client.probe('/api/project');
    row.capabilities.widgets = await client.probe('/api/resources/widgets');
  } catch (error) {
    row.error = error.message;
    row.status = 'unreachable-or-version-endpoint-failed';
  }
  results.push(row);
}

const report = {
  schema: 'industrial-fuxa-fleet-version-report/v1',
  checkedAt: new Date().toISOString(),
  latestPublicVersion: latest,
  latestVersionSource: latestSource,
  instances: results
};
if (args.out) await writeJson(args.out, report);
console.log(JSON.stringify(report, null, 2));
