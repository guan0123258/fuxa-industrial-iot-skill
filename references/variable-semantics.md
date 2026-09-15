# Variable Semantics

## 1. Precedence

Highest first:

1. Metadata supplied explicitly by the customer or project engineer: `semanticType`, `display`, engineering range, thresholds, `writable`.
2. Device and thing-model metadata from the cloud platform.
3. Operator-maintained mappings: parameter code, collection code, device model, tag code.
4. Name, unit and datatype heuristics.
5. Safe generic fallback.

## 2. Confidence

| Source | Confidence | Review |
|---|---|---|
| explicit | 1.00 | not required |
| operator override | configured, default 0.95 | below 0.70 requires review |
| unit and name agree | 0.92 | not required |
| unit only | 0.78 | not required |
| name only | 0.72 | not required |
| datatype fallback | 0.35 | required |

Anything below 0.70 sets `needsReview: true` and must not drive an alarm or a control.

## 3. Recognised intents

`temperature`, `pressure`, `rpm`, `current`, `voltage`, `power`, `energy`, `frequency`, `flow`, `level`, `fuel`, `humidity`, `vibration`, `runtime`, `torque`, `load`, `alarm`, `status`, `generic-number`, `text`.

Each carries a default display intent, for example `temperature` renders as `thermometer` plus `trend`, and `load` renders as `gauge` plus `trend`.

## 4. Write permission

`writable` is copied from the manifest only. It is never inferred from a name, a datatype or a display intent. A value that looks like a switch still renders as a read-only status element unless the metadata explicitly declares it writable.
