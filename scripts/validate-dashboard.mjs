#!/usr/bin/env node
import { parseArgs, requireArg } from './lib/args.mjs';
import { readJson } from './lib/io.mjs';
import { validateFuxaView } from './lib/fuxa-view-renderer.mjs';

const args = parseArgs();
const plan = await readJson(requireArg(args, 'plan'));
const errors = [];
const warnings = [];

if (plan.schema !== 'industrial-fuxa-dashboard-plan/v1') warnings.push(`Unexpected schema: ${plan.schema}`);
if (!plan.size?.width || !plan.size?.height) errors.push('Missing positive dashboard size.');
if (!Array.isArray(plan.widgets)) errors.push('widgets must be an array.');

const ids = new Set();
for (const w of plan.widgets || []) {
  if (!w.id) errors.push('Widget missing id.');
  else if (ids.has(w.id)) errors.push(`Duplicate widget id: ${w.id}`);
  else ids.add(w.id);
  if (!w.type) errors.push(`Widget ${w.id || '?'} missing type.`);
  if (!w.rect || [w.rect.x,w.rect.y,w.rect.w,w.rect.h].some((n) => !Number.isFinite(Number(n)))) errors.push(`Widget ${w.id || '?'} has invalid rect.`);
  if (w.writable === true && w.needsReview === true) errors.push(`Writable widget ${w.id} has unreviewed semantics.`);
}
for (const id of plan.review?.lowConfidenceVariableIds || []) warnings.push(`Low-confidence variable needs review: ${id}`);
for (const id of plan.review?.writableVariableIds || []) warnings.push(`Writable variable requires explicit command-path review: ${id}`);

// The generated FUXA view is what actually ships. Validate it whenever it is
// available, so a widget can never leave the pipeline as a static picture.
if (args.view) {
  const file = await readJson(args.view);
  const view = file?.data?.svgcontent ? file.data : file;
  const chartsFile = args.charts ? await readJson(args.charts) : null;
  const charts = chartsFile?.data || (Array.isArray(chartsFile) ? chartsFile : []);
  const result = validateFuxaView({ view, charts, plan });
  errors.push(...result.errors);
  warnings.push(...result.warnings);
  console.log(`FUXA view: ${result.stats.items} native element(s), ${result.stats.boundVariables} bound variable(s), ${result.stats.charts} chart definition(s).`);
} else {
  warnings.push('No --view supplied: only the plan was checked. Always validate the generated FUXA view before applying it.');
}

for (const msg of warnings) console.log(`WARN: ${msg}`);
for (const msg of errors) console.error(`ERROR: ${msg}`);
if (errors.length) process.exitCode = 2;
else console.log(`OK: ${plan.widgets?.length || 0} widgets validated (${warnings.length} warning(s)).`);

