# Installation

## 1. Requirements

- Node.js 18 or newer.
- A reachable FUXA server when you want to probe/apply a real instance.
- Prefer an FUXA API key with the minimum required permissions. Username/password login is supported by the client, but secrets should be passed through environment variables.
- A stable industrial-cloud API endpoint if using bridge mode.

No npm dependencies are required.

## 2. Install as an Agent Skill

The portable unit is this entire folder, with `SKILL.md` at the root: the agent
needs `scripts/` and `references/` too, not just `SKILL.md`.

### One-command install (recommended)

```bash
# VS Code / GitHub Copilot, current OS user
node scripts/install-skill.mjs --target vscode --scope user

# Codex, current OS user
node scripts/install-skill.mjs --target codex --scope user

# Either client, into a repository (also maintains AGENTS.md)
node scripts/install-skill.mjs --target codex  --scope project --project ../my-project
node scripts/install-skill.mjs --target vscode --scope project --project ../my-project
```

Re-running over an existing install needs `--force`. The script prints the exact
destination path and how to verify the copy.

### Manual install

If you prefer copying by hand, use the layouts below. Copy the **whole folder**.

#### Codex

Use the Skills management interface in your Codex surface when available and import/add this folder. For a filesystem skill, use the current Agent Skills discovery layout:

```text
# project-local
<repo>/.agents/skills/industrial-fuxa-studio/

# user/global
~/.agents/skills/industrial-fuxa-studio/
```

For project-local installs, add an `AGENTS.md` at the repository root pointing
at the skill (the installer does this for you with `--scope project`).

Restart or force-refresh skills after copying. Product UI and distribution mechanics can change; prefer the current Skills/Plugin UI when present.

#### VS Code / GitHub Copilot

```text
# project-local
<repo>/.github/skills/industrial-fuxa-studio/

# user/global
%APPDATA%\Code\User\prompts\skills\industrial-fuxa-studio\   (Windows)
~/.config/Code/User/prompts/skills/industrial-fuxa-studio/   (Linux/macOS)
```

Reload the VS Code window afterwards.

#### ChatGPT

ChatGPT Skills availability depends on account/workspace eligibility and workspace settings. If your ChatGPT surface exposes **Plugins -> Skills**, create/import the skill there. If your personal ChatGPT plan does not expose Skills, use this package with Codex instead; the scripts can also be run manually from a terminal.

See `docs/USAGE.zh-CN.md` for a full Chinese walkthrough covering CLI use, both
client installs and handing the skill to a colleague.

## 3. Verify the package

```bash
cd industrial-fuxa-studio-skill
node --version
npm test
```

## 4. Generate a dashboard without touching FUXA

```bash
node scripts/classify-variables.mjs \
  --input templates/variables.ship-engine.example.json \
  --overrides templates/semantic-overrides.example.json \
  --out examples/generated/classified-variables.json

node scripts/generate-dashboard.mjs \
  --variables templates/variables.ship-engine.example.json \
  --request templates/dashboard-request.example.json \
  --device-id main-propulsion \
  --device-name MainPropulsionTIA \
  --view-id main-propulsion-overview \
  --view-name "主推进系统" \
  --out-dir examples/generated

node scripts/validate-dashboard.mjs \
  --plan examples/generated/dashboard-plan.json \
  --view examples/generated/fuxa-view.patch.json \
  --charts examples/generated/fuxa-charts.patch.json
```

Generated files:

| File | Purpose |
|---|---|
| `dashboard-plan.json`, `binding-plan.json` | reviewed intent and tag bindings |
| `dashboard-preview.svg` | **human preview only** — contains frozen sample values and is never applied to FUXA |
| `fuxa-view.patch.json` | the deliverable: a `set-view` patch whose view items are native, data-bound FUXA widgets |
| `fuxa-charts.patch.json` | `charts` patch defining the trend series the view references |

Open `examples/generated/dashboard-preview.svg` in a browser to review intent.
Apply `fuxa-charts.patch.json` before (or together with) `fuxa-view.patch.json`.

## 5. Probe a FUXA instance

API-key mode is recommended:

```bash
export FUXA_API_KEY='your-api-key'
node scripts/probe-fuxa.mjs \
  --url https://fuxa.example.com \
  --api-key-env FUXA_API_KEY \
  --out fuxa-capabilities.json
```

Username/password mode:

```bash
export FUXA_USER='admin'
export FUXA_PASSWORD='***'
node scripts/probe-fuxa.mjs \
  --url https://fuxa.example.com \
  --username-env FUXA_USER \
  --password-env FUXA_PASSWORD
```

For a self-signed test server only, `--insecure` disables TLS certificate verification. Do not use it in production.

## 6. Inspect the live project before generating mutation payloads

```bash
node scripts/inspect-fuxa-project.mjs \
  --url https://fuxa.example.com \
  --api-key-env FUXA_API_KEY \
  --out project-inspection.json
```

The agent should use this output to learn the current project's view/device/chart shapes before creating a patch.

## 7. Configure the industrial-cloud bridge

Copy the example:

```bash
cp templates/industrial-cloud.config.example.json industrial-cloud.config.json
```

Edit the base URL, snapshot endpoint, mapping and environment-variable names. Put secrets in environment variables, not in the JSON file.

Test one poll without writing FUXA:

```bash
node scripts/industrial-cloud-bridge.mjs \
  --config industrial-cloud.config.json \
  --once \
  --dry-run
```

Then run one real synchronization:

```bash
node scripts/industrial-cloud-bridge.mjs \
  --config industrial-cloud.config.json \
  --once
```

Long-running mode uses the configured `pollIntervalMs`.

## 8. Applying project changes

`apply-to-fuxa.mjs` consumes a generic patch document:

```json
{
  "cmd": "set-view",
  "data": { "...": "verified against this instance" }
}
```

Dry-run:

```bash
node scripts/apply-to-fuxa.mjs \
  --url https://fuxa.example.com \
  --api-key-env FUXA_API_KEY \
  --patch my-patch.json
```

Real mutation requires the explicit flag:

```bash
node scripts/apply-to-fuxa.mjs \
  --url https://fuxa.example.com \
  --api-key-env FUXA_API_KEY \
  --patch my-patch.json \
  --apply \
  --backup-dir ./backups
```

The script saves the current `/api/project` before sending `/api/projectData`.
