# Data Source Strategy

## Mode A — direct FUXA WebAPI pull

Use when:

- endpoint shape is stable;
- authentication is simple and safe to configure in FUXA;
- polling load is acceptable;
- no cross-tenant secret should be exposed to FUXA clients.

Advantages: fewer moving parts. Disadvantages: FUXA becomes coupled to endpoint paths and authentication details.

## Mode B — industrial-cloud bridge (recommended starting point)

The bridge polls the industrial-cloud snapshot API server-side and pushes only normalized current values to FUXA tags.

Advantages:

- stable FUXA tag IDs;
- isolates upstream JSON/authentication changes;
- centralized retry/stale/error handling;
- natural place to apply tenant/device mapping;
- read-only upstream flow is easy to audit.

Disadvantages: one extra small service/process.

## Mode C — direct ClickHouse

Not recommended as the default in this architecture. It bypasses the product API boundary, couples visualization to storage schema, and complicates tenant authorization. Use only for deliberate internal analytics deployments.

## History

For long-term history, expose endpoints such as:

```text
GET /api/v1/devices/{id}/timeseries?keys=...&start=...&end=...&interval=5m&agg=avg
GET /api/v1/fleets/{id}/kpis?period=30d
GET /api/v1/alarms/summary?groupBy=system&period=7d
```

Let ClickHouse do aggregation. FUXA renders the operational result; it should not have to reimplement your warehouse semantics.
