# 使用指南（中文）

`fuxa-industrial-iot-skill` 有三种用法，互不冲突，可以同时装：

| 用法 | 适合谁 | 需要 Node 吗 |
|---|---|---|
| A. 命令行直接跑脚本 | 只想产出/校验补丁，不想让 AI 插手 | 需要 |
| B. 作为 Agent Skill 给 AI 用 | 让 Copilot / Codex 自己规划、生成、校验、部署 | 需要（AI 会调脚本） |
| C. 打包分发给同事 | 同事装到自己环境里 | 需要 |

> 三种用法的核心产物都一样：`fuxa-view.patch.json`（真正的 `set-view` 补丁，元素全是绑定标签的 FUXA 原生控件）+ `fuxa-charts.patch.json`（趋势曲线定义）。
> `dashboard-preview.svg` 只是给人看的预览，里面是冻结的采样值，**永远不要 apply**。

---

## A. 命令行直接用

不用 AI，手工跑四个脚本即可。

```bash
cd fuxa-industrial-iot-skill
npm test                      # 11 项自检，先确认环境没问题

# 1) 变量语义分类（可跳过，生成器内部也会分类）
node scripts/classify-variables.mjs \
  --input templates/variables.ship-engine.example.json \
  --overrides templates/semantic-overrides.example.json \
  --out out/classified-variables.json

# 2) 生成计划 + 预览 + 真正可用的 FUXA 视图补丁
node scripts/generate-dashboard.mjs \
  --variables out/classified-variables.json \
  --request templates/dashboard-request.example.json \
  --device-id tia-main-propulsion-live \
  --device-name MainPropulsionTIA \
  --view-id main-propulsion-overview \
  --view-name "主推进系统 · 博途联调" \
  --out-dir out

# 3) 校验（重点是 --view，它会拦住"静态贴图"）
node scripts/validate-dashboard.mjs \
  --plan out/dashboard-plan.json \
  --view out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json

# 4) 应用（默认 dry-run，确认无误再加 --apply）
node scripts/apply-to-fuxa.mjs --url http://8.153.154.62:1881 --patch out/fuxa-charts.patch.json
node scripts/apply-to-fuxa.mjs --url http://8.153.154.62:1881 --patch out/fuxa-view.patch.json --apply
```

`--device-id` / `--device-name` / `--view-id` / `--view-name` 必须和线上 FUXA 工程里已有的设备、视图对得上，否则绑定会是空的。
不确定就先探一遍：

```bash
node scripts/probe-fuxa.mjs --url http://8.153.154.62:1881 --out capabilities.json
node scripts/inspect-fuxa-project.mjs --url http://8.153.154.62:1881 --out inspection.json
```

---

## B. 在 VS Code Copilot（Agent Skill）里用

装到**用户级**（你自己所有工程都能用）：

```powershell
cd d:\船舶PLC\fuxa-industrial-iot-skill
node scripts\install-skill.mjs --target vscode --scope user
# 实际复制到 %APPDATA%\Code\User\prompts\skills\fuxa-industrial-iot-skill\
```

装到**工程级**（跟着仓库走，同事 clone 下来就有）：

```powershell
node scripts\install-skill.mjs --target vscode --scope project --project d:\船舶PLC\industrial-cloud-ui
# 复制到 <仓库>\.github\skills\fuxa-industrial-iot-skill\
```

装完 **重载 VS Code 窗口**（`Developer: Reload Window`）。然后在 Copilot Chat 里直接说需求，例如：

> 用 fuxa-industrial-iot-skill 把主推进系统做成组态页面，5 个模拟量用圆环仪表，绑定当前 FUXA 工程的 live 设备标签，先生成再校验，我确认后再 apply。

Copilot 会按 `SKILL.md` 的工作流走：探测 → 分类 → 生成 → 校验 → 备份 → 应用 → 回读。

> 注意：Skill 里的脚本需要 Node 18+。如果 VS Code 的终端找不到 `node`，把 Node 加进 PATH，或改用能跑的绝对路径。

---

## C. 在 Codex（GPT 客户端）里用

Codex 走 Agent Skills 的目录约定，装到下面任一位置即可被自动发现：

```text
# 用户级（你自己所有工程）
~/.agents/skills/fuxa-industrial-iot-skill/

# 工程级（推荐给团队，跟仓库走）
<repo>/.agents/skills/fuxa-industrial-iot-skill/
```

用脚本装（会自动带上全套 `scripts/`、`references/`、`templates/`，并在工程根目录追加 `AGENTS.md` 说明）：

```powershell
cd d:\船舶PLC\fuxa-industrial-iot-skill

# 我自己全局用
node scripts\install-skill.mjs --target codex --scope user

# 装进某个仓库给整个团队用
node scripts\install-skill.mjs --target codex --scope project --project d:\船舶PLC\industrial-cloud-ui
```

工程级安装会写这些内容：

| 路径 | 作用 |
|---|---|
| `.agents/skills/fuxa-industrial-iot-skill/` | 完整 skill 包 |
| `AGENTS.md`（工程根） | 告诉 Codex：遇到 FUXA/组态任务就读 `SKILL.md` 并按流程走 |

`--scope project` 默认就会写 `AGENTS.md`；写用户级时想额外在某个仓库写，可以加 `--agents-md --project <repo>`。

装完重启 / 刷新 Codex 的 Skills 列表，然后用 skill 名引用：

> `Use $fuxa-industrial-iot-skill to add a circular-gauge main propulsion view to my FUXA project and validate it before applying.`

`agents/openai.yaml` 里已经给了一个默认提示词，Skill/Plugin 界面导入时会带上：

```
Use $fuxa-industrial-iot-skill to design a safe FUXA dashboard from my
industrial-cloud device variables, preview it, validate bindings, and only
apply changes after review.
```

### 关于 ChatGPT 网页版

ChatGPT 的 Skills/Plugins 是否可见，取决于账号和工作区策略。如果你的界面里有 **Plugins → Skills**，直接导入这个文件夹；如果没有，就用 Codex 那条路，或者干脆走 A（命令行）——脚本本身不依赖任何 AI。

---

## D. 给同事用

### 方式 1：直接发文件夹（最简单）

把整个 `fuxa-industrial-iot-skill` 目录拷给同事（压缩包即可，注意别漏掉 `scripts/lib/`、`references/`、`templates/`——只给 `SKILL.md` 是跑不起来的）。同事在自己机器上：

```powershell
cd <解压出来的目录>
node -v                       # 需要 18+
node tests\run-tests.mjs      # 11 项全过 = 环境 OK

# 然后按需安装
node scripts\install-skill.mjs --target vscode --scope user
node scripts\install-skill.mjs --target codex  --scope user
```

### 方式 2：放进同一个 Git 仓库（推荐团队用）

把 skill 目录提交到项目仓库，比如：

```text
industrial-cloud-ui/
├─ .agents/skills/fuxa-industrial-iot-skill/    ← Codex
├─ .github/skills/fuxa-industrial-iot-skill/    ← VS Code Copilot
└─ AGENTS.md
```

同事 `git clone` 下来后不用做任何事，两个客户端都能自动发现。用安装脚本可以一次性生成这两个目录：

```powershell
node scripts\install-skill.mjs --target codex  --scope project --project <repo>
node scripts\install-skill.mjs --target vscode --scope project --project <repo>
```

### 方式 3：做成 npm 包 / 私有 registry

`package.json` 已就绪（`"type": "module"`、`engines.node >= 18`、无第三方依赖）。放进私有 registry 后同事：

```bash
npm i -D @your-scope/fuxa-industrial-iot-skill
node node_modules/@your-scope/fuxa-industrial-iot-skill/scripts/install-skill.mjs --target vscode --scope project --project .
```

---

## 端到端真实例子（主推进系统）

```bash
# 1) 变量清单里带上信息量：单位、量程、display 意图、是否可写
#    display: ["pressure-gauge"] / ["thermometer","trend"] / ["rpm-gauge","trend"] ...

# 2) 生成
node scripts/generate-dashboard.mjs \
  --variables templates/variables.ship-engine.example.json \
  --request templates/dashboard-request.example.json \
  --device-id tia-main-propulsion-live \
  --device-name MainPropulsionTIA \
  --view-id main-propulsion-overview \
  --view-name "主推进系统 · 博途联调" \
  --out-dir out

# 3) 看预览确认版式（这一步只是给人看）
#    out/dashboard-preview.svg

# 4) 校验，重点看有没有 "static picture" 报错
node scripts/validate-dashboard.mjs \
  --plan out/dashboard-plan.json \
  --view out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json

# 5) 先 dry-run，再 apply
node scripts/apply-to-fuxa.mjs --url http://8.153.154.62:1881 --patch out/fuxa-charts.patch.json
node scripts/apply-to-fuxa.mjs --url http://8.153.154.62:1881 --patch out/fuxa-view.patch.json
node scripts/apply-to-fuxa.mjs --url http://8.153.154.62:1881 --patch out/fuxa-view.patch.json --apply

# 6) 回读确认六个寄存器都在跳
curl -s "http://8.153.154.62:1881/api/getTagValue?ids=%5B%22live-reg40001%22%5D"
```

---

## 常见问题

**Q：生成出来是空的 / 界面只有文字？**
检查三个容器 id 前缀：圆环仪表 `D-BAG_`、条形仪表 `A-GXP_`/`B-GXP_`、开关 `T-HXT_`、趋势 `D-HXC_`。缺容器 FUXA 什么都不挂。`validate-dashboard.mjs --view` 会把这种情况直接判成 ERROR。

**Q：仪表里彩色的弧不动？**
说明它没走 `svg-ext-html_bag`，而是被渲染成了静态 `<path>`。用新版的 `generate-dashboard.mjs` 重新生成，并在校验里确认存在 `svg-ext-html_bag` 项。

**Q：`variableSrc` 填错了。**
`property.variable` / `variableId` 填的是 FUXA **标签 id**；`property.variableSrc` 填的是 **设备名**（不是设备 id）。趋势曲线则通过顶层 `charts` 里的 `device` 字段绑定（那里填设备 id）。

**Q：apply 之后没生效？**
先确认 `charts` 补丁也应用了——`svg-ext-html_chart` 只带一个 chart id，曲线本体在 `charts` 集合里，少了它图表是空图。

**Q：`--apply` 安全吗？**
`apply-to-fuxa.mjs` 默认 dry-run；加 `--apply` 时会先把 `/api/project` 完整备份到 `backups/`。生产环境请用最小权限的 API Key，不要用管理员账号。
