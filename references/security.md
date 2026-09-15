# Security

## 1. Defaults

| Item | Default |
|---|---|
| FUXA project mutation | dry-run, `--apply` required |
| Pre-mutation backup | full `/api/project` written to `backups/` |
| Post-mutation verification | project read back and checked |
| TLS certificate verification | on |
| Credentials | environment variables only |

## 2. Secrets

Pass secrets through environment variables and reference them by name, for example `--api-key-env FUXA_API_KEY`. Never place a token in a JSON file that is committed, and never print a password, API key or JWT.

Prefer an API key scoped to the minimum required permissions over an administrator account.

## 3. Writeback and control

A control widget requires both:

1. `writable: true` from authoritative metadata, and
2. a reviewed command path that has actually been exercised.

Neither can be inferred. When either is missing, render a read-only status element and mark the variable for review.

## 4. Exposure

Do not expose the FUXA editor or admin surface directly to customer users unless the deployment architecture explicitly requires it. When embedding runtime views in a portal, put FUXA behind a reverse proxy with access isolation.

## 5. Test hosts

`--insecure` disables TLS certificate verification and is intended for self-signed test hosts only. Do not use it against production.
