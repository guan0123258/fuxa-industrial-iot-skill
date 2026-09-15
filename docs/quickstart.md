# 十分钟上手

## 1. 准备变量清单

变量清单是唯一必需的输入。信息越完整，生成结果越准确。

```json
{
  "device": { "id": "production-line-01", "name": "ProductionLine" },
  "variables": [
    { "id": "line01.pressure", "name": "进气压力", "unit": "bar", "dataType": "number",
      "engineeringRange": { "min": 0, "max": 16 }, "display": ["pressure-gauge", "trend"] },
    { "id": "line01.temperature", "name": "反应釜温度", "unit": "°C", "dataType": "number",
      "engineeringRange": { "min": 0, "max": 120 }, "display": ["thermometer", "trend"] },
    { "id": "line01.running", "name": "设备运行状态", "dataType": "boolean", "display": ["status"] }
  ]
}
```

| 字段 | 作用 |
|---|---|
| `unit` | 参与语义判定，并显示在画面上 |
| `engineeringRange` | 仪表的量程上下限 |
| `display` | 指定控件意图，优先级高于推断 |
| `writable` | 仅在被控制时填写，缺省为只读 |

## 2. 生成画面

```bash
node scripts/generate-dashboard.mjs \
  --variables templates/variables.example.json \
  --request   templates/dashboard-request.example.json \
  --device-id   production-line-01 \
  --device-name ProductionLine \
  --view-id     production-overview \
  --view-name   "生产线总览" \
  --out-dir     out
```

`--device-id` 与 `--device-name` 必须与目标 FUXA 工程中已有的设备一致，否则绑定为空。不确定时先运行：

```bash
node scripts/inspect-fuxa-project.mjs --url http://fuxa.example.com --out inspection.json
```

## 3. 校验

```bash
node scripts/validate-dashboard.mjs \
  --plan   out/dashboard-plan.json \
  --view   out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json
```

输出应当为 `OK`。若出现 `static picture` 报错，说明存在带变量但未绑定的元素，需修正变量清单或 `display` 意图。

## 4. 应用

```bash
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-charts.patch.json
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-view.patch.json
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-view.patch.json --apply
```

前两条是 dry-run，用于核对即将发送的载荷；第三条才真正写入，写入前会自动备份工程。

验证数据是否真的在刷新：

```bash
curl -s "http://fuxa.example.com/api/getTagValue?ids=%5B%22line01.pressure%22%5D"
```

连续请求两次，确认 `ts` 字段在推进，而不只是有值。

## 5. 下一步

| 目标 | 参考 |
|---|---|
| 调整布局与预设 | [`references/dashboard-patterns.md`](../references/dashboard-patterns.md) |
| 补充变量语义 | [`references/variable-semantics.md`](../references/variable-semantics.md) |
| 接入真实数据源 | [`references/data-source-strategy.md`](../references/data-source-strategy.md) |
| 了解控件契约 | [`references/widget-catalog.md`](../references/widget-catalog.md) |
