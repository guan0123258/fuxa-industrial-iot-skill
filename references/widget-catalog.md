# Widget Contract

## 1. Intent to element

`scripts/lib/fuxa-view-renderer.mjs` implements this contract. Verified against FUXA 1.3.4.

| Intent | Native FUXA element | Notes |
|---|---|---|
| `gauge`, `rpm-gauge`, `pressure-gauge` | `svg-ext-html_bag` (GaugeType 0) | requires `minValue` and `maxValue` |
| `thermometer`, `tank`, `progress` | `svg-ext-gauge_progress` | grey track plus a fill growing from the bottom |
| `kpi`, `sparkline`, `bar`, `horizontal-bar`, `donut` | `svg-ext-value` | aggregates need an analytics API |
| `status`, `traffic-light` | `svg-ext-value` with step ranges | colour and text switch on 0/1 |
| writable boolean | `svg-ext-html_switch` | only with explicit `writable: true` |
| `trend`, `multi-trend`, `area` | `svg-ext-html_chart` + a `charts` entry | source must keep history |
| `equipment-matrix`, `status-grid` | one `svg-ext-value` per row | never a decorative dot |
| `alarm-list` | decoration | needs a native alarm source or an API |
| `process-mimic` | decoration plus bound value chips | line art stays decoration |
| `map`, `table`, `image-mimic` | decoration or a custom widget | review before applying |

## 2. Mount containers

FUXA mounts a widget into the child element it finds by id prefix. Without the container the widget silently renders nothing.

| Element | Container ids | Role |
|---|---|---|
| `svg-ext-html_bag` | `D-BAG_<id>` | canvas gauge |
| `svg-ext-gauge_progress` | `A-GXP_<id>` track, `B-GXP_<id>` fill, `H-GXP_<id>` holder | bar gauge; `A-` defines the scale, `B-` grows from the bottom |
| `svg-ext-value` | bound element itself | text |
| `svg-ext-html_switch` | `T-HXT_<id>` | control |
| `svg-ext-html_chart` | `D-HXC_<id>` | trend or chart |

## 3. Circular gauge configuration

| Option | Meaning |
|---|---|
| `colorStart` / `colorStop` | the coloured value arc |
| `strokeColor` | the grey arc covering the remaining range |
| `minValue` / `maxValue` | range mapping |
| `pointer` | needle length, width and colour |
| `angle` | sweep, `0` gives a half circle |
| `lineWidth`, `radiusScale` | thickness and radius |
| `fontSize` | `0` hides the canvas readout when a bound `svg-ext-value` shows the number |
| `type` | `0` Gauge, `1` Donut, `2` Zones |

The coloured arc and the grey arc are drawn on the same circle, so progress overlaps the background track.

## 4. Tag addressing

| Field | Holds |
|---|---|
| `property.variable`, `property.variableId` | the FUXA tag id |
| `property.variableSrc` | the FUXA device **name** |
| `charts[].lines[].device` | the FUXA device **id** |
| `charts[].lines[].id` | the FUXA tag id |

A chart element without a matching `charts` definition renders an empty plot; validation treats that as an error.
