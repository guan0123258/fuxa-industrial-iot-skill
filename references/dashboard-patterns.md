# Dashboard Patterns

## 1. Layout principles

1. System hierarchy before decoration: overview, then equipment, then detail.
2. Status and alarms stay visible at all times.
3. Numbers stay readable even when gauges are used; a gauge never replaces the exact value.
4. Trends sit next to the equipment or KPI they explain.
5. State is never encoded by colour alone.

## 2. Presets

| Preset | Layout | Typical use |
|---|---|---|
| `plant-overview` | KPI row, equipment column, trend panel, alarm strip | whole-plant status |
| `production-overview` | primary metric row, key trend, system status, footer | one production line |
| `level-system` | process mimic with tank summary and level panel | tanks, pumps, valves |
| `alarm-center` | severity summary, active alarm list, detail panel | alarm operations |

Presets only define zones and scale. Widget choice comes from variable semantics.

## 3. Widget choice

| Data shape | Presentation |
|---|---|
| bounded analog with a known range | circular gauge plus a bound value |
| temperature | bar gauge or thermometer plus a trend |
| level or volume | bar gauge plus tank summary |
| boolean state | status value with step ranges |
| boolean control with a reviewed write path | switch |
| fast-moving analog | trend next to the equipment |
| many equipment states | matrix, one bound value per row |

## 4. Aggregates

A bar chart, donut, ranking or period comparison must not pretend that one telemetry point carries the required meaning. Request an analytics series from the platform layer, or present the raw value instead.
