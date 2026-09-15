# Data Source Strategy

## 1. Principle

FUXA renders data; the cloud platform owns it. Choose the integration mode that keeps that boundary intact.

## 2. Modes

| Mode | Shape | Use when |
|---|---|---|
| WebAPI pull | FUXA reads a cloud-platform REST endpoint directly | current-value API is stable, authentication is straightforward, JSON shape is fixed |
| Read-only bridge | a small process polls the platform API and writes into pre-created FUXA tags | the platform API is read-only, changes independently, or needs reshaping |

The read-only bridge is the default recommendation: it isolates FUXA from upstream API churn and keeps the platform as the single writer.

## 3. History

Do not duplicate long-term history into FUXA when the platform already stores it. For aggregation, windows or comparisons, request an analytics endpoint from the platform layer and visualize the result.

FUXA's own chart history is suitable for short operational windows displayed next to the equipment that produces them.

## 4. Polling

Match the polling interval to the process, not to what the transport can sustain. A three-second interval is a safe starting point for cross-network Modbus forwarding; one-second polling has been observed to trigger internal timeouts in some FUXA and gateway combinations.

Verify a data path by checking that the timestamps advance across consecutive samples, not just that a value is present.

## 5. Boundaries

- Do not read the platform database directly; go through its API.
- Do not create a second writer to a device. If the gateway already owns the device connection, request values from the gateway instead of opening a parallel path.
- Confirm data freshness with the platform's own status fields before presenting a reading as live.
