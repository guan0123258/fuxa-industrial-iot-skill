#!/usr/bin/env node
import { parseArgs, requireArg, envArg, boolArg } from './lib/args.mjs';
import { writeJson } from './lib/io.mjs';
import { FuxaClient } from './lib/fuxa-client.mjs';

function arr(v) { if (Array.isArray(v)) return v; if (v && typeof v === 'object') return Object.values(v); return []; }
function summarizeObject(o) { return o && typeof o === 'object' ? Object.keys(o).sort() : []; }
function first(v) { return Array.isArray(v) && v.length ? v[0] : null; }

const args = parseArgs();
const client = new FuxaClient({
  baseUrl: requireArg(args, 'url'),
  apiKey: envArg(args, 'api-key', 'api-key-env'),
  username: envArg(args, 'username', 'username-env'),
  password: envArg(args, 'password', 'password-env'),
  insecure: boolArg(args, 'insecure', false)
});
await client.signInIfNeeded();
const project = await client.getProject();

const views = arr(project.views || project.hmi?.views || project.pages);
const devices = arr(project.devices || project.device);
const charts = arr(project.charts || project.chart);
const graphs = arr(project.graphs || project.graph);

const report = {
  schema: 'industrial-fuxa-project-inspection/v1',
  inspectedAt: new Date().toISOString(),
  topLevelKeys: summarizeObject(project),
  counts: { views: views.length, devices: devices.length, charts: charts.length, graphs: graphs.length },
  samples: {
    viewKeys: summarizeObject(first(views)),
    viewItemKeys: summarizeObject(first(first(views)?.items)),
    deviceKeys: summarizeObject(first(devices)),
    tagKeys: summarizeObject(first(first(devices)?.tags)),
    chartKeys: summarizeObject(first(charts)),
    chartLineKeys: summarizeObject(first(first(charts)?.lines)),
    graphKeys: summarizeObject(first(graphs))
  },
  warning: 'Use these live shapes as compatibility evidence. Do not log/export secrets embedded in project objects.'
};
if (args.out) await writeJson(args.out, report);
console.log(JSON.stringify(report, null, 2));
