---
name: fuxa-industrial-iot-skill
description: Design, generate, validate, inspect, and safely apply industrial SCADA/HMI dashboards to FUXA. Assumes device data stays in an upstream cloud platform and FUXA acts as the visualization layer. Supports version and capability probing, explicit-first variable semantics, layout presets, dry-run project patches, and API-to-tag bridging.
---

# FUXA Industrial IoT Skill

## 1. Scope

### 1.1 When to use this skill

Use it for tasks that create or change FUXA SCADA/HMI views, industrial dashboards, equipment mimics, trends, gauges, status panels, alarm pages, or an integration between an industrial cloud platform and FUXA.

### 1.2 Operating model

FUXA is a visualization layer, not the system of record.

```text
field devices -> edge gateway -> cloud platform -> FUXA
```

Device data remains in the upstream platform. The customer's cloud portal stays the product-facing entry point; FUXA may be embedded behind it or used as a visualization service. Do not bypass the cloud-platform API boundary to query the platform's database directly unless the user explicitly approves that architecture.

## 2. Workflow

1. **Understand the request and the data source.** Consume variable metadata whenever it is available; prefer an explicit variable manifest over inference.
2. **Probe before mutating.** Run `scripts/probe-fuxa.mjs` and `scripts/inspect-fuxa-project.mjs` to learn the version and the live project structure. Never assume the local FUXA instance matches a hard-coded version.
3. **Classify variables with explicit metadata first.** Use `scripts/classify-variables.mjs`; mark low-confidence semantics for review. Write permission is never inferred.
4. **Generate the plan, the preview and the view patch.** `scripts/generate-dashboard.mjs` writes `dashboard-plan.json`, `binding-plan.json`, `dashboard-preview.svg`, and the shipping artefacts `fuxa-view.patch.json` (`set-view`) plus `fuxa-charts.patch.json` (`charts`). The preview is for human review only.
5. **Validate before applying.** Run `scripts/validate-dashboard.mjs --plan ... --view ... --charts ...` and resolve duplicate ids, missing bindings, unsupported widgets, container-less gauges, and safety-sensitive low-confidence semantics.
6. **Apply with explicit intent.** `scripts/apply-to-fuxa.mjs` is dry-run by default. Use `--apply` only when the user asked for the project to change. The current `/api/project` is backed up before mutation. Apply the charts patch before, or together with, the view patch.

## 3. Variable semantics

Precedence, highest first:

1. `semanticType`, `display`, engineering range, thresholds and `writable` supplied explicitly by the customer or project engineer.
2. Device and thing-model metadata from the cloud platform.
3. Operator-maintained mappings for parameter code, collection code, device model or tag code.
4. Name, unit and datatype heuristics.
5. A safe generic fallback.

When the semantics stay uncertain, present the variable as a neutral KPI or text widget and mark `needsReview: true`.

## 4. Data modes

Prefer one of these two modes:

- **WebAPI pull** — FUXA reads a stable cloud-platform REST endpoint. Suitable for simple current-value APIs with straightforward authentication and a stable JSON shape.
- **Read-only bridge** — a small process polls the cloud-platform API and pushes current values into pre-created FUXA tags. This decouples FUXA from the upstream API shape and is the default recommendation when the platform API is read-only or changes independently.

Do not duplicate long-term history into FUXA if the cloud platform already owns it. For historical aggregation, request an analytics endpoint from the platform layer and visualize the result.

## 5. Widget intents

Available intents: `kpi`, `status`, `traffic-light`, `gauge`, `rpm-gauge`, `pressure-gauge`, `thermometer`, `tank`, `progress`, `sparkline`, `trend`, `multi-trend`, `bar`, `donut`, `table`, `alarm-list`, `equipment-matrix`, `process-mimic`, `map`, `text`, `image-mimic`.

Not every intent has a native FUXA widget on every release. Confirm capability on the target instance and degrade to a supported representation when needed. `references/widget-catalog.md` maps each intent to the FUXA element that renders it.

## 6. Rendering requirements

`scripts/lib/fuxa-view-renderer.mjs` is the single place that turns an intent into a FUXA element. Requirements it enforces:

1. Every widget that carries a variable emits at least one native, tag-bound FUXA item. A rendered value with no binding is a static picture, and `scripts/validate-dashboard.mjs --view` fails it.
2. An analog gauge draws the value as a coloured arc over a grey range arc on the same circle, so the two overlap rather than sit side by side.
3. Each widget keeps the mount container FUXA looks up by id prefix: `D-BAG_`, `A-GXP_`/`B-GXP_`, `T-HXT_`, `D-HXC_`. Without the container, FUXA mounts nothing.
4. Intents with no single tag to bind (`alarm-list`, `process-mimic`) are allowed as decoration; the generator emits a warning for each one and they must not be presented as live data.
5. A control widget requires `writable: true` from authoritative metadata plus a reviewed command path.

## 7. Safety

- Read-only is the default; use `--apply` only on explicit instruction.
- Back up `/api/project` before any project mutation and read it back afterwards.
- Never edit FUXA's internal database or configuration files as a shortcut.
- Never print passwords, API keys, JWTs or upstream secrets. Pass secrets through environment variables.
- TLS certificate verification is on by default; `--insecure` is for test hosts only.
- Do not expose the FUXA editor or admin surface directly to customer users unless the deployment architecture requires it. Prefer a reverse proxy or access isolation when embedding FUXA runtime views in a portal.

## 8. Key files

| Path | Purpose |
|---|---|
| `scripts/lib/fuxa-view-renderer.mjs` | intent to FUXA element, and view validation |
| `scripts/lib/dashboard-planner.mjs` | layout planning and presets |
| `scripts/lib/variable-classifier.mjs` | semantic classification |
| `scripts/lib/svg-renderer.mjs` | human-review preview only |
| `scripts/install-skill.mjs` | install into VS Code Copilot or Codex |
| `scripts/check-fuxa-fleet.mjs` | multi-instance version check |
| `references/widget-catalog.md` | intent to element contract |
| `docs/architecture.md` | architecture and data-source decisions |

Change widget behaviour in `fuxa-view-renderer.mjs`, not in the preview renderer, and keep `references/widget-catalog.md` in step with it. All scripts are dependency-free Node.js and require Node 18+.
