# 安装与使用

## 1. 环境准备

需要 Node.js 18 或更高版本，无第三方依赖。

```bash
node -v
npm test          # 11 项自检
```

## 2. 命令行使用

### 2.1 生成

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

| 参数 | 说明 |
|---|---|
| `--variables` | 变量清单，建议带上单位、量程、display 意图与 writable |
| `--request` | 画面请求，指定预设、尺寸与主题 |
| `--device-id` / `--device-name` | 目标 FUXA 工程中已有的设备 id 与名称 |
| `--view-id` / `--view-name` | 目标 FUXA 工程中已有的视图 id 与名称 |
| `--out-dir` | 产物目录 |

产物中 `dashboard-preview.svg` 仅供人工评审，`fuxa-view.patch.json` 与 `fuxa-charts.patch.json` 才是交付物。

### 2.2 校验

```bash
node scripts/validate-dashboard.mjs \
  --plan   out/dashboard-plan.json \
  --view   out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json
```

校验会拒绝带变量却没有原生控件绑定的元素，以及缺少挂载容器的仪表。

### 2.3 应用

```bash
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-charts.patch.json
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-view.patch.json --apply
```

默认 dry-run。加 `--apply` 时先把 `/api/project` 备份到 `backups/`，应用后回读工程并校验元素与绑定。

### 2.4 探测目标实例

```bash
node scripts/probe-fuxa.mjs           --url http://fuxa.example.com --out capabilities.json
node scripts/inspect-fuxa-project.mjs --url http://fuxa.example.com --out inspection.json
```

## 3. 安装到 AI 客户端

### 3.1 VS Code Copilot

```powershell
node scripts/install-skill.mjs --target vscode --scope user
node scripts/install-skill.mjs --target vscode --scope project --project <仓库>
```

用户级安装到 `%APPDATA%\Code\User\prompts\skills\`，工程级安装到 `<仓库>\.github\skills\`。装完重载 VS Code 窗口。

### 3.2 Codex

```powershell
node scripts/install-skill.mjs --target codex --scope user
node scripts/install-skill.mjs --target codex --scope project --project <仓库>
```

用户级安装到 `~/.agents/skills/`，工程级安装到 `<仓库>\.agents\skills\`，并在仓库根目录维护 `AGENTS.md`。

重复安装需加 `--force`。

## 4. 分发给同事

| 方式 | 做法 |
|---|---|
| 打包 | 复制整个目录，注意包含 `scripts/`、`references/`、`templates/`，只给 `SKILL.md` 无法运行 |
| 仓库内 | 把 `.agents/skills/` 与 `.github/skills/` 提交进项目仓库，同事 clone 后零配置可用 |
| 私有 npm | `package.json` 已就绪，安装后执行 `install-skill.mjs` |

## 5. 常见问题

| 现象 | 原因与处理 |
|---|---|
| 画面只有文字，仪表空白 | 缺少挂载容器，检查 `D-BAG_`、`A-GXP_`、`B-GXP_`、`T-HXT_`、`D-HXC_` 前缀 |
| 仪表弧线不动 | 元素未使用 `svg-ext-html_bag`，重新生成并确认校验通过 |
| 应用后图表为空 | 未应用 `fuxa-charts.patch.json`，曲线定义缺失 |
| 数值一直不变 | 检查绑定变量与数据源轮询，确认时间戳是否推进 |
| 写入失败 | 该变量未被声明为可写，或未配置写值通道 |
