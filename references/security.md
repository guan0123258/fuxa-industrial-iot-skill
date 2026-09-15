# Security and Change Control

## Defaults

- TLS verification: ON.
- Mutation: OFF (dry-run).
- Upstream industrial-cloud access: read-only.
- FUXA write/control tags: OFF unless authoritative metadata explicitly enables them.

## Secrets

Pass secrets through environment variables. Example configuration files contain environment-variable names, never actual tokens.

Avoid logging authorization headers. The supplied HTTP helper redacts secret values from error context and does not dump request headers.

## FUXA exposure

Do not expose the editor/admin interface directly to customer users merely to show a dashboard. Put FUXA behind the industrial-cloud reverse proxy and authorization boundary, and expose only the runtime views required by the tenant.

## Backups

Before any `/api/projectData` mutation, save `/api/project` to a timestamped local backup. Keep deployment backups under your normal configuration/change-management process.

## Control/writeback

A variable can receive a control widget only when all are true:

1. authoritative metadata says `writable: true`;
2. a real industrial-cloud/upstream command API exists;
3. authorization and audit behavior are defined;
4. the target action is reviewed for interlocks/safety;
5. the user explicitly asks to enable control.

Do not derive any of these from naming or numeric ranges.
