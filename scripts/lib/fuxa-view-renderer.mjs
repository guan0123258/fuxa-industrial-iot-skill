/**
 * FUXA view renderer.
 *
 * Turns a dashboard plan + classified manifest into a real FUXA view patch:
 * native, data-bound view items (`svg-ext-*`) plus the matching `svgcontent`
 * markup, and chart definitions for trend widgets.
 *
 * Why this module exists
 * ----------------------
 * The SVG produced by `svg-renderer.mjs` is an *intent preview* for a human.
 * It must never be the thing that ships into FUXA: a preview is a static
 * picture, so every value on screen stays frozen at whatever sample value the
 * generator happened to draw, and operators end up reading a drawing instead of
 * the plant. That failure mode — a number that never moves, or a static
 * "sticker" where a gauge should be — is what this module removes.
 *
 * This module is the shipping path. Every widget that carries a variable is
 * emitted as a native FUXA element that FUXA itself updates at runtime:
 *
 *   gauge / rpm-gauge / pressure-gauge  -> svg-ext-html_bag (type 0, circular)
 *   thermometer / tank / progress       -> svg-ext-gauge_progress (track + fill)
 *   kpi / status / traffic-light        -> svg-ext-value (with range colours)
 *   writable boolean                    -> svg-ext-html_switch
 *   trend / multi-trend                 -> svg-ext-html_chart + chart definition
 *   equipment-matrix                    -> one svg-ext-value per row
 *
 * A circular gauge uses FUXA's canvas gauge: the coloured arc is the value and
 * the grey `strokeColor` arc is the remaining range, drawn on the same circle so
 * the two overlap instead of sitting side by side.
 */

const PALETTE = ['#4aa8ff', '#36d6c0', '#9a86ff', '#ffb34d', '#ff7285', '#50d890', '#5e9fe6', '#c782e8'];

const THEME = {
  panel: '#101b28',
  panelStroke: '#26394c',
  track: '#213d52',
  on: '#51d88a',
  off: '#7e8c98'
};

export const ANALOG_WIDGET_TYPES = ['gauge', 'rpm-gauge', 'pressure-gauge'];
export const BAR_WIDGET_TYPES = ['thermometer', 'tank', 'progress'];
export const VALUE_WIDGET_TYPES = ['kpi', 'status', 'traffic-light', 'sparkline', 'donut', 'bar', 'horizontal-bar'];
export const TREND_WIDGET_TYPES = ['trend', 'multi-trend', 'area'];
export const MATRIX_WIDGET_TYPES = ['equipment-matrix', 'status-grid'];

/** Widgets that intentionally carry no tag binding and must stay non-value decor. */
export const DECORATIVE_WIDGET_TYPES = ['alarm-list', 'process-mimic', 'map', 'image-mimic', 'table'];

export const WIDGET_FAMILIES = {
  gauge: ANALOG_WIDGET_TYPES,
  bar: BAR_WIDGET_TYPES,
  trend: TREND_WIDGET_TYPES,
  matrix: MATRIX_WIDGET_TYPES,
  value: VALUE_WIDGET_TYPES
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function round(n) { return Math.round(Number(n) || 0); }

function safeKey(raw, fallback = 'w') {
  const cleaned = String(raw ?? '').replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rangeOf(widget, variable) {
  const source = widget?.engineeringRange || variable?.engineeringRange || null;
  const min = finite(source?.min, 0);
  const maxCandidate = finite(source?.max, min + 100);
  return { min, max: maxCandidate > min ? maxCandidate : min + 100 };
}

function unitOf(widget, variable) {
  return String(widget?.unit ?? variable?.unit ?? '').trim();
}

function panelMarkup(rect) {
  return `<rect id="svg_panel_${rect.key}" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="14" fill="${THEME.panel}" stroke="${THEME.panelStroke}"/>`;
}

function titleMarkup(rect, title) {
  return `<text x="${rect.x + 18}" y="${rect.y + 28}" fill="#aebdca" font-size="15" font-family="PingFang SC">${esc(title)}</text>`;
}

function valueElement(keyPart, name, x, y, fontSize, textAnchor = 'middle') {
  const id = `VAL_${keyPart}`;
  return {
    id,
    svg: `<g id="${id}" data-name="${esc(name)}" type="svg-ext-value" text-anchor="${textAnchor}" ` +
      `font-family="PingFang SC" stroke-width="0" stroke="#f5f9fc" fill="#f5f9fc">` +
      `<text id="TXT_${keyPart}" x="${x}" y="${y}" fill="#f5f9fc" stroke-width="0" font-size="${fontSize}" ` +
      `font-weight="650" text-anchor="${textAnchor}">--</text></g>`
  };
}

function valueItem({ id, name, variable, deviceName, ranges }) {
  return {
    id,
    type: 'svg-ext-value',
    name,
    property: {
      events: [],
      variable,
      variableId: variable,
      variableSrc: deviceName,
      alarmId: '',
      alarmSrc: '',
      alarm: '',
      alarmColor: '',
      ranges
    },
    label: 'Value'
  };
}

function booleanRanges() {
  return [
    { type: 'step', min: 0, max: 0, text: '停止', color: THEME.off, stroke: '' },
    { type: 'step', min: 1, max: 1, text: '运行', color: THEME.on, stroke: '' }
  ];
}

function bagOptions({ accent, min, max }) {
  return {
    minValue: min,
    maxValue: max,
    animationSpeed: 32,
    colorStart: accent,
    colorStop: accent,
    gradientType: '',
    // The grey ring that the coloured progress arc is drawn over.
    strokeColor: THEME.track,
    pointer: { length: 0.62, strokeWidth: 0.045, iconScale: 1, color: '#eaf4fb' },
    angle: 0,
    lineWidth: 0.16,
    radiusScale: 1,
    // 0 hides the canvas gauge's own readout: the bound svg-ext-value below the
    // ring shows the same number together with its unit and range colour.
    fontSize: 0,
    fontFamily: 'PingFang SC',
    textFilePosition: 62,
    limitMax: false,
    limitMin: false,
    highDpiSupport: true,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    shadowColor: '#d5d5d5',
    fractionDigits: 0,
    ticksEnabled: false,
    renderTicks: { divisions: 0, divWidth: 0, divLength: 0, divColor: '#333333', subDivisions: 0, subLength: 0, subWidth: 0, subColor: '#666666' },
    staticLabelsText: '',
    staticFontSize: 0,
    staticFontColor: '#000000',
    type: 0
  };
}

/**
 * Circular gauge (`svg-ext-html_bag`, GaugeType 0).
 *
 * gauge.js derives its radius from the canvas height, so a box that is too wide
 * relative to its height clips the ring horizontally. The box is fitted to keep
 * `width >= 1.6 * height`.
 */
function circularGauge(widget, variable, accent, context) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const gaugeId = `BAG_${keyPart}`;
  const titleH = 30;
  const captionH = 30;

  let boxW = Math.max(140, round(rect.w - 28));
  let boxH = Math.max(96, round(rect.h - titleH - captionH - 8));
  if (boxW < boxH * 1.6) boxH = Math.round(boxW / 1.6);
  const boxX = round(rect.x + (rect.w - boxW) / 2);
  const boxY = round(rect.y + titleH);

  const { min, max } = rangeOf(widget, variable);
  const unit = unitOf(widget, variable);
  const valueY = boxY + boxH + 34;
  const element = valueElement(keyPart, widget.title, round(rect.x + rect.w / 2), valueY, 30);

  const svg = [
    `<g id="svg_card_${keyPart}">`,
    panelMarkup({ ...rect, key: keyPart }),
    titleMarkup(rect, widget.title),
    `<g id="${gaugeId}" type="svg-ext-html_bag" data-name="${esc(widget.title)}">`,
    `<rect id="svg_gaugebox_${keyPart}" x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" fill="none"/>`,
    `<foreignObject id="H-${gaugeId}" x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}">`,
    `<DIV xmlns="http://www.w3.org/1999/xhtml" id="D-${gaugeId}" style="width:100%;height:100%;"></DIV>`,
    `</foreignObject></g>`,
    element.svg,
    `<text x="${round(rect.x + rect.w / 2)}" y="${valueY + 18}" fill="${accent}" font-size="12" font-family="PingFang SC" text-anchor="middle">${esc(unit)}</text>`,
    `</g>`
  ].join('');

  return {
    svg,
    items: {
      [gaugeId]: {
        id: gaugeId,
        type: 'svg-ext-html_bag',
        name: widget.title,
        property: {
          events: [],
          actions: [],
          variable: widget.variableId,
          variableId: widget.variableId,
          variableSrc: context.deviceName,
          alarmId: '',
          alarmSrc: '',
          alarm: '',
          alarmColor: '',
          options: bagOptions({ accent, min, max })
        },
        label: 'HtmlBag'
      },
      [element.id]: valueItem({
        id: element.id,
        name: widget.title,
        variable: widget.variableId,
        deviceName: context.deviceName,
        ranges: [{ type: 'unit', min, max, text: unit ? ` ${unit}` : '' }]
      })
    },
    charts: [],
    elements: [{ widgetId: widget.id, fuxaType: 'svg-ext-html_bag', variableIds: [widget.variableId], id: gaugeId }]
  };
}

/**
 * Bar gauge (`svg-ext-gauge_progress`): a track rectangle plus a fill rectangle
 * that FUXA grows from the bottom. Used for the thermometer, tank level and
 * generic progress intents, which read as vertical bars.
 */
function barGauge(widget, variable, accent, context) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const gaugeId = `GXP_${keyPart}`;
  const titleH = 30;
  const barW = Math.max(22, round(Math.min(40, rect.w * 0.12)));
  const barX = round(rect.x + 28);
  const barY = round(rect.y + titleH + 16);
  const barH = Math.max(60, round(rect.h - titleH - 44));
  const { min, max } = rangeOf(widget, variable);
  const unit = unitOf(widget, variable);
  const textX = round(rect.x + rect.w * 0.66);
  const textY = round(rect.y + rect.h * 0.58);

  const svg = [
    `<g id="svg_card_${keyPart}">`,
    panelMarkup({ ...rect, key: keyPart }),
    titleMarkup(rect, widget.title),
    `<g id="${gaugeId}" type="svg-ext-gauge_progress">`,
    // Track (A-): the grey background bar. FUXA keeps its geometry as the scale.
    `<rect id="A-${gaugeId}" x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="10" fill="#172738" stroke="#51687c"/>`,
    // Fill (B-): starts empty at the bottom of the track and grows upward.
    `<rect id="B-${gaugeId}" x="${barX}" y="${barY + barH}" width="${barW}" height="0" rx="10" fill="${accent}"/>`,
    `<foreignObject id="H-${gaugeId}" x="${barX}" y="${barY}" width="${barW}" height="${barH}">`,
    `<DIV xmlns="http://www.w3.org/1999/xhtml" id="D-${gaugeId}" style="width:100%;height:100%;"></DIV>`,
    `</foreignObject></g>`,
    `<text id="V-${gaugeId}" x="${textX}" y="${textY}" fill="#f5f9fc" font-size="30" font-weight="650" font-family="PingFang SC" text-anchor="middle">--</text>`,
    `<text x="${textX}" y="${textY + 24}" fill="${accent}" font-size="13" font-family="PingFang SC" text-anchor="middle">${esc(unit)}</text>`,
    `</g>`
  ].join('');

  return {
    svg,
    items: {
      [gaugeId]: {
        id: gaugeId,
        type: 'svg-ext-gauge_progress',
        name: widget.title,
        property: {
          events: [],
          actions: [],
          variable: widget.variableId,
          variableId: widget.variableId,
          variableSrc: context.deviceName,
          alarmId: '',
          alarmSrc: '',
          alarm: '',
          alarmColor: '',
          ranges: [{ type: 'minmax', min, max, style: [false, true], color: accent, stroke: '' }]
        },
        label: 'HtmlProgress'
      }
    },
    charts: [],
    elements: [{ widgetId: widget.id, fuxaType: 'svg-ext-gauge_progress', variableIds: [widget.variableId], id: gaugeId }]
  };
}

function valueWidget(widget, variable, accent, context) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const isBoolean = variable?.dataType === 'boolean' || ['status', 'traffic-light'].includes(widget.type);
  const unit = unitOf(widget, variable);
  const { min, max } = rangeOf(widget, variable);
  const textY = round(rect.y + rect.h * (isBoolean ? 0.68 : 0.62));
  const element = valueElement(keyPart, widget.title, round(rect.x + rect.w / 2), textY, isBoolean ? 26 : 36);

  const svg = [
    `<g id="svg_card_${keyPart}">`,
    panelMarkup({ ...rect, key: keyPart }),
    titleMarkup(rect, widget.title),
    element.svg,
    isBoolean
      ? ''
      : `<text x="${round(rect.x + rect.w / 2)}" y="${textY + 24}" fill="#7f97aa" font-size="13" font-family="PingFang SC" text-anchor="middle">${esc(unit)}</text>`,
    `</g>`
  ].join('');

  return {
    svg,
    items: {
      [element.id]: valueItem({
        id: element.id,
        name: widget.title,
        variable: widget.variableId,
        deviceName: context.deviceName,
        ranges: isBoolean ? booleanRanges() : [{ type: 'unit', min, max, text: unit ? ` ${unit}` : '', color: accent, stroke: '' }]
      })
    },
    charts: [],
    elements: [{ widgetId: widget.id, fuxaType: 'svg-ext-value', variableIds: [widget.variableId], id: element.id }]
  };
}

/**
 * Writable boolean control (`svg-ext-html_switch`).
 *
 * Only reachable when the variable was explicitly declared writable AND its
 * semantics were reviewed; write permission is never inferred.
 */
function switchWidget(widget, context) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const switchId = `HXT_${keyPart}`;
  const swH = 44;
  const swW = Math.max(140, round(rect.w - 36));
  const swX = round(rect.x + 18);
  const swY = round(rect.y + rect.h - swH - 22);

  const svg = [
    `<g id="svg_card_${keyPart}">`,
    panelMarkup({ ...rect, key: keyPart }),
    titleMarkup(rect, widget.title),
    `<g id="${switchId}" type="svg-ext-html_switch" data-name="${esc(widget.title)}">`,
    `<rect id="svg_switchbg_${keyPart}" x="${swX}" y="${swY}" width="${swW}" height="${swH}" rx="22" fill="#26394c"/>`,
    `<foreignObject id="H-${switchId}" x="${swX}" y="${swY}" width="${swW}" height="${swH}">`,
    `<DIV xmlns="http://www.w3.org/1999/xhtml" id="T-${switchId}" style="width:100%;height:100%;"></DIV>`,
    `</foreignObject></g>`,
    `</g>`
  ].join('');

  return {
    svg,
    items: {
      [switchId]: {
        id: switchId,
        type: 'svg-ext-html_switch',
        name: widget.title,
        property: {
          events: [],
          variable: widget.variableId,
          variableId: widget.variableId,
          variableSrc: context.deviceName,
          alarmId: '',
          alarmSrc: '',
          alarm: '',
          alarmColor: '',
          options: {
            offValue: 0,
            onValue: 1,
            offBackground: '#26394c',
            onBackground: '#19b979',
            offText: '停止',
            onText: '运行',
            offSliderColor: '#fff',
            onSliderColor: '#fff',
            offTextColor: '#b9c8d6',
            onTextColor: '#fff',
            fontSize: 13,
            fontFamily: 'PingFang SC',
            radius: 22
          }
        },
        label: 'HtmlSwitch'
      }
    },
    charts: [],
    elements: [{ widgetId: widget.id, fuxaType: 'svg-ext-html_switch', variableIds: [widget.variableId], id: switchId }]
  };
}

/**
 * Trend widget (`svg-ext-html_chart`).
 *
 * The element only carries the chart id; the series live in the FUXA `charts`
 * collection, which is what binds each line to a device tag.
 */
function trendWidget(widget, varsById, context) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const chartId = `chart-${context.chartPrefix}-${keyPart}`;
  const chartElementId = `HXC_${keyPart}`;
  const boxX = round(rect.x + 16);
  const boxY = round(rect.y + 42);
  const boxW = Math.max(120, round(rect.w - 32));
  const boxH = Math.max(80, round(rect.h - 58));
  const variableIds = (widget.variableIds || []).filter(Boolean);

  const svg = [
    `<g id="svg_card_${keyPart}">`,
    panelMarkup({ ...rect, key: keyPart }),
    titleMarkup(rect, widget.title),
    `<g id="${chartElementId}" type="svg-ext-html_chart" data-name="${esc(widget.title)}">`,
    `<rect id="svg_chartbox_${keyPart}" x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="12" fill="#0a1b2b"/>`,
    `<foreignObject id="H-${chartElementId}" x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}">`,
    `<DIV xmlns="http://www.w3.org/1999/xhtml" id="D-${chartElementId}" style="width:100%;height:100%;"></DIV>`,
    `</foreignObject></g>`,
    `</g>`
  ].join('');

  const items = {
    [chartElementId]: {
      id: chartElementId,
      type: 'svg-ext-html_chart',
      name: widget.title,
      property: {
        id: chartId,
        type: 'realtime1',
        options: {
          realtime: finite(widget.history?.windowMinutes, 120),
          loadOldValues: true,
          colorBackground: 'rgba(0,0,0,0)',
          legendBackground: 'rgba(0,0,0,0)',
          axisLineColor: '#52718a',
          axisLabelColor: '#8fa8bc',
          gridLineColor: '#1e405b',
          fontFamily: 'PingFang SC',
          titleHeight: 0,
          axisLabelFontSize: 12,
          legendFontSize: 12,
          legendMode: 'bottom',
          decimalsPrecision: 0,
          staticChart: false,
          mouseWheelScroll: false,
          mouseWheelZoom: false
        }
      },
      label: 'HtmlChart'
    }
  };

  const charts = variableIds.length
    ? [{
        id: chartId,
        name: `${context.viewName} · ${widget.title}`,
        lines: variableIds.map((id, index) => ({
          id,
          name: varsById[id]?.name || id,
          device: context.deviceId,
          color: varsById[id]?.color || PALETTE[index % PALETTE.length]
        }))
      }]
    : [];

  return {
    svg,
    items,
    charts,
    elements: [{ widgetId: widget.id, fuxaType: 'svg-ext-html_chart', variableIds, id: chartElementId, chartId }],
    warnings: variableIds.length ? [] : [`trend widget ${widget.id} has no variables; no chart definition was emitted`]
  };
}

/**
 * Equipment/status matrix: one bound value element per row, so every cell an
 * operator reads is a real tag reading instead of a decorative dot.
 */
function matrixWidget(widget, varsById, accent, context) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const ids = (widget.variableIds || []).filter(Boolean).slice(0, 10);
  const rowH = Math.max(30, Math.min(46, (rect.h - 48) / Math.max(1, ids.length)));
  const svgParts = [`<g id="svg_card_${keyPart}">`, panelMarkup({ ...rect, key: keyPart }), titleMarkup(rect, widget.title)];
  const items = {};
  const elements = [];

  ids.forEach((id, index) => {
    const variable = varsById[id];
    const rowY = round(rect.y + 44 + index * rowH);
    const isBoolean = variable?.dataType === 'boolean';
    const { min, max } = rangeOf({}, variable);
    const element = valueElement(`${keyPart}-${safeKey(id)}`, variable?.name || id, round(rect.x + rect.w - 16), rowY + 20, 14, 'end');
    svgParts.push(
      `<line x1="${rect.x + 16}" y1="${round(rowY + rowH - 4)}" x2="${round(rect.x + rect.w - 16)}" y2="${round(rowY + rowH - 4)}" stroke="#1f3142"/>`,
      `<text x="${rect.x + 20}" y="${rowY + 20}" fill="#c7d5df" font-size="13" font-family="PingFang SC">${esc(variable?.name || id)}</text>`,
      element.svg
    );
    items[element.id] = valueItem({
      id: element.id,
      name: variable?.name || id,
      variable: id,
      deviceName: context.deviceName,
      ranges: isBoolean
        ? booleanRanges()
        : [{ type: 'unit', min, max, text: variable?.unit ? ` ${variable.unit}` : '', color: accent, stroke: '' }]
    });
    elements.push({ widgetId: widget.id, fuxaType: 'svg-ext-value', variableIds: [id], id: element.id });
  });

  svgParts.push('</g>');
  return { svg: svgParts.join(''), items, charts: [], elements, warnings: [] };
}

function decorativeWidget(widget) {
  const rect = widget.rect;
  const keyPart = safeKey(widget.id);
  const rows = (widget.items || ['需要接入真实数据源后才能显示实时内容']).slice(0, 4);
  const rowH = Math.max(26, Math.min(40, (rect.h - 48) / rows.length));
  const body = rows.map((row, index) => {
    const y = round(rect.y + 46 + index * rowH);
    return `<circle cx="${rect.x + 26}" cy="${y}" r="5" fill="${THEME.track}"/>` +
      `<text x="${rect.x + 42}" y="${y + 4}" fill="#c7d5df" font-size="13" font-family="PingFang SC">${esc(row)}</text>`;
  }).join('');
  return {
    svg: `<g id="svg_card_${keyPart}">${panelMarkup({ ...rect, key: keyPart })}${titleMarkup(rect, widget.title)}${body}</g>`,
    items: {},
    charts: [],
    elements: [],
    warnings: [`widget ${widget.id} (${widget.type}) is decorative and carries no tag binding; never present it as live data`]
  };
}

export function renderFuxaView({ plan, classified, context = {} }) {
  const deviceName = context.deviceName || classified?.device?.name || '';
  const deviceId = context.deviceId || classified?.device?.id || '';
  const viewId = context.viewId || `view-${safeKey(plan.title)}`;
  const viewName = context.viewName || plan.title || 'Dashboard';
  const width = finite(plan.size?.width, 1920);
  const height = finite(plan.size?.height, 1080);
  const vars = classified?.variables || [];
  const varsById = Object.fromEntries(vars.map((v) => [v.id, v]));
  const accentFor = (variableId) => PALETTE[Math.max(0, vars.findIndex((v) => v.id === variableId)) % PALETTE.length];
  const widgetContext = { deviceName, deviceId, viewName, chartPrefix: safeKey(viewId) };

  const items = {};
  const charts = [];
  const elements = [];
  const warnings = [];
  const body = [];

  (plan.widgets || []).forEach((widget) => {
    const variable = varsById[widget.variableId];
    const accent = accentFor(widget.variableId);
    let rendered;

    if (WIDGET_FAMILIES.gauge.includes(widget.type)) {
      rendered = circularGauge(widget, variable, accent, widgetContext);
    } else if (WIDGET_FAMILIES.bar.includes(widget.type)) {
      rendered = barGauge(widget, variable, accent, widgetContext);
    } else if (widget.writable === true && (widget.type === 'switch' || widget.type === 'toggle' || variable?.dataType === 'boolean')) {
      rendered = switchWidget(widget, widgetContext);
    } else if (WIDGET_FAMILIES.trend.includes(widget.type)) {
      rendered = trendWidget(widget, varsById, widgetContext);
    } else if (WIDGET_FAMILIES.matrix.includes(widget.type)) {
      rendered = matrixWidget(widget, varsById, accent, widgetContext);
    } else if (widget.variableId) {
      rendered = valueWidget(widget, variable, accent, widgetContext);
    } else {
      rendered = decorativeWidget(widget);
    }

    body.push(rendered.svg);
    Object.assign(items, rendered.items || {});
    charts.push(...(rendered.charts || []));
    elements.push(...(rendered.elements || []));
    warnings.push(...(rendered.warnings || []));
  });

  const svgcontent =
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:html="http://www.w3.org/1999/xhtml">` +
    `<defs><linearGradient id="pageBg" x1="0" y1="0" x2="0" y2="${height}" gradientUnits="userSpaceOnUse">` +
    `<stop stop-color="#07121d"/><stop offset="1" stop-color="#050c14"/></linearGradient></defs>` +
    `<g><title>Layer 1</title>` +
    `<rect width="${width}" height="${height}" fill="url(#pageBg)"/>` +
    `<text x="40" y="52" fill="#edf7ff" font-size="27" font-weight="650" font-family="PingFang SC">${esc(plan.title)}</text>` +
    `<text x="40" y="78" fill="#7f97aa" font-size="14" font-family="PingFang SC">${esc(plan.subtitle || '')}</text>` +
    body.join('') +
    `</g></svg>`;

  const view = {
    id: viewId,
    name: viewName,
    profile: { width, height, bkcolor: '#07121dff', margin: 0, align: 'topCenter', gridType: 'fixed', viewRenderDelay: 0 },
    items,
    variables: {},
    svgcontent,
    type: 'svg'
  };

  const boundWidgetIds = new Set(elements.map((element) => element.widgetId));
  return {
    view,
    charts,
    elements,
    warnings,
    stats: {
      widgets: (plan.widgets || []).length,
      boundElements: elements.length,
      boundWidgets: boundWidgetIds.size,
      decorativeWidgets: (plan.widgets || []).filter((w) => !boundWidgetIds.has(w.id)).length,
      chartDefinitions: charts.length
    }
  };
}

/**
 * Validate a rendered view before it is applied.
 *
 * The hard rule: a widget that carries a variable must produce at least one
 * native FUXA element bound to that variable. A rendered-but-unbound value is a
 * static picture — exactly the failure this module exists to prevent.
 */
export function validateFuxaView({ view, charts = [], plan }) {
  const errors = [];
  const warnings = [];
  const items = view?.items || {};
  const svg = view?.svgcontent || '';
  const elements = Object.values(items);
  const boundVariables = new Set();
  for (const item of elements) {
    const property = item.property || {};
    const bound = property.variableId || property.variable;
    if (bound) boundVariables.add(bound);
    for (const id of property.variableIds || []) boundVariables.add(id);
  }

  if (!svg.includes('<svg')) errors.push('view.svgcontent is not an SVG document.');
  if (!elements.length) errors.push('view has no items; nothing would be bound at runtime.');

  for (const widget of plan?.widgets || []) {
    const ids = [widget.variableId, ...(widget.variableIds || [])].filter(Boolean);
    const decorative = DECORATIVE_WIDGET_TYPES.includes(widget.type);
    if (!ids.length) {
      if (!decorative) warnings.push(`widget ${widget.id} (${widget.type}) has no variable and was rendered as decoration.`);
      continue;
    }
    if (decorative) {
      warnings.push(`widget ${widget.id} (${widget.type}) is a decorative intent; its variables are not bound.`);
      continue;
    }
    const missing = ids.filter((id) => !boundVariables.has(id));
    if (missing.length) {
      errors.push(`widget ${widget.id} (${widget.type}) would ship as a static picture: no FUXA item is bound to ${missing.join(', ')}.`);
    }
  }

  for (const item of elements) {
    if (item.type === 'svg-ext-html_bag') {
      if (!svg.includes(`id="D-${item.id}"`)) errors.push(`gauge ${item.id} has no D-${item.id} container; the canvas gauge cannot mount.`);
      const options = item.property?.options;
      if (!options || options.minValue === undefined || options.maxValue === undefined) {
        errors.push(`gauge ${item.id} is missing minValue/maxValue; the arc would not map to the range.`);
      }
      if (!options?.colorStart) errors.push(`gauge ${item.id} has no colorStart; the progress arc would be invisible.`);
      if (!options?.strokeColor) warnings.push(`gauge ${item.id} has no strokeColor; the grey background ring would be missing.`);
    }
    if (item.type === 'svg-ext-gauge_progress' && !svg.includes(`id="B-${item.id}"`)) {
      errors.push(`progress gauge ${item.id} has no B-${item.id} fill rectangle.`);
    }
    if (item.type === 'svg-ext-html_switch' && !svg.includes(`id="T-${item.id}"`)) {
      errors.push(`switch ${item.id} has no T-${item.id} container; the control cannot mount.`);
    }
    if (item.type === 'svg-ext-html_chart' && !svg.includes(`id="D-${item.id}"`)) {
      errors.push(`chart ${item.id} has no D-${item.id} container; the chart cannot mount.`);
    }
  }

  const chartDefs = new Set((charts || []).map((chart) => chart.id));
  for (const item of elements) {
    if (item.type !== 'svg-ext-html_chart') continue;
    const chartId = item.property?.id;
    if (!chartId || !chartDefs.has(chartId)) errors.push(`chart ${item.id} references missing chart definition ${chartId}.`);
  }

  const ids = elements.map((item) => item.id);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) errors.push(`duplicate FUXA item ids: ${duplicates.join(', ')}`);

  return { errors, warnings, stats: { items: elements.length, boundVariables: boundVariables.size, charts: (charts || []).length } };
}
