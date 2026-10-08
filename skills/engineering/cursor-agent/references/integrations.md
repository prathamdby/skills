# Integration branches

Load only when the user requests one of these operations. Use scoped help
for current syntax; keep authorization boundaries below even if help suggests shortcuts.

## Auth

Status/whoami inspect login; redact tokens, keys, and raw account dumps.
Login is user-requested and honors NO_OPEN_BROWSER; logout is also requested.
Models lists the catalog; about may expose account data, so redact it.
Prefer environment credentials, not argv; missing auth is `BLOCKED`.

## Bedrock

Only on explicit Bedrock request. Configure prefers `--from-env`, with
optional region/test-model. Enable needs stored credentials; status/test
inspect them without revealing values. Disable keeps credentials; clear
removes them and needs that request. Do not record a secret-key argument.

## MCP

There is no mcp add. Edit `.cursor/mcp.json` or `~/.cursor/mcp.json` only for
requested configuration. List/list-tools inspect. Login is authorized OAuth;
enable/disable changes approval for a named server. Approve-mcps approves all
servers and needs its own named waiver, not recovery from a prompt.

## Plugins

Plugin-dir loads local directories for this process and is repeatable.
Marketplace add/list/remove/update uses current scoped help. Add/remove only
user-named URLs or names; installation does not authorize unrelated changes.

## Workers

Start only for requested My Machines or a pool. Personal uses
`cursor-agent worker start`; Enterprise pool uses
`cursor-agent worker --pool [name] start` with a service-account credential.
Preflight with worker debug; flags precede start. Worker-dir is repeatable,
with its first path the assignment identity; management-addr, display, and
session hooks are user-derived. Do not dump secrets from debug output.

Each of these flags needs its own waiver:

- computer-use: desktop control
- share-desktop: sharing; Linux bare defaults to view_and_control, macOS to
  view; use explicit view on macOS when no mode was named
- mint-github-token: injects GitHub tokens, pool only
- clone-git-repos: implies token minting
- sync-dashboard-secrets: injects dashboard secrets
- identity-socket: OIDC token minting
- auth-token-file: token file; do not read it

Worker controls do not substitute for workspace trust. Preserve global
workers, auth, MCP approvals, and shell integration outside the named request.
