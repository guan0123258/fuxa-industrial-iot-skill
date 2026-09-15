#!/usr/bin/env node
import path from 'node:path';
import { parseArgs, requireArg } from './lib/args.mjs';
import { readJson, writeJson, writeText } from './lib/io.mjs';
import { makeDashboardPlan } from './lib/dashboard-planner.mjs';
import { renderDashboardSvg } from './lib/svg-renderer.mjs';
import { renderFuxaView, validateFuxaView } from './lib/fuxa-view-renderer.mjs';

const args = parseArgs();
const variablesFile = requireArg(args, 'variables');
const requestFile = requireArg(args, 'request');
const outDir = args['out-dir'] || './generated-dashboard';
const manifest = await readJson(variablesFile);
const request = await readJson(requestFile);
const overrides = args.overrides ? await readJson(args.overrides) : {};
const { classified, plan, bindingPlan } = await makeDashboardPlan({ manifest, request, overrides });

const context = {
  deviceId: args['device-id'] || request.device?.id || null,
  deviceName: args['device-name'] || request.device?.name || null,
  viewId: args['view-id'] || request.view?.id || null,
  viewName: args['view-name'] || request.view?.name || null
};

const rendered = renderFuxaView({ plan, classified, context });
const validation = validateFuxaView({ view: rendered.view, charts: rendered.charts, plan });

await writeJson(path.join(outDir, 'classified-variables.json'), classified);
await writeJson(path.join(outDir, 'dashboard-plan.json'), plan);
await writeJson(path.join(outDir, 'binding-plan.json'), bindingPlan);
// Preview only: a picture for human review. It is never applied to FUXA.
await writeText(path.join(outDir, 'dashboard-preview.svg'), renderDashboardSvg(plan, classified));

// The shipping artefacts: a real FUXA view whose elements are native widgets
// bound to tags, plus the chart definitions those widgets reference.
await writeJson(path.join(outDir, 'fuxa-view.patch.json'), {
  schema: 'industrial-fuxa-project-patch/v1',
  cmd: 'set-view',
  data: rendered.view,
  reviewRequired: true
});
if (rendered.charts.length) {
  await writeJson(path.join(outDir, 'fuxa-charts.patch.json'), {
    schema: 'industrial-fuxa-project-patch/v1',
    cmd: 'charts',
    data: rendered.charts,
    reviewRequired: false
  });
}

console.log(`Generated dashboard in ${path.resolve(outDir)}`);
console.log(`Preset: ${plan.preset}; widgets: ${plan.widgets.length}; needs review: ${plan.review.lowConfidenceVariableIds.length}`);
console.log(`FUXA view: ${rendered.stats.boundWidgets}/${rendered.stats.widgets} widgets bound, ` +
  `${rendered.stats.boundElements} native elements, ${rendered.stats.chartDefinitions} chart definition(s).`);
console.log(`Apply with: node scripts/apply-to-fuxa.mjs --url <fuxa> --patch ${path.join(outDir, 'fuxa-view.patch.json')}` +
  (rendered.charts.length ? ` (and fuxa-charts.patch.json)` : ''));

for (const warning of rendered.warnings) console.log(`WARN: ${warning}`);
for (const warning of validation.warnings) console.log(`WARN: ${warning}`);
for (const error of validation.errors) console.error(`ERROR: ${error}`);
if (validation.errors.length) {
  console.error('Refusing to present this view as ready: fix the errors above before applying.');
  process.exitCode = 2;
}

