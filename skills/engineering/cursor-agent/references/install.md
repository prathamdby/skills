# Installation

When missing or requested, use the official installer at
`https://cursor.com/install` (macOS/Linux/WSL), or its `?win32=true` variant
on Windows. Prefer `~/.local/bin`; obtain host authorization for downloaded
installer execution. Check `cursor-agent --version`; add that bin directory
for this run if necessary. Update only when requested with `cursor-agent update`.

Check `cursor-agent status --format json`; apply Auth in `trust-integrations.md`
if login was requested. Shell integration writes `~/.zshrc` even on bash:
install/uninstall it only when explicitly requested.
Done when version prints and auth state is recorded without exposing secrets.
