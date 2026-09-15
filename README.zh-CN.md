# Industrial FUXA Studio Skill（中文版）

这是一个针对“**已有工业物联网平台 + 客户工业云 + FUXA 可视化层**”重新设计的 Agent Skill。它不是让 FUXA 替代卡奥斯平台，也不是让 FUXA 重新采 PLC；它把 FUXA 定位为客户工业云后面的 SCADA/HMI/工业可视化引擎。

## 适合你的链路

```text
设备(Modbus TCP)
    ↓
EC100 边缘网关
    ↓ MQTT
卡奥斯平台
    ↓ Kafka
ClickHouse 时序库
    ↓ 卡奥斯/工业云 API
客户工业云平台
    ↓
FUXA 可视化页面
```

卡奥斯继续负责多租户设备、物模型、采集、Kafka、ClickHouse；工业云继续作为客户可见的权限和产品 API 边界；FUXA 负责船舶总览、机舱、压载、仪表、趋势、流程图、报警页等视觉层。

## 相比原 FUXA Automation Skill 的主要变化

1. **版本不再写死。** 先请求 `/api/version`，再探测 `/api/project`、资源等能力，并读取当前项目的真实结构；遇到比已知版本更新的 FUXA，也不会直接判定“不支持”。
2. **支持多机器版本检查。** `check-fuxa-fleet.mjs` 可一次检查开发机、测试机、船厂生产机等，并和 GitHub 最新公开 release 比较。
3. **客户声明优先。** 变量的 `semanticType`、展示方式、量程、阈值由客户/项目工程师声明时，AI 必须服从；没有声明才按参数编码、采集编码、名称、单位推断。
4. **推断只作为兜底。** 无法判断的数值默认 `KPI + 趋势`，并标记 `needsReview=true`；绝不凭名称猜出“阀门/开关”后自动开启写控制。
5. **适配你现在只读 API 的阶段。** 提供只读 Bridge：工业云 `GET` 最新值，然后通过 FUXA 官方 `/api/setTagValue` 更新 FUXA 虚拟 Tag；不会反向控制卡奥斯或 PLC。
6. **先生成中立 Dashboard Spec，再翻译成 FUXA。** 这样 UI 设计不和某一版 FUXA 内部 JSON 强绑定。
7. **安全变更。** 修改 FUXA 项目默认 dry-run；真正 `--apply` 前自动备份 `/api/project`；TLS 默认验证证书。
8. **船舶原创模板。** 自带 `vessel-overview`、`engine-room`、`ballast-system`、`alarm-center` 四个布局预设，并记录 Ulstein/Kongsberg/Emerson/Valmet 等真实船舶 HMI 作为设计参考，而不是复制它们的截图。
9. **预览和交付物分开。** `dashboard-preview.svg` 只给人看；真正交付的是 `scripts/lib/fuxa-view-renderer.mjs` 渲染出来的 `fuxa-view.patch.json`，里面每个带变量的控件都是 FUXA 原生、绑定标签的控件，不再出现“画出来但不会动”的静态贴图。
10. **一键安装到各客户端。** `scripts/install-skill.mjs` 支持把 skill 装到 VS Code Copilot 或 Codex 的用户级/工程级目录，并自动维护 `AGENTS.md`。

## 现在已经支持的图形意图

`KPI`、状态灯、仪表、RPM 仪表、压力表、温度计、液位/油箱、进度、Sparkline、单/多趋势、面积、柱图、横向排行、Donut、表格、报警列表、设备矩阵、泵阀管路流程图、船舶吃水/纵倾/横倾、航向、地图、设备 SVG Mimic 等。

其中并不是每一种都保证某个 FUXA 版本有“原生控件”。Skill 会优先使用目标版本支持的控件，不足时用 SVG Widget 实现，或者降级成安全的通用展示。

## 铁律：绝不产出静态贴图

屏幕上的数字和弧线，操作员会当成现场真实状态来读，所以“画出来但不会动”是缺陷，不是美观问题。

- `dashboard-preview.svg` 只是给人看的意图预览，里面的采样值是冻结的，**永远不要**把它应用到 FUXA。
- 真正交付的是 `fuxa-view.patch.json`：每个带变量的控件都是 FUXA 原生、绑定标签的控件。
  - 模拟量仪表 → `svg-ext-html_bag`（GaugeType 0）：彩色弧表示当前值，灰色 `strokeColor` 弧表示剩余量程，两者画在同一个圆上**重叠**，而不是并排。
  - 温度计 / 液位 / 进度 → `svg-ext-gauge_progress`（灰色底轨 + 从底部生长的填充）。
  - KPI / 状态 → `svg-ext-value`（带单位或分级配色）。
  - 可写布尔量（必须显式 `writable: true`）→ `svg-ext-html_switch`。
  - 趋势 → `svg-ext-html_chart` + `charts` 定义，每条曲线绑定到设备标签。
- 容器 id 前缀不能丢：`D-BAG_`、`A-GXP_`/`B-GXP_`、`T-HXT_`、`D-HXC_`。缺了容器 FUXA 什么都挂不上，界面会一直空着，校验器会把这种情况判为错误。
- `alarm-list`、`process-mimic` 这类没有单一标签可绑的意图允许作为装饰件，但生成时会逐条告警，且不得当成实时数据展示。

完整的意图 → 控件对照表见 `references/widget-catalog.md`。

## 最快体验

```bash
cd industrial-fuxa-studio-skill
npm test

# 生成计划 + 预览 + 真正可用的 FUXA 视图补丁
node scripts/generate-dashboard.mjs \
  --variables templates/variables.ship-engine.example.json \
  --request templates/dashboard-request.example.json \
  --device-id main-propulsion \
  --device-name MainPropulsionTIA \
  --view-id main-propulsion-overview \
  --view-name "主推进系统" \
  --out-dir examples/generated

# 同时校验计划与生成的视图
node scripts/validate-dashboard.mjs \
  --plan examples/generated/dashboard-plan.json \
  --view examples/generated/fuxa-view.patch.json \
  --charts examples/generated/fuxa-charts.patch.json
```

产物：

| 文件 | 用途 |
|---|---|
| `dashboard-preview.svg` | 仅供人工评审，含冻结的采样值，不要 apply |
| `fuxa-view.patch.json` | 交付物：`set-view` 补丁，元素都是绑定标签的原生控件 |
| `fuxa-charts.patch.json` | `charts` 补丁，定义视图里引用的趋势曲线 |


然后打开：

```text
examples/generated/dashboard-preview.svg
```

示例中故意放了一个没有语义的 `参数X7`，它会被标记为低置信度待确认，而不会被强行猜成某种工业量。

## 检查多台 FUXA

先编辑：

```text
templates/fuxa-instances.example.json
```

再运行：

```bash
node scripts/check-fuxa-fleet.mjs \
  --config templates/fuxa-instances.example.json \
  --out fuxa-fleet-report.json
```

有互联网时会通过 GitHub Releases 查询最新公开 FUXA；离线环境可加 `--offline` 使用配置里的 fallback 版本。

## 在 Codex 中安装

当前 Codex 的标准 Skill 结构就是“目录 + `SKILL.md`”，这个包还带了 `agents/openai.yaml` 作为 UI 元数据。

项目级安装：

```text
<你的项目>/.agents/skills/industrial-fuxa-studio/
```

用户级安装：

```text
~/.agents/skills/industrial-fuxa-studio/
```

把整个目录复制进去，重启/刷新 Codex Skill 列表后，可以明确调用：

```text
$industrial-fuxa-studio
```

如果你的 Codex 界面支持 Skill/Plugin 安装器，优先用当前界面的安装功能，因为 OpenAI 的 Skill/Plugin 分发方式仍在演进。

## 如果你说的“GPT”是普通 ChatGPT

截至本包制作时，OpenAI 官方说明：ChatGPT Skills 主要面向符合条件的 Business、Enterprise、Healthcare、Edu 工作区；Codex 也支持 Skills。也就是说，如果你使用的是个人版 ChatGPT、界面里没有 `Plugins -> Skills`，**直接用 Codex 安装这个包更合适**。这不影响这个 Skill 的目录结构和脚本本身。

官方说明：https://help.openai.com/en/articles/20001066

## 你的下一步

真正接你的工业云时，需要把下面三样东西替换示例：

- 工业云“设备最新遥测”API 的真实返回 JSON；
- 设备/参数元数据（参数编码、采集编码、参数名称、单位、类型，以及客户声明的语义）；
- 一台可测试的 FUXA 地址/版本。

有这些之后，这套 Skill 就能进一步从“生成预览”推进到“自动生成与你实际 FUXA 项目结构匹配的 `set-view/charts/graphs` patch”。
