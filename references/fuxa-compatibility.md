# FUXA Compatibility

## 1. Approach

Probe the target instance; do not gate on a hard-coded version. The reference implementation was verified against public FUXA documentation through v1.3.4, but a newer version must not be rejected merely because it is unknown.

## 2. Probes

| Endpoint | Purpose |
|---|---|
| `GET /api/version` | installed version |
| `GET /api/project` | current project structure |
| `GET /api/settings` | server settings |
| `POST /api/signin` | token when API keys are not used |
| `GET /api/getTagValue?ids=[...]` | current tag values |
| `POST /api/setTagValue` | write tag values |
| `POST /api/projectData` | project mutation, `{ cmd, data }` |

Project mutation commands used by this skill: `set-device`, `del-device`, `set-view`, `del-view`, `charts`, `layout`.

## 3. Version anchors

| Version | Change |
|---|---|
| 1.2.8 | documented Web API and API-key management |
| 1.3.0 | documentation moved, data and history capabilities expanded |
| 1.3.1 – 1.3.4 | multiple HMI, view, widget, reverse-proxy and security improvements |

Treat these as anchors, not gates. Capability detection beats version branching.

## 4. SVG widgets

Types observed in a running 1.3.4 instance: `svg-ext-value`, `svg-ext-gauge_progress`, `svg-ext-gauge_semaphore`, `svg-ext-html_bag`, `svg-ext-html_chart`, `svg-ext-html_graph`, `svg-ext-html_switch`, `svg-ext-html_slider`, `svg-ext-html_input`, `svg-ext-html_select`, `svg-ext-html_button`, `svg-ext-own_ctrl-panel`, `svg-ext-own_ctrl-table`, `svg-ext-own_ctrl-iframe`, `svg-ext-own_ctrl-image`, `svg-ext-own_ctrl-video`, `svg-ext-pipe`, `svg-ext-proceng`, `svg-ext-ape`, `svg-ext-shapes`.

Confirm the set on the target instance before relying on an element.
