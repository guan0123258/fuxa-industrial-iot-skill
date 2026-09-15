# Widget / Chart Catalog

This catalog is a **visual intent layer**. `scripts/lib/fuxa-view-renderer.mjs`
translates it into native FUXA view items. The table below is the contract that
renderer implements, verified against FUXA 1.3.4.

| Intent | Typical variables | Native FUXA element | Notes |
|---|---|---|---|
| `gauge` | bounded analog | `svg-ext-html_bag` (GaugeType 0) | circular gauge, needs `minValue`/`maxValue` |
| `rpm-gauge` | rpm | `svg-ext-html_bag` (GaugeType 0) | same as `gauge`, rpm range |
| `pressure-gauge` | pressure | `svg-ext-html_bag` (GaugeType 0) | same as `gauge`, pressure range |
| `thermometer` | temperature | `svg-ext-gauge_progress` | vertical bar: grey track + moving fill |
| `tank` | level/fuel/ballast | `svg-ext-gauge_progress` | level reads as a vertical fill |
| `progress` | percent/load | `svg-ext-gauge_progress` | bar + track |
| `kpi` | any numeric | `svg-ext-value` | + bound unit/caption text |
| `status` | bool/enum | `svg-ext-value` with step ranges | colour + text switch on 0/1 |
| `traffic-light` | state/severity | `svg-ext-value` with step ranges | same as `status` |
| `trend` | one series | `svg-ext-html_chart` + `charts` entry | source must keep 2h+ history |
| `multi-trend` | multiple series | `svg-ext-html_chart` + `charts` entry | one line per variable |
| `area` | history | `svg-ext-html_chart` + `charts` entry | treated as a trend |
| `equipment-matrix` | many statuses | one `svg-ext-value` per row | never a decorative dot |
| `switch` / writable bool | bool, writable | `svg-ext-html_switch` | only with explicit `writable: true` |
| `alarm-list` | alarms | *decorative* | requires a native alarm source or an API |
| `process-mimic` | pumps/valves/tanks | *decorative* + bound value chips | line art stays decor |
| `vessel-attitude`, `heading`, `map`, `image-mimic`, `table` | specialist | *decorative* or custom widget | must be reviewed |
| `sparkline`, `bar`, `horizontal-bar`, `donut` | numeric | `svg-ext-value` | aggregates need an analytics API |

> `svg-ext-gauge_progress` requires three children: `A-GXP_*` (track), `B-GXP_*`
> (fill, grown from the bottom) and `H-GXP_*` (container). `svg-ext-html_bag`
> requires a `D-BAG_*` container. `svg-ext-html_switch` requires `T-HXT_*`.
> `svg-ext-html_chart` requires `D-HXC_*`. Without the container FUXA mounts
> nothing and the widget silently stays blank.

## Hard rule: no static pictures for values

A rendered number or arc that nothing updates is worse than an empty widget,
because an operator will read it as plant state. Therefore:

1. Every widget that carries a variable **must** emit a native FUXA item bound
   to that variable. `scripts/lib/fuxa-view-renderer.mjs` enforces this by
   construction, and `scripts/validate-dashboard.mjs --view` fails the build when
   it is violated.
2. A circular gauge must draw the value as a coloured arc **over** a grey
   `strokeColor` arc on the same circle — overlapping, not side by side.
3. Values that never change on screen (frozen sample values, static arcs, drawn
   needles) belong in `dashboard-preview.svg` only. That file is a human
   preview; it is never applied to FUXA.
4. Intents with no tag binding (`alarm-list`, `process-mimic`) are allowed as
   decoration, but the generator emits an explicit warning for each one and they
   must not be presented as live data.

## Rule for aggregated BI charts

A `bar`, `donut`, ranking, day/month comparison or other aggregate chart must not pretend that a single telemetry point contains the required meaning. The dashboard request should specify an analytics endpoint/series or the agent should ask the industrial-cloud API layer for one.

## FUXA tag addressing

- `property.variable` / `property.variableId` hold the FUXA **tag id**.
- `property.variableSrc` holds the FUXA **device name** (not the device id).
- Trend series are bound through the top-level `charts` collection, where each
  line carries `{ id: tagId, device: deviceId, color }`. A chart element without
  a matching chart definition renders an empty plot — the validator treats that
  as an error.

