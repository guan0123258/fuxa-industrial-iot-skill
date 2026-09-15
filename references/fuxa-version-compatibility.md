# FUXA Version and Capability Strategy

Last verified: 2026-09-10.

## Principle

Do not use a single hard-coded FUXA version as the source of truth. FUXA project objects are flexible and some API schemas are intentionally permissive. Use three signals:

1. `/api/version` for a coarse release anchor.
2. endpoint probing for actual server capabilities;
3. `/api/project` and `/api/projectdemo` for the concrete object shapes available on the target server.

## Known public release anchors

| Release | Relevant notes for this skill |
|---|---|
| 1.2.8 | Public Web API/Swagger/API-key era; useful minimum anchor for API-managed workflows. |
| 1.3.0 | Documentation migration and expanded platform/data capabilities; do not assume old wiki paths. |
| 1.3.1 | HMI/widget/report/chart improvements. |
| 1.3.2 | Additional view/header parameters, alarm import/export and editor improvements. |
| 1.3.3 | Lazy-loaded views, map marker images, dynamic external images and more. |
| 1.3.4 | Reverse-proxy support, tag-driven move action, tag values in alarm text, security/runtime hardening. |

Current public latest verified: **v1.3.4**, released 2026-08-12.

## Endpoints to probe

The official OpenAPI currently documents endpoints including:

```text
GET  /api/version
POST /api/signin
GET  /api/settings
GET  /api/project
POST /api/project
POST /api/projectData
GET  /api/projectdemo
GET  /api/getTagValue
POST /api/setTagValue
GET/POST resource and DAQ-related APIs
```

Probe scripts treat 401/403 as "endpoint exists but authorization missing" where possible, and network/404 failures separately.

## Unknown newer versions

If version is newer than this file:

- do not reject it;
- probe the server;
- read the current project;
- create a dry-run patch only from verified shapes;
- if a required structure is not verifiable, stop before mutation and ask the operator to approve a manual sample or export.

## Sources

- https://github.com/frangoteam/FUXA/releases
- https://github.com/frangoteam/FUXA/blob/master/server/docs/openapi.yaml
- https://frangoteam.github.io/FUXA/
