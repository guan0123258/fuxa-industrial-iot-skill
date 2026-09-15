# FUXA Industrial IoT Skill

![license](https://img.shields.io/badge/license-MIT-blue.svg)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![dependencies](https://img.shields.io/badge/dependencies-0-success.svg)
![tests](https://img.shields.io/badge/tests-11%20passed-success.svg)

> Turns cloud-platform device variables into FUXA elements that are **actually bound to live data**.

[中文](./README-CN.md) · [Docs](./docs) · [Issues](https://github.com/guan0123258/fuxa-industrial-iot-skill/issues)

---

## 1. Overview

### 1.1 Positioning

FUXA is a visualization layer, not a data source. This skill gives an AI agent (GitHub Copilot, Codex, …) a verifiable workflow that translates cloud-platform device variables into FUXA HMI views:

- **Probe** the target FUXA version and existing project shape instead of assuming them
- **Classify** variable semantics, with customer declarations taking precedence over name heuristics
- **Generate** chart definitions and a view patch whose items are native FUXA widgets
- **Validate** binding completeness before anything is applied
- **Apply** through dry-run, with a pre-mutation backup and a post-mutation read-back

### 1.2 Data path

```text
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Field   │───▶│  Edge    │───▶│  Cloud   │───▶│   FUXA   │
  │  devices │    │  gateway │    │ platform │    │   HMI    │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
    Modbus/OPC      collect &        API /          views &
                    forward          history        trends
```

Device data stays in the upstream platform; FUXA renders it. The skill never bypasses the cloud-platform boundary to reach a device directly.

### 1.3 Artefacts

| File | Purpose |
|---|---|
| `dashboard-plan.json` | widget layout and variable bindings |
| `dashboard-preview.svg` | **human review only** — holds frozen sample values, never applied to FUXA |
| `fuxa-view.patch.json` | the deliverable: a `set-view` patch whose items are all native, tag-bound widgets |
| `fuxa-charts.patch.json` | the `charts` patch defining the trend series the view references |

---

## 2. Quick start

### 2.1 Requirements

Node.js 18 or newer. No third-party dependencies.

```bash
node -v
npm test          # 11 self-checks
```

### 2.2 Generate

```bash
node scripts/generate-dashboard.mjs \
  --variables templates/variables.example.json \
  --request   templates/dashboard-request.example.json \
  --device-id   production-line-01 \
  --device-name ProductionLine \
  --view-id     production-overview \
  --view-name   "Production overview" \
  --out-dir     out
```

`--device-id`, `--device-name`, `--view-id` and `--view-name` must match devices and views that already exist in the target FUXA project.

### 2.3 Validate

```bash
node scripts/validate-dashboard.mjs \
  --plan   out/dashboard-plan.json \
  --view   out/fuxa-view.patch.json \
  --charts out/fuxa-charts.patch.json
```

Validation rejects any widget that carries a variable but has no native, tag-bound FUXA element.

### 2.4 Apply

```bash
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-charts.patch.json
node scripts/apply-to-fuxa.mjs --url http://fuxa.example.com --patch out/fuxa-view.patch.json --apply
```

Dry-run by default. With `--apply` the current `/api/project` is backed up to `backups/` first.

---

## 3. Widget types

| Intent | FUXA element | Notes |
|---|---|---|
| `gauge` `rpm-gauge` `pressure-gauge` | `svg-ext-html_bag` | circular gauge: coloured arc is the value, grey arc the remaining range, overlapping on one circle |
| `thermometer` `tank` `progress` | `svg-ext-gauge_progress` | bar gauge: grey track plus a fill growing from the bottom |
| `kpi` `status` `traffic-light` | `svg-ext-value` | value text with unit and range colours |
| writable boolean | `svg-ext-html_switch` | only when the variable declares `writable: true` |
| `trend` `multi-trend` | `svg-ext-html_chart` | chart element plus a `charts` series definition |
| `equipment-matrix` | `svg-ext-value` rows | one real binding per row |
| `alarm-list` `process-mimic` | decoration | no single tag to bind; the generator warns per widget |

Full contract: [`references/widget-catalog.md`](./references/widget-catalog.md).

---

## 4. Install into an AI client

### 4.1 GitHub Copilot (VS Code)

```powershell
node scripts/install-skill.mjs --target vscode --scope user
node scripts/install-skill.mjs --target vscode --scope project --project <repo>
```

User scope installs to `%APPDATA%\Code\User\prompts\skills\`; project scope installs to `<repo>\.github\skills\`. Reload the VS Code window afterwards.

### 4.2 Codex

```powershell
node scripts/install-skill.mjs --target codex --scope user
node scripts/install-skill.mjs --target codex --scope project --project <repo>
```

User scope installs to `~/.agents/skills/`; project scope installs to `<repo>\.agents\skills\` and maintains `AGENTS.md` at the repository root.

Then simply ask in natural language:

```text
Use fuxa-industrial-iot-skill to build a production line view,
circular gauges for analog values, 2-hour trends, validate before applying.
```

---

## 5. Layout

```text
fuxa-industrial-iot-skill/
├── SKILL.md                  agent workflow specification
├── README.md                 GitHub landing index (Chinese)
├── README-CN.md              Chinese
├── README-EN.md              this file
├── agents/openai.yaml        client metadata
├── docs/                     architecture, install, quick start
├── references/               widget contract, variable semantics, data sources, security
├── templates/                layout presets and request examples
├── scripts/                  command line tools
├── examples/generated/       sample output
└── tests/                    regression tests
```

---

## 6. Safety and change control

| Item | Default |
|---|---|
| FUXA writes | dry-run, `--apply` required |
| Before mutation | full `/api/project` backup |
| After mutation | read back the project and verify items and bindings |
| Write control | explicit `writable: true` only, never inferred |
| Secrets | environment variables, never committed |
| TLS | certificate verification on; `--insecure` for test hosts only |

---

## 7. Documentation

| Document | Content |
|---|---|
| [`docs/architecture.md`](./docs/architecture.md) | architecture and data-source strategy |
| [`docs/install.md`](./docs/install.md) | install, usage and troubleshooting |
| [`docs/quickstart.md`](./docs/quickstart.md) | ten-minute walkthrough |
| [`references/widget-catalog.md`](./references/widget-catalog.md) | intent-to-element contract |
| [`references/variable-semantics.md`](./references/variable-semantics.md) | semantic precedence policy |
| [`references/security.md`](./references/security.md) | security boundaries and writeback policy |

---

## 8. License

MIT. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
