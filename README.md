# FUXA Industrial IoT Skill

![license](https://img.shields.io/badge/license-MIT-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![dependencies](https://img.shields.io/badge/dependencies-0-success.svg)
![tests](https://img.shields.io/badge/tests-11%20passed-success.svg)

> 把云平台里的设备变量，变成 FUXA 画面上**真正绑定数据**的控件。

---

## 1. 语言

| 语言 | 文件 |
|---|---|
| 中文（默认） | [README-CN.md](./README-CN.md) |
| English | [README-EN.md](./README-EN.md) |

完整说明与用法在对应语言的 README 中，本文件仅作为仓库首页索引。

## 2. 概述

FUXA 是可视化层，不是数据源。本 Skill 让 AI 代理按照一套可校验的流程，把云平台的设备变量翻译成 FUXA 的组态画面：探测目标实例、分类变量语义、生成原生控件与图表定义、校验绑定完整性，再以 dry-run 方式应用并回读确认。

```text
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  现场设备 │───▶│  边缘网关 │───▶│  云平台   │───▶│   FUXA   │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
    Modbus/OPC      采集与转发      API / 时序库     组态与画面
```

设备数据保留在上游平台，Skill 不绕过云平台边界直连设备。

## 3. 快速开始

```bash
npm test

node scripts/generate-dashboard.mjs \
  --variables templates/variables.example.json \
  --request   templates/dashboard-request.example.json \
  --device-id   production-line-01 \
  --device-name ProductionLine \
  --view-id     production-overview \
  --view-name   "生产线总览" \
  --out-dir     out

node scripts/validate-dashboard.mjs \
  --plan   out/dashboard-plan.json \
  --view   out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json

node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-view.patch.json
```

`apply-to-fuxa.mjs` 默认 dry-run，加 `--apply` 时才写入，并在写入前备份工程。

## 4. 文档索引

| 文档 | 内容 |
|---|---|
| [`README-CN.md`](./README-CN.md) | 中文完整说明 |
| [`README-EN.md`](./README-EN.md) | Full documentation in English |
| [`SKILL.md`](./SKILL.md) | 代理工作流规范 |
| [`docs/architecture.md`](./docs/architecture.md) | 架构定位与数据源策略 |
| [`docs/install.md`](./docs/install.md) | 安装、使用与常见问题 |
| [`docs/quickstart.md`](./docs/quickstart.md) | 十分钟上手 |
| [`references/widget-catalog.md`](./references/widget-catalog.md) | 意图到 FUXA 控件的完整契约 |

## 5. 许可

MIT，详见 [LICENSE](./LICENSE) 与 [NOTICE.md](./NOTICE.md)。
