# FUXA Industrial IoT Skill

![license](https://img.shields.io/badge/license-MIT-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![dependencies](https://img.shields.io/badge/dependencies-0-success.svg)
![tests](https://img.shields.io/badge/tests-11%20passed-success.svg)

> 把云平台里的设备变量，变成 FUXA 画面上**真正绑定数据**的控件。

[English](./README.en.md) · [文档](./docs) · [问题反馈](https://github.com/guan0123258/fuxa-industrial-iot-skill/issues)

---

## 1. 概述

### 1.1 定位

FUXA 是可视化层，不是数据源。本 Skill 让 AI 代理（GitHub Copilot、Codex 等）按照一套可校验的流程，把云平台的设备变量翻译成 FUXA 的组态画面：

- **探测**目标 FUXA 版本与现有工程结构，不假设版本
- **分类**变量语义，客户声明优先于名称推断
- **生成**图表定义与视图补丁，元素均为 FUXA 原生控件
- **校验**绑定完整性，再以 dry-run 方式预览变更
- **应用**前备份工程，应用后回读确认

### 1.2 数据链路

```text
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  现场设备 │───▶│  边缘网关 │───▶│  云平台   │───▶│   FUXA   │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
    Modbus/OPC      采集与转发      API / 时序库     组态与画面
```

设备数据保留在上游平台，FUXA 只负责可视化。Skill 不绕过云平台边界直连设备。

### 1.3 输出产物

| 文件 | 用途 |
|---|---|
| `dashboard-plan.json` | 图表布局与变量绑定计划 |
| `dashboard-preview.svg` | **仅供人工评审**的意图预览，含固定采样值，不应用于 FUXA |
| `fuxa-view.patch.json` | 交付物：`set-view` 补丁，元素全部为绑定标签的原生控件 |
| `fuxa-charts.patch.json` | `charts` 补丁，定义视图引用的趋势曲线 |

---

## 2. 快速开始

### 2.1 环境要求

Node.js 18 或更高版本。无第三方依赖。

```bash
node -v
npm test          # 11 项自检
```

### 2.2 生成仪表盘

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

`--device-id`、`--device-name`、`--view-id`、`--view-name` 需与目标 FUXA 工程中已有的设备与视图一致。

### 2.3 校验

```bash
node scripts/validate-dashboard.mjs \
  --plan   out/dashboard-plan.json \
  --view   out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json
```

校验会拒绝任何**带变量却没有原生控件绑定**的图表元素。

### 2.4 应用到 FUXA

```bash
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-charts.patch.json
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-view.patch.json --apply
```

默认 dry-run。加 `--apply` 时会先把 `/api/project` 完整备份到 `backups/`。

---

## 3. 图表类型

| 意图 | FUXA 元素 | 说明 |
|---|---|---|
| `gauge` `rpm-gauge` `pressure-gauge` | `svg-ext-html_bag` | 圆环仪表，彩色弧为当前值，灰色弧为剩余量程，同圈重叠 |
| `thermometer` `tank` `progress` | `svg-ext-gauge_progress` | 条形仪表，灰色底轨 + 自底部生长的填充 |
| `kpi` `status` `traffic-light` | `svg-ext-value` | 数值文本，支持单位与分级配色 |
| 可写布尔量 | `svg-ext-html_switch` | 仅当变量显式声明 `writable: true` 时使用 |
| `trend` `multi-trend` | `svg-ext-html_chart` | 图表元素 + `charts` 曲线定义 |
| `equipment-matrix` | `svg-ext-value` 多行 | 每行一个真实绑定 |
| `alarm-list` `process-mimic` | 装饰件 | 无单一标签可绑，生成时逐条告警 |

完整契约见 [`references/widget-catalog.md`](./references/widget-catalog.md)。

---

## 4. 安装到 AI 客户端

### 4.1 GitHub Copilot（VS Code）

```powershell
node scripts/install-skill.mjs --target vscode --scope user
node scripts/install-skill.mjs --target vscode --scope project --project <仓库>
```

用户级安装到 `%APPDATA%\Code\User\prompts\skills\`，工程级安装到 `<仓库>\.github\skills\`。装完重载 VS Code 窗口。

### 4.2 Codex

```powershell
node scripts/install-skill.mjs --target codex --scope user
node scripts/install-skill.mjs --target codex --scope project --project <仓库>
```

用户级安装到 `~/.agents/skills/`，工程级安装到 `<仓库>\.agents\skills\`，并在工程根目录维护 `AGENTS.md`。

安装后可直接用自然语言下达需求，例如：

```text
用 fuxa-industrial-iot-skill 给生产线做一张组态画面，
模拟量用圆环仪表，趋势保留 2 小时，先生成再校验，我确认后再 apply。
```

---

## 5. 目录结构

```text
fuxa-industrial-iot-skill/
├── SKILL.md                  代理工作流规范
├── README.md                 本文件（中文）
├── README.en.md              English
├── agents/openai.yaml        客户端元数据
├── docs/                     架构、安装、上手指南
├── references/               控件契约、变量语义、数据源与安全策略
├── templates/                预设布局与请求示例
├── scripts/                  命令行工具
├── examples/generated/       生成产物示例
└── tests/                    回归测试
```

---

## 6. 安全与变更控制

| 项目 | 默认行为 |
|---|---|
| 写入 FUXA | dry-run，需显式 `--apply` |
| 变更前 | 完整备份 `/api/project` |
| 变更后 | 回读工程，校验元素与绑定 |
| 写控制 | 仅接受显式 `writable: true`，不推断 |
| 凭据 | 通过环境变量传入，不写入仓库 |
| TLS | 默认校验证书，`--insecure` 仅限测试环境 |

---

## 7. 文档索引

| 文档 | 内容 |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | 架构定位与数据源策略 |
| [`docs/install.md`](./docs/install.md) | 安装、使用与常见问题 |
| [`docs/quickstart.md`](./docs/quickstart.md) | 十分钟上手 |
| [`references/widget-catalog.md`](./references/widget-catalog.md) | 意图到 FUXA 控件的完整契约 |
| [`references/variable-semantics.md`](./references/variable-semantics.md) | 变量语义判定优先级 |
| [`references/security.md`](./references/security.md) | 安全边界与写控制策略 |

---

## 8. 许可

MIT，详见 [LICENSE](./LICENSE) 与 [NOTICE.md](./NOTICE.md)。
