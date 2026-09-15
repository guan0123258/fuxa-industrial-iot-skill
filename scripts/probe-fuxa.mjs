#!/usr/bin/env node
import { parseArgs, requireArg, envArg, boolArg } from './lib/args.mjs';
import { writeJson } from './lib/io.mjs';
import { FuxaClient } from './lib/fuxa-client.mjs';
import { parseSemver, compareSemver } from './lib/semver.mjs';

const args = parseArgs();
const url = requireArg(args, 'url');
const client = new FuxaClient({
  baseUrl: url,
  apiKey: envArg(args, 'api-key', 'api-key-env'),
  username: envArg(args, 'username', 'username-env'),
  password: envArg(args, 'password', 'password-env'),
  insecure: boolArg(args, 'insecure', false),
  timeoutMs: Number(args['timeout-ms'] || 10000)
});

const report = {
  schema: 'industrial-fuxa-capability-report/v1',
  target: url,
  checkedAt: new Date().toISOString(),
  tlsVerification: !client.insecure,
  version: null,
  releaseAnchor: null,
  endpoints: {},
  notes: []
};

try {
  report.version = await client.getVersion();
  const parsed = parseSemver(report.version);
  if (parsed) {
    const vs134 = compareSemver(parsed, '1.3.4');
    report.releaseAnchor = parsed.raw;
    if (vs134 > 0) report.notes.push('Target is newer than the last verified public release anchor (1.3.4); use capability/project-shape detection before mutation.');
    if (compareSemver(parsed, '1.2.8') < 0) report.notes.push('Target predates the API-key/OpenAPI era used as a compatibility anchor; expect reduced automation capability.');
  }
} catch (error) {
  report.notes.push(`Version probe failed: ${error.message}`);
}

const probes = [
  ['/api/settings', 'settings'],
  ['/api/project', 'project'],
  ['/api/projectdemo', 'projectdemo']
];
for (const [p, key] of probes) report.endpoints[key] = await client.probe(p);

// Non-mutating existence probes for tag/resource paths where GET is meaningful.
report.endpoints.getTagValue = await client.probe('/api/getTagValue?ids=%5B%22__industrial_fuxa_probe__%22%5D');
report.endpoints.widgetsResource = await client.probe('/api/resources/widgets');

const safe = JSON.parse(JSON.stringify(report));
if (args.out) await writeJson(args.out, safe);
console.log(JSON.stringify(safe, null, 2));
