# Installation and authentication

When missing or requested, use the official installer at
`https://chatgpt.com/codex/install.sh` (macOS/Linux/WSL), or
`https://chatgpt.com/codex/install.ps1` (Windows). Prefer `~/.local/bin`.
Obtain authorization to execute downloaded installers under host policy.
Check `codex --version`; add that bin directory for this run if necessary.
Update only when requested with `codex update`.

Check `codex login status`. Login/logout only when requested. API-key login
reads stdin through `--with-api-key`; access-token login uses
`--with-access-token` and CODEX_ACCESS_TOKEN on stdin. Do not echo either.
Done when version prints and auth state is recorded without exposing secrets.
