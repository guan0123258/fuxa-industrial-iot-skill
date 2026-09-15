function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

function round(n) { return Math.round(Number(n || 0)); }

function sampleValue(variable, index = 0) {
  if (variable?.sampleValue !== undefined) return variable.sampleValue;
  if (variable?.dataType === 'boolean') return index % 2 === 0;
  const range = variable?.engineeringRange;
  if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) return range.min + (range.max - range.min) * 0.58;
  return 42 + index * 3.7;
}

function valueText(v, variable) {
  if (typeof v === 'boolean') return v ? '运行' : '停止';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v ?? '--');
}

function panel(x, y, w, h, title = '') {
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#101b28" stroke="#26394c"/>${title ? `<text x="${x + 20}" y="${y + 31}" fill="#aebdca" font-size="16">${esc(title)}</text>` : ''}</g>`;
}

function gauge(widget, variable, idx) {
  const { x, y, w, h } = widget.rect;
  const cx = x + w / 2, cy = y + h * 0.60;
  const r = Math.min(w * 0.27, h * 0.31);
  const raw = sampleValue(variable, idx);
  const min = variable?.engineeringRange?.min ?? 0;
  const max = variable?.engineeringRange?.max ?? 100;
  const ratio = Math.max(0, Math.min(1, (Number(raw) - min) / Math.max(1e-9, max - min)));
  const angle = (-135 + ratio * 270) * Math.PI / 180;
  const nx = cx + Math.cos(angle) * r * 0.78;
  const ny = cy + Math.sin(angle) * r * 0.78;
  return `${panel(x,y,w,h)}
    <text x="${x+18}" y="${y+31}" fill="#aebdca" font-size="16">${esc(widget.title)}</text>
    <path d="M ${cx-r*0.7} ${cy+r*0.7} A ${r} ${r} 0 1 1 ${cx+r*0.7} ${cy+r*0.7}" fill="none" stroke="#30465b" stroke-width="12" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="#50d2c2" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#d9e6ef"/>
    <text x="${cx}" y="${cy + r*0.72}" fill="#edf7ff" font-size="28" font-weight="700" text-anchor="middle">${esc(valueText(raw, variable))}</text>
    <text x="${cx}" y="${cy + r*0.72 + 23}" fill="#7f97aa" font-size="13" text-anchor="middle">${esc(widget.unit)}</text>`;
}

function thermometer(widget, variable, idx) {
  const { x, y, w, h } = widget.rect;
  const raw = Number(sampleValue(variable, idx));
  const min = variable?.engineeringRange?.min ?? 0;
  const max = variable?.engineeringRange?.max ?? 100;
  const ratio = Math.max(0, Math.min(1, (raw-min)/Math.max(1e-9,max-min)));
  const tubeH = Math.max(50, h - 112);
  const bx = x + 32, by = y + 58;
  const fillH = tubeH * ratio;
  return `${panel(x,y,w,h)}
    <text x="${x+18}" y="${y+31}" fill="#aebdca" font-size="16">${esc(widget.title)}</text>
    <rect x="${bx}" y="${by}" width="18" height="${tubeH}" rx="9" fill="#26394c"/>
    <rect x="${bx}" y="${by + tubeH-fillH}" width="18" height="${fillH}" rx="9" fill="#e4a75b"/>
    <circle cx="${bx+9}" cy="${by+tubeH+7}" r="16" fill="#e4a75b"/>
    <text x="${x+w*0.53}" y="${y+h*0.58}" fill="#edf7ff" font-size="32" font-weight="700" text-anchor="middle">${raw.toFixed(1)}</text>
    <text x="${x+w*0.53}" y="${y+h*0.58+25}" fill="#7f97aa" font-size="14" text-anchor="middle">${esc(widget.unit)}</text>`;
}

function kpi(widget, variable, idx) {
  const { x,y,w,h } = widget.rect;
  const raw = sampleValue(variable, idx);
  return `${panel(x,y,w,h)}
    <text x="${x+18}" y="${y+31}" fill="#aebdca" font-size="16">${esc(widget.title)}</text>
    <text x="${x+w/2}" y="${y+h*0.62}" fill="#edf7ff" font-size="36" font-weight="700" text-anchor="middle">${esc(valueText(raw, variable))}</text>
    <text x="${x+w/2}" y="${y+h*0.62+27}" fill="#7f97aa" font-size="14" text-anchor="middle">${esc(widget.unit)}</text>
    <polyline points="${Array.from({length:8},(_,i)=>`${x+18+i*(w-36)/7},${y+h-25-(Math.sin(i*1.2)+1)*10}`).join(' ')}" fill="none" stroke="#50d2c2" stroke-width="2" opacity="0.7"/>`;
}

function status(widget, variable, idx) {
  const { x,y,w,h } = widget.rect;
  const raw = Boolean(sampleValue(variable, idx));
  return `${panel(x,y,w,h)}
    <text x="${x+18}" y="${y+31}" fill="#aebdca" font-size="16">${esc(widget.title)}</text>
    <circle cx="${x+w/2}" cy="${y+h*0.53}" r="18" fill="${raw ? '#51d88a' : '#7e8c98'}"/>
    <text x="${x+w/2}" y="${y+h*0.76}" fill="#edf7ff" font-size="20" text-anchor="middle">${raw ? '运行' : '停止'}</text>`;
}

function tank(widget, variable, idx) {
  const { x,y,w,h } = widget.rect;
  const raw = Number(sampleValue(variable, idx));
  const min = variable?.engineeringRange?.min ?? 0;
  const max = variable?.engineeringRange?.max ?? 100;
  const ratio = Math.max(0, Math.min(1, (raw-min)/Math.max(1e-9,max-min)));
  const tw = Math.min(74,w*0.3), th = Math.max(60,h-90), tx=x+28, ty=y+50;
  return `${panel(x,y,w,h)}
    <text x="${x+18}" y="${y+31}" fill="#aebdca" font-size="16">${esc(widget.title)}</text>
    <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="7" fill="#172738" stroke="#51687c"/>
    <rect x="${tx+5}" y="${ty+5+th*(1-ratio)}" width="${tw-10}" height="${Math.max(0,(th-10)*ratio)}" rx="4" fill="#368fd3"/>
    <text x="${x+w*0.66}" y="${y+h*0.58}" fill="#edf7ff" font-size="32" font-weight="700" text-anchor="middle">${raw.toFixed(1)}</text>
    <text x="${x+w*0.66}" y="${y+h*0.58+25}" fill="#7f97aa" font-size="14" text-anchor="middle">${esc(widget.unit || '%')}</text>`;
}

function trend(widget, variables) {
  const { x,y,w,h } = widget.rect;
  const plotX=x+55, plotY=y+58, plotW=w-82, plotH=h-92;
  const lines = (widget.variableIds || []).slice(0,4).map((id, li) => {
    const pts = Array.from({length:18},(_,i)=>{
      const xx=plotX+i*plotW/17;
      const yy=plotY+plotH*(0.48+0.18*Math.sin(i*0.57+li*1.3)+li*0.055);
      return `${xx.toFixed(1)},${yy.toFixed(1)}`;
    }).join(' ');
    const colors=['#50d2c2','#5e9fe6','#e4a75b','#c782e8'];
    return `<polyline points="${pts}" fill="none" stroke="${colors[li]}" stroke-width="2.5"/>`;
  }).join('');
  return `${panel(x,y,w,h,widget.title)}
    ${Array.from({length:5},(_,i)=>`<line x1="${plotX}" y1="${plotY+i*plotH/4}" x2="${plotX+plotW}" y2="${plotY+i*plotH/4}" stroke="#26394c" stroke-width="1"/>`).join('')}
    ${Array.from({length:7},(_,i)=>`<line x1="${plotX+i*plotW/6}" y1="${plotY}" x2="${plotX+i*plotW/6}" y2="${plotY+plotH}" stroke="#1b2c3d" stroke-width="1"/>`).join('')}
    ${lines}
    <text x="${plotX}" y="${y+h-20}" fill="#60798e" font-size="12">-24h</text><text x="${plotX+plotW}" y="${y+h-20}" fill="#60798e" font-size="12" text-anchor="end">Now</text>`;
}

function matrix(widget, varsById) {
  const {x,y,w,h}=widget.rect;
  const ids=(widget.variableIds||[]).slice(0,8);
  const rowH=Math.min(46,(h-58)/Math.max(1,ids.length));
  let rows='';
  ids.forEach((id,i)=>{
    const v=varsById[id]; const raw=sampleValue(v,i); const isOk=typeof raw==='boolean'?raw:true;
    const yy=y+55+i*rowH;
    rows += `<line x1="${x+18}" y1="${yy+rowH-2}" x2="${x+w-18}" y2="${yy+rowH-2}" stroke="#1f3142"/><circle cx="${x+34}" cy="${yy+rowH/2-3}" r="7" fill="${isOk?'#51d88a':'#7e8c98'}"/><text x="${x+52}" y="${yy+rowH/2+2}" fill="#c7d5df" font-size="14">${esc(v?.name||id)}</text><text x="${x+w-24}" y="${yy+rowH/2+2}" text-anchor="end" fill="#8fa4b5" font-size="13">${esc(valueText(raw,v))} ${esc(v?.unit||'')}</text>`;
  });
  return `${panel(x,y,w,h,widget.title)}${rows}`;
}

function alarms(widget) {
  const {x,y,w,h}=widget.rect;
  const items=[['INFO','数据更新时间正常','刚刚'],['WARN','示例：低置信度变量需确认语义','--'],['OK','当前无活动故障','--']];
  const rowH=Math.min(38,(h-50)/3);
  return `${panel(x,y,w,h,widget.title)}${items.map((a,i)=>{const yy=y+48+i*rowH; const c=a[0]==='WARN'?'#e4a75b':a[0]==='OK'?'#51d88a':'#5e9fe6'; return `<circle cx="${x+28}" cy="${yy+rowH/2-4}" r="5" fill="${c}"/><text x="${x+43}" y="${yy+rowH/2}" fill="#c7d5df" font-size="13">${esc(a[1])}</text><text x="${x+w-20}" y="${yy+rowH/2}" text-anchor="end" fill="#6f879a" font-size="12">${a[2]}</text>`;}).join('')}`;
}

function mimic(widget, varsById) {
  const {x,y,w,h}=widget.rect;
  const cy=y+h*0.53;
  const tankX=[x+w*0.14,x+w*0.36,x+w*0.66,x+w*0.84];
  const pipe=`<path d="M ${x+80} ${cy} H ${x+w-80}" stroke="#49677c" stroke-width="7" fill="none"/><path d="M ${x+w*0.5} ${cy} V ${y+100}" stroke="#49677c" stroke-width="7"/>`;
  const tanks=tankX.map((tx,i)=>`<g><rect x="${tx-43}" y="${cy-120}" width="86" height="96" rx="8" fill="#172738" stroke="#51687c"/><rect x="${tx-37}" y="${cy-67-i*4}" width="74" height="37" rx="4" fill="#368fd3" opacity="0.85"/><text x="${tx}" y="${cy-82}" fill="#e9f3fa" font-size="13" text-anchor="middle">${55+i*9}%</text><text x="${tx}" y="${cy-5}" fill="#7f97aa" font-size="12" text-anchor="middle">Tank ${i+1}</text></g>`).join('');
  const pumps=[x+w*.45,x+w*.57].map((px,i)=>`<g><circle cx="${px}" cy="${cy}" r="30" fill="#172738" stroke="#51d88a" stroke-width="4"/><path d="M ${px-10} ${cy-12} L ${px+15} ${cy} L ${px-10} ${cy+12} Z" fill="#51d88a"/><text x="${px}" y="${cy+53}" fill="#90a5b5" font-size="12" text-anchor="middle">Pump ${i+1}</text></g>`).join('');
  return `${panel(x,y,w,h,widget.title)}${pipe}${tanks}${pumps}`;
}

export function renderDashboardSvg(plan, classifiedManifest) {
  const width=plan.size.width, height=plan.size.height;
  const vars=classifiedManifest.variables||[];
  const varsById=Object.fromEntries(vars.map((v)=>[v.id,v]));
  const bg='#07121d';
  const widgets=plan.widgets.map((w,idx)=>{
    const v=varsById[w.variableId];
    if (w.type==='multi-trend'||w.type==='trend') return trend(w,varsById);
    if (w.type==='equipment-matrix') return matrix(w,varsById);
    if (w.type==='alarm-list') return alarms(w);
    if (w.type==='process-mimic') return mimic(w,varsById);
    if (w.type==='thermometer') return thermometer(w,v,idx);
    if (w.type==='status'||w.type==='traffic-light') return status(w,v,idx);
    if (w.type==='tank') return tank(w,v,idx);
    if (['gauge','rpm-gauge','pressure-gauge'].includes(w.type)) return gauge(w,v,idx);
    return kpi(w,v,idx);
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(plan.title)}" font-family="Noto Sans CJK SC, Microsoft YaHei, PingFang SC, sans-serif">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="40" y="57" fill="#edf7ff" font-size="28" font-weight="700">${esc(plan.title)}</text>
  <text x="40" y="84" fill="#758ea2" font-size="14">${esc(plan.subtitle)}</text>
  <text x="${width-40}" y="55" fill="#51d88a" font-size="13" text-anchor="end">● 数据连接正常</text>
  <text x="${width-40}" y="80" fill="#60798e" font-size="12" text-anchor="end">AI preview · bindings are reviewed before FUXA apply</text>
  ${widgets}
</svg>`;
}
