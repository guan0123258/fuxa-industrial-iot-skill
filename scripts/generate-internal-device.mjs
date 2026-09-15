#!/usr/bin/env node
import { parseArgs, requireArg } from './lib/args.mjs';
import { readJson, writeJson } from './lib/io.mjs';

const args = parseArgs();
const manifest = await readJson(requireArg(args, 'variables'));
const variables = manifest.variables || manifest;
const deviceId = requireArg(args, 'device-id');
const deviceName = args['device-name'] || deviceId;

const typeMap = { boolean: 'boolean', bool: 'boolean', string: 'string', number: 'number', float: 'number', double: 'number', int: 'number', integer: 'number' };
const tags = variables.map((v) => ({
  id: v.id,
  name: v.name || v.id,
  type: typeMap[String(v.dataType || 'number').toLowerCase()] || 'number',
  init: v.sampleValue ?? (String(v.dataType).toLowerCase().includes('bool') ? false : 0),
  description: `semantic=${v.semanticType || 'unknown'}; source=${v.source?.path || 'unmapped'}; writable=${v.writable === true}`
}));

const data = {
  id: deviceId,
  name: deviceName,
  type: 'internal',
  property: {},
  tags
};
const patch = {
  schema: 'industrial-fuxa-project-patch/v1',
  cmd: 'set-device',
  data,
  reviewRequired: true,
  note: 'Internal-device shape is a proposal. Compare with the target FUXA project inspection before apply.'
};
if (args.out) await writeJson(args.out, patch);
else console.log(JSON.stringify(patch, null, 2));
