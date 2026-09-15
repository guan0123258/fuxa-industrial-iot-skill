import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './io.mjs';
import { classifyManifest } from './variable-classifier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export async function loadPreset(name = 'production-overview') {
  const file = path.join(ROOT, 'templates', 'dashboard-presets', `${name}.json`);
  return readJson(file);
}

function pickPrimaryDisplay(v) {
  const d = Array.isArray(v.display) ? v.display : [];
  return d.find((x) => x !== 'trend') || d[0] || 'kpi';
}

function safeId(raw) {
  return String(raw).replace(/[^a-zA-Z0-9_.-]+/g, '-');
}

function layoutGrid(zone, count, { gap = 18, minCols = 3, maxCols = 6 } = {}) {
  if (!count) return [];
  const cols = Math.min(maxCols, Math.max(minCols, Math.ceil(Math.sqrt(count * (zone.w / Math.max(zone.h, 1))))));
  const rows = Math.ceil(count / cols);
  const w = (zone.w - gap * (cols - 1)) / cols;
  const h = (zone.h - gap * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => ({
    x: zone.x + (i % cols) * (w + gap),
    y: zone.y + Math.floor(i / cols) * (h + gap),
    w,
    h
  }));
}

export async function makeDashboardPlan({ manifest, request = {}, overrides = {} }) {
  const classified = classifyManifest(manifest, overrides);
  const preset = await loadPreset(request.preset || 'production-overview');
  const width = Number(request.width || 1920);
  const height = Number(request.height || 1080);
  const scaleX = width / 1920;
  const scaleY = height / 1080;
  const zones = Object.fromEntries((preset.zones || []).map((z) => [z.id, {
    ...z,
    x: Math.round(z.x * scaleX), y: Math.round(z.y * scaleY),
    w: Math.round(z.w * scaleX), h: Math.round(z.h * scaleY)
  }]));

  const vars = classified.variables || [];
  const primary = vars.filter((v) => v.semanticType !== 'text').slice(0, 8);
  const trendVars = vars.filter((v) => (v.display || []).includes('trend')).slice(0, 8);
  const statusVars = vars.filter((v) => ['status', 'alarm'].includes(v.semanticType));

  const primaryZone = zones.primary || zones.kpis || { x: 40, y: 130, w: width - 80, h: 260 };
  const primaryBoxes = layoutGrid(primaryZone, primary.length, { minCols: Math.min(4, Math.max(1, primary.length)), maxCols: 4 });

  const widgets = primary.map((v, i) => ({
    id: `widget-${safeId(v.id)}`,
    type: pickPrimaryDisplay(v),
    variableId: v.id,
    title: v.name || v.id,
    unit: v.unit || '',
    semanticType: v.semanticType,
    confidence: v.semanticConfidence,
    needsReview: v.needsReview === true,
    engineeringRange: v.engineeringRange || null,
    thresholds: v.thresholds || null,
    writable: v.writable === true,
    rect: primaryBoxes[i]
  }));

  if (trendVars.length) {
    const z = zones.trend || { x: 40, y: 450, w: Math.round(width * 0.64), h: 400 };
    widgets.push({
      id: 'widget-key-trends', type: 'multi-trend', title: request.history?.title || '关键参数趋势',
      variableIds: trendVars.map((v) => v.id),
      history: request.history || { defaultWindow: '24h', source: 'industrial-cloud-api' },
      rect: z
    });
  }

  const statusZone = zones.status || zones.systems;
  if (statusZone) {
    widgets.push({
      id: 'widget-system-status', type: 'equipment-matrix', title: '设备 / 系统状态',
      variableIds: statusVars.length ? statusVars.map((v) => v.id) : primary.slice(0, 6).map((v) => v.id),
      rect: statusZone
    });
  }

  const alarmZone = zones.alarms || zones.footer;
  if (alarmZone) {
    widgets.push({
      id: 'widget-alarms', type: 'alarm-list', title: '报警与数据质量',
      variableIds: vars.filter((v) => v.semanticType === 'alarm').map((v) => v.id),
      rect: alarmZone
    });
  }

  if ((request.preset || '') === 'level-system' && zones.mimic) {
    widgets.push({
      id: 'widget-process-mimic', type: 'process-mimic', title: '工艺流程',
      variableIds: vars.filter((v) => ['level', 'pressure', 'status', 'flow'].includes(v.semanticType)).map((v) => v.id),
      rect: zones.mimic
    });
  }

  const plan = {
    schema: 'industrial-fuxa-dashboard-plan/v1',
    title: request.title || classified.device?.name || 'Industrial Dashboard',
    subtitle: request.subtitle || '',
    preset: preset.id,
    size: { width, height },
    theme: request.theme || 'industrial-dark',
    sourceDevice: classified.device || null,
    generatedAt: new Date().toISOString(),
    widgets,
    review: {
      lowConfidenceVariableIds: vars.filter((v) => v.needsReview).map((v) => v.id),
      writableVariableIds: vars.filter((v) => v.writable).map((v) => v.id)
    }
  };

  const bindingPlan = {
    schema: 'industrial-fuxa-binding-plan/v1',
    source: request.history?.source || 'industrial-cloud-api',
    bindings: vars.map((v) => ({
      variableId: v.id,
      sourcePath: v.source?.path || null,
      fuxaTagId: v.id,
      writable: v.writable === true,
      semanticType: v.semanticType,
      needsReview: v.needsReview === true
    }))
  };

  return { classified, plan, bindingPlan };
}
