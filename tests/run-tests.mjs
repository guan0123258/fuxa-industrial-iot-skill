#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import { classifyVariable } from '../scripts/lib/variable-classifier.mjs';
import { parseSemver, compareSemver } from '../scripts/lib/semver.mjs';
import { makeDashboardPlan } from '../scripts/lib/dashboard-planner.mjs';
import { renderDashboardSvg } from '../scripts/lib/svg-renderer.mjs';
import { renderFuxaView, validateFuxaView } from '../scripts/lib/fuxa-view-renderer.mjs';
import { FuxaClient } from '../scripts/lib/fuxa-client.mjs';

let passed = 0;
async function test(name, fn) {
  await fn();
  console.log(`PASS ${name}`);
  passed += 1;
}

/** Fixture shared by the FUXA view tests: one variable per widget intent. */
const ENGINE_MANIFEST = {
  device: { id: 'dev-1', name: 'MainPropulsion' },
  variables: [
    { id: 'pressure', name: '润滑油压力', unit: 'bar', dataType: 'number', engineeringRange: { min: 1, max: 10 }, display: ['pressure-gauge'] },
    { id: 'temperature', name: '主机温度', unit: '°C', dataType: 'number', engineeringRange: { min: 25, max: 50 }, display: ['thermometer', 'trend'] },
    { id: 'rpm', name: '主机转速', unit: 'rpm', dataType: 'number', engineeringRange: { min: 3000, max: 4000 }, display: ['rpm-gauge', 'trend'] },
    { id: 'running', name: '主机运行开关', dataType: 'boolean', writable: true, display: ['status'] },
    { id: 'standby', name: '备用泵状态', dataType: 'boolean', display: ['status'] }
  ]
};

await test('explicit semantic metadata wins', async () => {
  const r = classifyVariable({ id:'x', name:'压力但客户声明温度', unit:'bar', dataType:'number', semanticType:'temperature', writable:false });
  assert.equal(r.semanticType, 'temperature');
  assert.equal(r.semanticSource, 'explicit');
  assert.equal(r.semanticConfidence, 1);
});

await test('parameter-code override beats heuristic', async () => {
  const r = classifyVariable({ id:'x', name:'参数40003', parameterCode:'40003', dataType:'number' }, {
    byParameterCode: { '40003': { semanticType:'pressure', display:['pressure-gauge','trend'], confidence:0.98 } }
  });
  assert.equal(r.semanticType, 'pressure');
  assert.equal(r.semanticSource, 'operator-override');
});

await test('unknown numeric is safe fallback and not writable', async () => {
  const r = classifyVariable({ id:'x', name:'X7', dataType:'number' });
  assert.equal(r.semanticType, 'generic-number');
  assert.equal(r.writable, false);
  assert.equal(r.needsReview, true);
});

await test('write permission is never inferred', async () => {
  const r = classifyVariable({ id:'pump.start', name:'水泵启动开关', dataType:'boolean' });
  assert.equal(r.writable, false);
});

await test('semver compare works', async () => {
  assert.deepEqual(parseSemver('v1.3.4'), {major:1,minor:3,patch:4,raw:'1.3.4'});
  assert.equal(compareSemver('1.3.3','1.3.4'), -1);
  assert.equal(compareSemver('1.4.0','1.3.4'), 1);
});

await test('dashboard plan and SVG are generated', async () => {
  const manifest = { device:{id:'d1',name:'Test'}, variables:[
    {id:'temp',name:'温度',unit:'°C',dataType:'number',sampleValue:72},
    {id:'rpm',name:'转速',unit:'rpm',dataType:'number',sampleValue:1800},
    {id:'run',name:'运行状态',dataType:'boolean',sampleValue:true}
  ]};
  const {classified,plan,bindingPlan} = await makeDashboardPlan({manifest, request:{preset:'engine-room',title:'Test Dashboard'}});
  assert.ok(plan.widgets.length >= 3);
  assert.equal(bindingPlan.bindings.length, 3);
  const svg=renderDashboardSvg(plan,classified);
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('Test Dashboard'));
});

await test('FUXA view binds every value widget to a native element', async () => {
  const { classified, plan } = await makeDashboardPlan({ manifest: ENGINE_MANIFEST, request: { preset: 'engine-room', title: 'Test Dashboard' } });
  const rendered = renderFuxaView({ plan, classified, context: { deviceId: 'dev-1', deviceName: 'MainPropulsion', viewId: 'v1', viewName: 'Main' } });
  const items = Object.values(rendered.view.items);
  const types = items.map((item) => item.type);

  // Pressure/RPM intents must be real circular gauges, not drawn arcs.
  assert.ok(items.some((item) => item.id === 'BAG_widget-pressure' && item.type === 'svg-ext-html_bag'));

  // The coloured arc is the value, the grey ring is the remaining range, and the
  // two are drawn on the same circle so they overlap instead of sitting apart.
  const gauge = items.find((item) => item.id === 'BAG_widget-pressure');
  assert.ok(gauge.property.options.colorStart, 'gauge needs colorStart for the progress arc');
  assert.ok(gauge.property.options.strokeColor, 'gauge needs strokeColor for the grey track');
  assert.equal(gauge.property.options.type, 0);
  assert.equal(gauge.property.options.minValue, 1);
  assert.equal(gauge.property.options.maxValue, 10);
  assert.ok(rendered.view.svgcontent.includes('id="D-BAG_widget-pressure"'), 'gauge container must exist for the canvas to mount');

  // Thermometer intent ships as a live bar gauge instead of a drawn column.
  assert.ok(items.some((item) => item.id === 'GXP_widget-temperature' && item.type === 'svg-ext-gauge_progress'));
  assert.ok(rendered.view.svgcontent.includes('id="B-GXP_widget-temperature"'), 'bar gauge must expose its fill rectangle');
  assert.ok(rendered.view.svgcontent.includes('id="A-GXP_widget-temperature"'), 'bar gauge must expose its grey track');

  // A trend must carry a chart definition bound to the device tags.
  assert.ok(types.includes('svg-ext-html_chart'));
  assert.equal(rendered.charts.length, 1);
  assert.ok(rendered.charts[0].lines.length >= 1);
  assert.equal(rendered.charts[0].lines[0].device, 'dev-1');

  const result = validateFuxaView({ view: rendered.view, charts: rendered.charts, plan });
  assert.deepEqual(result.errors, []);
  // Every widget is either bound to a tag or explicitly declared decorative.
  assert.equal(rendered.stats.boundWidgets + rendered.stats.decorativeWidgets, rendered.stats.widgets);
  assert.equal(result.stats.boundVariables, 5);
});

await test('writable boolean ships as a switch, read-only boolean as a value', async () => {
  const { classified, plan } = await makeDashboardPlan({ manifest: ENGINE_MANIFEST, request: { preset: 'engine-room' } });
  const rendered = renderFuxaView({ plan, classified, context: { deviceId: 'dev-1', deviceName: 'Main', viewId: 'v1', viewName: 'Main' } });
  const items = Object.values(rendered.view.items);
  const writable = items.find((item) => item.id === 'HXT_widget-running');
  assert.equal(writable.type, 'svg-ext-html_switch');
  assert.equal(writable.property.options.onValue, 1);
  assert.ok(rendered.view.svgcontent.includes('id="T-HXT_widget-running"'));

  const readOnly = items.find((item) => item.id === 'VAL_widget-standby');
  assert.equal(readOnly.type, 'svg-ext-value');
  assert.equal(readOnly.property.ranges[0].type, 'step');
});

await test('validator rejects a view that would ship as a static picture', async () => {
  const { classified, plan } = await makeDashboardPlan({ manifest: ENGINE_MANIFEST, request: { preset: 'engine-room' } });
  const rendered = renderFuxaView({ plan, classified, context: { deviceId: 'dev-1', deviceName: 'Main', viewId: 'v1', viewName: 'Main' } });

  // Strip every binding for one variable, the way a static-SVG-only pipeline
  // would: the widget is still drawn, nothing updates it.
  for (const [id, item] of Object.entries(rendered.view.items)) {
    const bound = item.property?.variableId || item.property?.variable;
    if (bound === 'pressure') delete rendered.view.items[id];
  }
  const result = validateFuxaView({ view: rendered.view, charts: rendered.charts, plan });
  assert.ok(result.errors.some((message) => message.includes('static picture')), JSON.stringify(result.errors));
  assert.ok(result.errors.some((message) => message.includes('pressure')), JSON.stringify(result.errors));
});

await test('validator catches a gauge container that FUXA could not mount', async () => {
  const { classified, plan } = await makeDashboardPlan({ manifest: ENGINE_MANIFEST, request: { preset: 'engine-room' } });
  const rendered = renderFuxaView({ plan, classified, context: { deviceId: 'dev-1', deviceName: 'Main', viewId: 'v1', viewName: 'Main' } });
  rendered.view.svgcontent = rendered.view.svgcontent.replace('id="D-BAG_widget-pressure"', 'id="D-BAG-missing"');
  const result = validateFuxaView({ view: rendered.view, charts: rendered.charts, plan });
  assert.ok(result.errors.some((message) => message.includes('D-BAG_widget-pressure')), JSON.stringify(result.errors));
});

await test('FUXA client follows current tag API shape and nested signin token', async () => {
  const requests = [];
  const server = http.createServer((req,res) => {
    const chunks=[];
    req.on('data',(c)=>chunks.push(c));
    req.on('end',()=>{
      const body=Buffer.concat(chunks).toString('utf8');
      requests.push({url:req.url,method:req.method,headers:req.headers,body:body?JSON.parse(body):null});
      if(req.url==='/api/signin') {
        res.setHeader('content-type','application/json');
        res.end(JSON.stringify({status:'success',message:'ok',data:{token:'mock-token'}}));
      } else if(req.url?.startsWith('/api/getTagValue')) {
        res.setHeader('content-type','application/json');
        res.end(JSON.stringify([{id:'tag.a',value:12.3}]));
      } else if(req.url==='/api/setTagValue') {
        res.statusCode=204; res.end();
      } else { res.statusCode=404; res.end(); }
    });
  });
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {
    const client=new FuxaClient({baseUrl:`http://127.0.0.1:${port}`,username:'u',password:'p'});
    await client.getTagValue(['tag.a']);
    await client.setTagValue({tags:[{id:'tag.a',value:12.3}]});
    const getReq=requests.find((r)=>r.url.startsWith('/api/getTagValue'));
    assert.ok(getReq.url.includes('ids='));
    assert.ok(decodeURIComponent(getReq.url).includes('["tag.a"]'));
    const setReq=requests.find((r)=>r.url==='/api/setTagValue');
    assert.deepEqual(setReq.body,{tags:[{id:'tag.a',value:12.3}]});
    assert.equal(setReq.headers['x-access-token'],'mock-token');
  } finally {
    await new Promise((resolve)=>server.close(resolve));
  }
});

console.log(`\n${passed} tests passed.`);
