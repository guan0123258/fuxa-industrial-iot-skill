#!/usr/bin/env node
import { parseArgs, requireArg } from './lib/args.mjs';
import { readJson, writeJson } from './lib/io.mjs';
import { classifyManifest } from './lib/variable-classifier.mjs';

const args = parseArgs();
const input = requireArg(args, 'input', 'variable manifest JSON');
const manifest = await readJson(input);
const overrides = args.overrides ? await readJson(args.overrides) : {};
const classified = classifyManifest(manifest, overrides);
if (args.out) await writeJson(args.out, classified);
else console.log(JSON.stringify(classified, null, 2));

const review = classified.variables.filter((v) => v.needsReview);
console.error(`Classified ${classified.variables.length} variables; ${review.length} need review.`);
