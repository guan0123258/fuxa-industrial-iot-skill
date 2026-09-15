# Architecture for an Industrial Cloud + FUXA

## Current target topology

```text
[Shipboard / factory equipment]
      Modbus TCP
          |
          v
[EC100 edge gateway]
      MQTT telemetry
          |
          v
[Upstream IoT platform]
  - multi-tenant device registry
  - parameter/thing model
  - Kafka internal stream
  - ClickHouse time-series
  - internal BI
          |
          | read APIs
          v
[Customer-facing Industrial Cloud]
  - customer tenant boundary
  - device pages
  - parameter pages
  - customer authorization
  - API normalization
          |
          +--------------------+
          |                    |
          v                    v
 [Business UI]          [FUXA visualization]
                         - HMI / SCADA pages
                         - vessel/system mimic
                         - real-time gauges
                         - trends/status/alarm UI
```

## Responsibility boundaries

### Upstream IoT platform

Owns device ingestion, multi-tenant master data, Kafka/ClickHouse and authoritative telemetry history. It is not exposed directly to customers.

### Industrial cloud

Owns the customer-facing authorization boundary and product API. Even if the current implementation mirrors upstream capabilities, this layer should become the stable contract for customer applications.

### FUXA

Owns visual composition and HMI interaction. It should not become an accidental second system of record. FUXA can maintain short/local DAQ history when useful, but long-term analytics should stay upstream unless there is a deliberate migration.

## Recommended phase 1: read-only visualization

Use a normalized snapshot endpoint in the industrial cloud, for example:

```http
GET /api/v1/devices/{deviceId}/telemetry/latest
```

Return stable IDs plus engineering metadata:

```json
{
  "deviceId": "ME-01",
  "ts": 1789027200000,
  "values": {
    "exhaust_temp": 72.6,
    "oil_pressure": 4.8,
    "rpm": 1830,
    "running": true
  }
}
```

Then either let FUXA WebAPI consume it directly or use the bridge in this package to update virtual/internal FUXA tags.

## Why bridge mode is often better initially

A bridge gives FUXA stable tags such as `ship01.mainEngine.rpm` even if the industrial-cloud JSON changes. It also creates one place to handle token refresh, tenant context, retries, data normalization and stale-data policy.

It is deliberately one-way in the current design:

```text
Industrial Cloud GET -> Bridge -> FUXA tags
```

It does not send commands back to equipment.

## Historical charts

There are three strategies:

1. **FUXA local DAQ** — simplest for local short-term trends, but duplicates telemetry.
2. **Industrial-cloud analytics endpoint** — preferred for ClickHouse-backed day/week/month aggregation, cross-device comparison and reports.
3. **Dedicated BI/analytics surface** — use Grafana/Superset/other analytics next to FUXA for deep OLAP-style exploration.

A good industrial cloud may use FUXA for SCADA/HMI and a separate analytics component for BI, while presenting both under one product UI.

## Embedding

If FUXA is embedded into the customer portal, put it behind your reverse proxy and authorization boundary. Expose runtime views, not the editor/admin interface. Keep tenant separation explicit; do not rely only on a view URL as an authorization mechanism.
