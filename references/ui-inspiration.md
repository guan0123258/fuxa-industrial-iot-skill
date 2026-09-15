# UI Reference Index

## 1. Standards

Prefer published standards over vendor screenshots. They are stable, citable and free of branding concerns.

| Standard | Subject |
|---|---|
| ISA-101 | HMI design, philosophy and style |
| IEC 60073 | coding principles for indicators and actuators |
| EEMUA 191 | alarm systems design, management and procurement |
| ISO 9241-110 | interaction principles |
| NUREG-0700 | human-system interface design review guidelines |

## 2. Patterns worth reusing

- A dark, low-glare operational background for control-room displays.
- System hierarchy first: overview, equipment, detail.
- Persistent status and alarm visibility.
- Process topology drives mimic layout: equipment, then lines, then instruments.
- Exact numbers remain visible when gauges are present.
- Trends sit with the equipment they explain.
- Redundant state encoding: shape, position and text, not colour alone.
- Consistent alarm priority treatment, with the highest severity always reachable.

## 3. Scope note

This index is reference material. The presets shipped in `templates/dashboard-presets/` are original layouts built from the patterns above. Do not copy third-party screenshots or branded assets into a customer product without checking rights.
