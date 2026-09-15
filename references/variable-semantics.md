# Variable Semantics

## Authoritative-first contract

A variable can contain:

```json
{
  "id": "mainEngine.rpm",
  "name": "主机转速",
  "parameterCode": "40004",
  "collectionCode": "4",
  "unit": "rpm",
  "dataType": "number",
  "semanticType": "rpm",
  "engineeringRange": { "min": 0, "max": 2400 },
  "thresholds": { "warningHigh": 2100, "alarmHigh": 2250 },
  "display": ["rpm-gauge", "trend"],
  "writable": false,
  "source": { "path": "values.rpm" }
}
```

The fields `semanticType`, `display`, `engineeringRange`, `thresholds`, and `writable` should be provided by the customer/project engineer whenever available.

## Inference order

1. Explicit semantic metadata.
2. Operator overrides keyed by variable ID, parameter code, collection code, or name.
3. Unit inference (`°C`, `bar`, `rpm`, `A`, `V`, `kW`, `%`, etc.).
4. Chinese/English name inference.
5. Generic fallback based on datatype.

## Safe defaults

- Unknown numeric -> KPI + trend.
- Unknown boolean -> status indicator.
- Unknown string -> text/table.
- No guessed field becomes writable.
- Inference confidence below 0.70 -> `needsReview=true`.

## Typical marine semantics

`temperature`, `pressure`, `rpm`, `speed`, `current`, `voltage`, `power`, `energy`, `frequency`, `flow`, `level`, `fuel`, `humidity`, `vibration`, `runtime`, `status`, `alarm`, `heading`, `draft`, `trim`, `list`, `torque`, `load`.

The supplied classifier is intentionally conservative. Expand `semantic-overrides.example.json` with your own parameter-code dictionary as your platform matures.
