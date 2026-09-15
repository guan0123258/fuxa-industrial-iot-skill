const RULES = [
  { semanticType: 'temperature', units: ['°c', '℃', 'celsius', 'degc'], names: [/温度|排温|水温|油温|temperature|temp/i], display: ['thermometer', 'trend'] },
  { semanticType: 'pressure', units: ['bar', 'kpa', 'mpa', 'pa', 'mbar'], names: [/压力|压强|pressure|press/i], display: ['pressure-gauge', 'trend'] },
  { semanticType: 'rpm', units: ['rpm', 'r/min', 'rev/min'], names: [/转速|转\/分|rotation|rpm|speed\s*rev/i], display: ['rpm-gauge', 'trend'] },
  { semanticType: 'current', units: ['a', 'amp', 'amps'], names: [/电流|current|ampere/i], display: ['gauge', 'trend'] },
  { semanticType: 'voltage', units: ['v', 'kv', 'mv'], names: [/电压|voltage/i], display: ['gauge', 'trend'] },
  { semanticType: 'power', units: ['w', 'kw', 'mw'], names: [/功率|power/i], display: ['kpi', 'trend'] },
  { semanticType: 'energy', units: ['wh', 'kwh', 'mwh'], names: [/电量|能耗|能量|energy|consumption/i], display: ['kpi', 'trend'] },
  { semanticType: 'frequency', units: ['hz'], names: [/频率|frequency/i], display: ['gauge', 'trend'] },
  { semanticType: 'flow', units: ['m³/h', 'm3/h', 'l/min', 'l/s'], names: [/流量|flow/i], display: ['kpi', 'trend'] },
  { semanticType: 'level', units: ['%'], names: [/液位|料位|油位|水位|tank.*level|level/i], display: ['tank', 'trend'] },
  { semanticType: 'fuel', units: ['l', 'm³', 'm3'], names: [/燃油|油量|fuel/i], display: ['tank', 'trend'] },
  { semanticType: 'humidity', units: ['%rh'], names: [/湿度|humidity/i], display: ['gauge', 'trend'] },
  { semanticType: 'vibration', units: ['mm/s', 'm/s²', 'm/s2'], names: [/振动|vibration/i], display: ['kpi', 'trend'] },
  { semanticType: 'runtime', units: ['h', 'hr', 'hrs'], names: [/运行时间|累计时间|工时|runtime|running\s*hours/i], display: ['kpi', 'trend'] },
  { semanticType: 'heading', units: ['°', 'deg'], names: [/航向|艏向|heading|course/i], display: ['heading'] },
  { semanticType: 'draft', units: ['m'], names: [/吃水|draft/i], display: ['vessel-attitude', 'trend'] },
  { semanticType: 'trim', units: ['m', '°', 'deg'], names: [/纵倾|trim/i], display: ['vessel-attitude', 'trend'] },
  { semanticType: 'list', units: ['°', 'deg'], names: [/横倾|list angle|heel/i], display: ['vessel-attitude', 'trend'] },
  { semanticType: 'torque', units: ['nm', 'n·m'], names: [/扭矩|torque/i], display: ['gauge', 'trend'] },
  { semanticType: 'load', units: ['%'], names: [/负荷|负载|load/i], display: ['gauge', 'trend'] },
  { semanticType: 'alarm', units: [], names: [/报警|告警|alarm|fault/i], display: ['status'] },
  { semanticType: 'status', units: [], names: [/状态|运行|启停|开关|status|running|online|state/i], display: ['status'] }
];

function normalizeUnit(unit) {
  return String(unit ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function overrideFor(variable, overrides = {}) {
  return overrides.byVariableId?.[variable.id]
    || overrides.byParameterCode?.[String(variable.parameterCode ?? '')]
    || overrides.byCollectionCode?.[String(variable.collectionCode ?? '')]
    || overrides.byName?.[variable.name]
    || null;
}

function safeFallback(variable) {
  const dt = String(variable.dataType ?? '').toLowerCase();
  if (['boolean', 'bool'].includes(dt)) return { semanticType: 'status', display: ['status'], confidence: 0.45, source: 'datatype-fallback' };
  if (['number', 'float', 'double', 'int', 'integer', 'long'].includes(dt)) return { semanticType: 'generic-number', display: ['kpi', 'trend'], confidence: 0.35, source: 'datatype-fallback' };
  return { semanticType: 'text', display: ['text'], confidence: 0.35, source: 'datatype-fallback' };
}

export function classifyVariable(variable, overrides = {}) {
  const result = { ...variable };

  if (variable.semanticType) {
    result.semanticType = variable.semanticType;
    result.display = Array.isArray(variable.display) && variable.display.length ? variable.display : defaultDisplay(variable.semanticType, variable.dataType);
    result.semanticConfidence = 1;
    result.semanticSource = 'explicit';
    result.needsReview = false;
    result.writable = variable.writable === true;
    return result;
  }

  const ov = overrideFor(variable, overrides);
  if (ov?.semanticType) {
    result.semanticType = ov.semanticType;
    result.display = variable.display?.length ? variable.display : (ov.display?.length ? ov.display : defaultDisplay(ov.semanticType, variable.dataType));
    result.semanticConfidence = Number(ov.confidence ?? 0.95);
    result.semanticSource = 'operator-override';
    result.needsReview = result.semanticConfidence < 0.7;
    result.writable = variable.writable === true;
    return result;
  }

  const unit = normalizeUnit(variable.unit);
  const name = `${variable.name ?? ''} ${variable.id ?? ''} ${variable.parameterCode ?? ''}`;
  let best = null;
  for (const rule of RULES) {
    const unitHit = unit && rule.units.map(normalizeUnit).includes(unit);
    const nameHit = rule.names.some((r) => r.test(name));
    if (!unitHit && !nameHit) continue;
    const confidence = unitHit && nameHit ? 0.92 : unitHit ? 0.78 : 0.72;
    if (!best || confidence > best.confidence) best = { rule, confidence, source: unitHit && nameHit ? 'unit+name' : unitHit ? 'unit' : 'name' };
  }

  const inferred = best
    ? { semanticType: best.rule.semanticType, display: best.rule.display, confidence: best.confidence, source: best.source }
    : safeFallback(variable);

  result.semanticType = inferred.semanticType;
  result.display = variable.display?.length ? variable.display : inferred.display;
  result.semanticConfidence = inferred.confidence;
  result.semanticSource = inferred.source;
  result.needsReview = inferred.confidence < 0.7;
  result.writable = variable.writable === true; // Never inferred.
  return result;
}

export function classifyManifest(manifest, overrides = {}) {
  const variables = Array.isArray(manifest) ? manifest : (manifest.variables || []);
  return {
    ...(Array.isArray(manifest) ? {} : manifest),
    variables: variables.map((v) => classifyVariable(v, overrides))
  };
}

export function defaultDisplay(semanticType, dataType) {
  const rule = RULES.find((r) => r.semanticType === semanticType);
  if (rule) return rule.display;
  return safeFallback({ dataType }).display;
}
