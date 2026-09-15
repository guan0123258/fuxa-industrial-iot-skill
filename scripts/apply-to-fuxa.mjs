#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, requireArg, envArg, boolArg } from './lib/args.mjs';
import { readJson, writeJson } from './lib/io.mjs';
import { FuxaClient } from './lib/fuxa-client.mjs';

const args = parseArgs();
const patchFile = requireArg(args, 'patch');
const patch = await readJson(patchFile);
if (!patch.cmd) throw new Error('Patch must contain cmd.');
if (!('data' in patch)) throw new Error('Patch must contain data.');

const client = new FuxaClient({
  baseUrl: requireArg(args, 'url'),
  apiKey: envArg(args, 'api-key', 'api-key-env'),
  username: envArg(args, 'username', 'username-env'),
  password: envArg(args, 'password', 'password-env'),
  insecure: boolArg(args, 'insecure', false),
  timeoutMs: Number(args['timeout-ms'] || 10000)
});

const apply = boolArg(args, 'apply', false);
console.log(`Patch command: ${patch.cmd}`);
console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
console.log(JSON.stringify({ cmd: patch.cmd, data: patch.data }, null, 2));

if (!apply) {
  console.log('No FUXA mutation performed. Re-run with --apply after reviewing this patch against the target project inspection.');
  process.exit(0);
}

await client.signInIfNeeded();
const project = await client.getProject();
const dir = args['backup-dir'] || './backups';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(dir, `fuxa-project-${stamp}.json`);
await writeJson(backup, project);
console.log(`Backup saved: ${path.resolve(backup)}`);
await client.projectData(patch.cmd, patch.data);
console.log('FUXA project patch applied successfully.');
