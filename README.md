# FUXA Industrial IoT Skill

A clean-room, extended Agent Skill for turning FUXA into an **AI-configurable industrial SCADA/HMI visualization layer** behind an existing industrial cloud.

This package was designed for a real marine/shipyard-style topology:

```text
Modbus TCP equipment
        |
        v
EC100 edge gateway
        | MQTT
        v
Upstream IoT platform (multi-tenant device + model management)
        | Kafka
        v
ClickHouse time-series storage
        |
        | upstream/internal APIs
        v
Customer-facing Industrial Cloud
        |
        | read APIs / normalized data contract
        v
FUXA visualization runtime
```

The upstream IoT platform remains the source of truth. The customer does not need direct access to it. FUXA is used to build vessel dashboards, engine-room pages, ballast/process mimics, gauges, trends, status panels and alarm views. The Skill lets an AI agent create those outputs more consistently and, after validation, safely patch a FUXA instance.

## Why this exists

The public `HugeShao/Fuxa-automation-skill` is a useful proof of concept, but it is closely tied to a particular FUXA-era project model. This package keeps the useful idea—operate FUXA through its REST API—but changes the design in several important ways:

- probes the target FUXA instance and capabilities before mutation;
- learns current project/view shapes from the live project instead of relying only on fixed structures;
- treats customer-declared variable meaning as authoritative and inference as a fallback;
- never infers write permission;
- adds an industrial-cloud read-only bridge mode;
- adds original marine dashboard presets and a neutral dashboard-spec layer;
- defaults all FUXA mutations to dry-run + backup;
- verifies TLS certificates by default;
- keeps ClickHouse/upstream data ownership outside FUXA unless explicitly changed.

## Included

```text
fuxa-industrial-iot-skill/
├── SKILL.md
├── README.md
├── package.json
├── agents/openai.yaml
├── docs/
│   ├── INSTALL.md
│   ├── ARCHITECTURE.md
│   └── QUICKSTART_SHIPYARD.md
├── references/
│   ├── fuxa-version-compatibility.md
│   ├── variable-semantics.md
│   ├── dashboard-patterns.md
│   ├── widget-catalog.md
│   ├── data-source-strategy.md
│   ├── ui-inspiration.md
│   └── security.md
├── templates/
│   ├── industrial-cloud.config.example.json
│   ├── variables.ship-engine.example.json
│   ├── semantic-overrides.example.json
│   ├── dashboard-request.example.json
│   └── dashboard-presets/
├── scripts/
│   ├── probe-fuxa.mjs
│   ├── check-fuxa-fleet.mjs
│   ├── inspect-fuxa-project.mjs
│   ├── classify-variables.mjs
│   ├── generate-dashboard.mjs
│   ├── validate-dashboard.mjs
│   ├── generate-internal-device.mjs
│   ├── apply-to-fuxa.mjs
│   └── industrial-cloud-bridge.mjs
└── tests/
    └── run-tests.mjs
```

## Fast start

```bash
cd fuxa-industrial-iot-skill
npm test

# 1) Classify a variable manifest
node scripts/classify-variables.mjs \
  --input templates/variables.ship-engine.example.json \
  --overrides templates/semantic-overrides.example.json \
  --out examples/generated/classified-variables.json

# 2) Generate an original dashboard plan, a review preview, and the real
#    FUXA view patch (native widgets bound to tags)
node scripts/generate-dashboard.mjs \
  --variables templates/variables.ship-engine.example.json \
  --request templates/dashboard-request.example.json \
  --device-id main-propulsion \
  --device-name MainPropulsionTIA \
  --view-id main-propulsion-overview \
  --view-name "主推进系统" \
  --out-dir examples/generated

# 3) Validate the plan AND the generated FUXA view
node scripts/validate-dashboard.mjs \
  --plan examples/generated/dashboard-plan.json \
  --view examples/generated/fuxa-view.patch.json \
  --charts examples/generated/fuxa-charts.patch.json
```

`generate-dashboard.mjs` writes two kinds of output:

| File | Purpose |
|---|---|
| `dashboard-preview.svg` | human review only — contains frozen sample values, never apply it |
| `fuxa-view.patch.json` | the deliverable: a `set-view` patch whose elements are native, data-bound FUXA widgets |
| `fuxa-charts.patch.json` | `charts` patch defining the trend series referenced by the view |

Analog gauges ship as `svg-ext-html_bag`, where the coloured arc is the value
and the grey `strokeColor` arc is the remaining range on the same circle, so the
progress overlaps the background track. `validate-dashboard.mjs --view` fails the
build if any value widget would render without a tag binding.


To work against a real FUXA instance, probe it first:

```bash
FUXA_API_KEY='***' node scripts/probe-fuxa.mjs \
  --url https://fuxa.example.com \
  --api-key-env FUXA_API_KEY \
  --out fuxa-capabilities.json
```

Then inspect the current project:

```bash
FUXA_API_KEY='***' node scripts/inspect-fuxa-project.mjs \
  --url https://fuxa.example.com \
  --api-key-env FUXA_API_KEY \
  --out fuxa-project-inspection.json
```

See `docs/INSTALL.md` and `docs/QUICKSTART_SHIPYARD.md` for the complete flow.

## Integration recommendation for your current read-only industrial cloud

For a customer-facing industrial cloud that currently only **reads** upstream platform data, start with the supplied read-only bridge:

```text
industrial-cloud snapshot API
          |
          | GET (read only)
          v
industrial-cloud-bridge.mjs
          |
          | FUXA /api/setTagValue
          v
FUXA internal/virtual tags
          |
          v
FUXA view bindings
```

This avoids coupling every FUXA widget to the upstream API JSON shape. When your industrial cloud later adds authoritative write/control APIs, add a separate, explicitly permissioned write path; do not silently reuse the read bridge for control.

## FUXA support philosophy

The package is **capability-first** rather than "version string says yes/no." It checks `/api/version`, attempts supported read endpoints, and inspects the live project. Current public FUXA documentation exposes `/api/version`, `/api/project`, `/api/projectData`, tag value APIs, resources and other endpoints. The latest public GitHub release verified while this package was prepared was v1.3.4 (2026-08-12).

Unknown newer versions are not automatically rejected. The agent should probe and adapt, and should stop before mutation if a required structure cannot be verified.

## Credits and source references

Concept inspiration: https://github.com/HugeShao/Fuxa-automation-skill

FUXA project: https://github.com/frangoteam/FUXA

FUXA OpenAPI: https://github.com/frangoteam/FUXA/blob/master/server/docs/openapi.yaml

FUXA docs: https://frangoteam.github.io/FUXA/

This package is a clean-room implementation and does not copy the original repository's client code. Check the licenses of FUXA and any other component before distribution in your product.

## Check multiple FUXA machines against the latest public release

```bash
node scripts/check-fuxa-fleet.mjs \
  --config templates/fuxa-instances.example.json \
  --out fuxa-fleet-report.json
```

Use `--offline` to skip GitHub and compare against the configured fallback release anchor.
