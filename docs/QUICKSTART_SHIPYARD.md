# Shipyard Quick Start

This example assumes one vessel and a main-engine monitoring page.

## Step 1: prepare authoritative variable metadata

The customer or project engineer should supply as much as possible:

```json
{
  "id": "mainEngine.exhaustTemp",
  "name": "主机排气温度",
  "parameterCode": "40002",
  "unit": "°C",
  "dataType": "number",
  "semanticType": "temperature",
  "engineeringRange": { "min": 0, "max": 150 },
  "display": ["thermometer", "trend"],
  "writable": false
}
```

`semanticType`, `display`, range and thresholds are optional, but explicit values win over inference.

## Step 2: classify

```bash
node scripts/classify-variables.mjs \
  --input templates/variables.ship-engine.example.json \
  --overrides templates/semantic-overrides.example.json \
  --out ./classified.json
```

Review every entry where `needsReview=true`.

## Step 3: generate the page

```bash
node scripts/generate-dashboard.mjs \
  --variables templates/variables.ship-engine.example.json \
  --request templates/dashboard-request.example.json \
  --out-dir ./ship-dashboard
```

Outputs:

```text
ship-dashboard/
├── classified-variables.json
├── dashboard-plan.json
├── binding-plan.json
└── dashboard-preview.svg
```

The preview is intentionally independent from FUXA internals. It allows customer/product review before an agent translates the approved plan into the exact target FUXA project structure.

## Step 4: probe and inspect FUXA

```bash
node scripts/probe-fuxa.mjs --url http://fuxa-host:1881 --out probe.json
node scripts/inspect-fuxa-project.mjs --url http://fuxa-host:1881 --out project.json
```

If security is enabled, provide credentials/API key via environment variables.

## Step 5: create virtual tags or WebAPI bindings

For bridge mode, generate an internal device proposal:

```bash
node scripts/generate-internal-device.mjs \
  --variables ./ship-dashboard/classified-variables.json \
  --device-id ship01-main-engine \
  --device-name "船舶01-主机" \
  --out ./ship-dashboard/internal-device.patch.json
```

Inspect the patch against the target project's actual device shape before applying it.

## Step 6: bind the industrial-cloud API

Edit `industrial-cloud.config.example.json` so each upstream JSON path maps to the FUXA tag ID created in step 5.

Run `--dry-run --once` first. Confirm values are correctly normalized. Then enable the bridge.

## Step 7: translate the approved plan to FUXA

The agent should use `project.json` and the target version/capability report to create a `set-view`, `charts`, `graphs`, or resource patch matching that instance. Do not blindly reuse a payload from a different FUXA version or project.

## Suggested first ship pages

- Vessel overview: online status, engine/power/ballast summary, active alarms, 24h key trends.
- Engine room: RPM, temperatures, pressures, currents, running hours, generator/auxiliary status.
- Ballast: tank levels, pump/valve states, draft/trim/list, line schematic, alarm states.
- Alarm center: severity counts, active alarms, recent events and affected equipment.
