# Dashboard Patterns

## Neutral widget intents

The dashboard plan is deliberately independent of FUXA's internal widget schema. The agent first produces approved visual intent, then translates it to native FUXA items/SVG widgets after probing the target instance.

| Intent | Typical use |
|---|---|
| `kpi` | Current value, totals, running hours, efficiency. |
| `status` / `traffic-light` | Running/stopped/fault/online. |
| `gauge` | Bounded pressure/current/voltage/load. |
| `rpm-gauge` | Rotational speed. |
| `thermometer` | Temperature. |
| `tank` | Tank/level/fuel/ballast percentage. |
| `trend` / `multi-trend` | Time-series behavior. |
| `bar` / `donut` | Aggregated counts or composition from an analytics API. |
| `alarm-list` | Active/recent alarms. |
| `equipment-matrix` | Many pumps/generators/auxiliaries at a glance. |
| `process-mimic` | Pipes, valves, pumps, tanks and process flow. |
| `vessel-attitude` | Draft/trim/list/stability summary. |
| `heading` | Heading/compass-like display. |

## Layout rules

- Put alarm/unsafe states where they remain visible without scrolling.
- Prefer status + numeric value together over color-only encoding.
- Use engineering units next to values.
- Use consistent semantic locations across vessel pages (alarm summary, navigation, time/staleness).
- Avoid decorative gauges when a precise KPI + trend is more informative.
- For 20+ variables, group by system/equipment rather than filling the page with gauges.
- Distinguish "data stale/offline" from a valid process value of zero.

## BI boundary

FUXA is excellent for real-time operational visualization and industrial mimics. For Top-N across hundreds of devices, month-over-month analysis, arbitrary SQL, pivot/drill-down, and OLAP, obtain aggregated data from ClickHouse through the industrial-cloud API or use a dedicated BI surface.
