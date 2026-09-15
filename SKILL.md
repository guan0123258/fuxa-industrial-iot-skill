---
name: fuxa-industrial-iot-skill
description: Design, generate, validate, inspect, and safely apply industrial SCADA/HMI dashboards to FUXA. Optimized for an industrial-cloud architecture where device data remains in an upstream IoT platform and FUXA acts as the visualization layer. Supports version/capability probing, explicit-first variable semantics, shipyard/marine presets, safe dry-run project patches, and API-to-FUXA tag bridging.
---

# FUXA Industrial IoT Skill

Use this skill when the user asks to create or modify FUXA dashboards, SCADA/HMI views, industrial BI-like pages, equipment mimics, trends, gauges, status panels, alarm pages, or a visualization integration between an industrial cloud and FUXA.

## Operating model

Assume FUXA is a **visualization/SCADA rendering layer**, not the system of record, unless the user explicitly says otherwise. For the reference architecture in this skill:

`Modbus TCP device -> EC100 edge gateway -> MQTT -> upstream IoT platform -> Kafka -> ClickHouse -> industrial-cloud API -> FUXA`

The customer's industrial-cloud UI remains the product-facing portal. FUXA may be embedded behind the portal or used as a visualization service. Do not bypass the industrial-cloud/API boundary to query ClickHouse directly unless the user explicitly approves that architecture.

## Mandatory workflow

1. **Understand the requested page and data source.** Ask for or consume variable metadata whenever available. Prefer an explicit variable manifest over inference.
2. **Probe FUXA before mutating it.** Run `node scripts/probe-fuxa.mjs ...` or inspect `/api/version`, `/api/project`, and supported endpoints. Never assume the local FUXA instance exactly matches a hard-coded version.
3. **Inspect existing project shapes.** For edits to a real instance, run `inspect-fuxa-project.mjs` and use the live project's structures as examples. Prefer schema learning/capability detection to version-only branching.
4. **Classify variables with explicit metadata first.** Use `classify-variables.mjs`; low-confidence semantics must be marked for review. Never infer write permission.
5. **Generate a dashboard plan, a preview and a real FUXA view.** Use `generate-dashboard.mjs`. It writes `dashboard-plan.json`, `binding-plan.json`, `dashboard-preview.svg`, **and** the shipping artefacts `fuxa-view.patch.json` (`set-view`) plus `fuxa-charts.patch.json` (`charts`). `dashboard-preview.svg` is a human preview only.
6. **Validate before apply.** Run `validate-dashboard.mjs --plan <plan> --view <fuxa-view.patch.json> --charts <fuxa-charts.patch.json>` and resolve duplicate IDs, missing bindings, unsupported widgets, container-less gauges, or low-confidence safety-sensitive semantics. A view that would render values nothing updates is rejected.
7. **Apply only with explicit intent.** `apply-to-fuxa.mjs` is dry-run by default. Use `--apply` only after the user asked to change the FUXA project. Back up `/api/project` before project mutation. Apply the charts patch before, or together with, the view patch.

## Variable semantics policy

Use this precedence:

1. `semanticType`, `display`, engineering range, thresholds, and `writable` explicitly supplied by the customer/user.
2. Industrial-cloud device/thing-model metadata.
3. Operator-maintained mappings for `parameterCode`, `collectionCode`, device model, or tag code.
4. Name + unit + datatype heuristic inference.
5. Safe generic fallback.

If semantics remain uncertain, use a neutral KPI/text/status presentation and set `needsReview: true`. A guessed variable must **never** become writable. A write/control widget requires `writable: true` from authoritative metadata plus a configured write path.

## Recommended data modes

Prefer one of these two modes:

- **WebAPI pull**: FUXA reads a stable industrial-cloud REST endpoint. Good for simple current-value APIs with straightforward authentication and JSON shape.
- **Read-only bridge**: a small process polls the industrial-cloud API and pushes current values into pre-created FUXA virtual tags. This decouples FUXA from upstream API shape and is the recommended default when the industrial-cloud API is read-only or changes independently.

Do not duplicate long-term history into FUXA just to draw analytics if ClickHouse/industrial-cloud already owns history. For complex historical aggregation, request an industrial-cloud analytics endpoint and visualize the result, or use a dedicated analytics surface alongside FUXA.

## Dashboard types

The planner may use these neutral widget intents: `kpi`, `status`, `traffic-light`, `gauge`, `rpm-gauge`, `pressure-gauge`, `thermometer`, `tank`, `progress`, `sparkline`, `trend`, `multi-trend`, `bar`, `donut`, `table`, `alarm-list`, `equipment-matrix`, `process-mimic`, `vessel-attitude`, `heading`, `map`, `text`, and `image-mimic`.

Not every intent is guaranteed to be a native FUXA widget on every release. When native support is missing, generate an SVG widget or degrade to a supported representation. Confirm capability on the target instance.

## Rendering rules: never ship a static picture

An operator reads whatever is on screen as plant state, so a value that nothing
updates is a defect, not a cosmetic issue.

- **The preview is not the deliverable.** `dashboard-preview.svg` exists so a
  human can review intent. It contains frozen sample values by design and must
  never be pushed into FUXA.
- **The deliverable is `fuxa-view.patch.json`.** Every widget that carries a
  variable is emitted as a native, data-bound FUXA element:
  - analog gauges → `svg-ext-html_bag` (GaugeType 0), where the coloured arc is
    the value and the grey `strokeColor` arc is the remaining range, drawn on the
    same circle so the two **overlap** rather than sit side by side;
  - thermometer / tank / progress → `svg-ext-gauge_progress` (grey track plus a
    fill that grows from the bottom);
  - kpi / status → `svg-ext-value` with unit or step ranges;
  - writable booleans (only with explicit `writable: true`) →
    `svg-ext-html_switch`;
  - trends → `svg-ext-html_chart` plus a `charts` definition that binds each
    line to a device tag.
- **Keep each widget's mount container.** FUXA mounts a widget into a child
  element it finds by id prefix (`D-BAG_`, `B-GXP_`/`A-GXP_`, `T-HXT_`,
  `D-HXC_`). A widget without its container renders blank, and the validator
  fails that case.
- **Decorative intents are allowed but must be labelled.** `alarm-list` and
  `process-mimic` have no single tag to bind; the generator warns for each one
  and they must not be presented as live data.
- **No inferred write paths.** A control widget requires `writable: true` from
  authoritative metadata plus a reviewed command path.

See `references/widget-catalog.md` for the full intent → element contract.


## Marine presets

Use the provided original presets as starting points:

- `vessel-overview`: fleet/vessel operational overview with KPIs, system status, trends and alarms.
- `engine-room`: main/auxiliary engine room metrics, gauges and subsystem status.
- `ballast-system`: tanks, pumps, valves, levels, pressure and schematic flow.
- `alarm-center`: active alarms, severity summary, source/system grouping and recent trend.

These are original layouts informed by common marine HMI patterns; do not copy third-party screenshots or branded UI assets.

## FUXA compatibility policy

The reference implementation was verified against public FUXA documentation through v1.3.4, but the skill must not reject a newer version merely because it is unknown. Probe endpoints and project structures. Treat these as anchors, not hard gates:

- v1.2.8 introduced documented Web API/Swagger and API-key management.
- v1.3.0 moved documentation and expanded data/history capabilities.
- v1.3.1-v1.3.4 added multiple HMI, view, widget, reverse-proxy, and security improvements.

Use `references/fuxa-version-compatibility.md` for details.

## Safety and change control

- Read-only is the default.
- TLS certificate verification is on by default; `--insecure` is test-only.
- Never print passwords, API keys, JWTs, or upstream secrets.
- Never edit FUXA's internal database/config files as a shortcut.
- Back up the current project before project mutation.
- Never create writeback/control behavior based solely on inferred semantics.
- Do not expose the FUXA editor/admin surface directly to customer users unless the deployment architecture explicitly requires it.
- Prefer reverse proxy and access isolation when embedding FUXA runtime views in the industrial-cloud portal.

## Key files

For multi-instance version checks use `scripts/check-fuxa-fleet.mjs`. Read `README.md` for the package overview and `docs/INSTALL.md` for installation. For architecture decisions use `docs/ARCHITECTURE.md`. For a shipyard quick start use `docs/QUICKSTART_SHIPYARD.md`.

`scripts/lib/fuxa-view-renderer.mjs` is the single place that decides how an intent becomes a FUXA element. Change widget behaviour there, not in the preview renderer, and keep `references/widget-catalog.md` in step with it.

Use the scripts in `scripts/` rather than rewriting one-off clients. All scripts are dependency-free Node.js and require Node 18+.
