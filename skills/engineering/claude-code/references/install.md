# Installation and authentication

When the binary is missing or installation was requested, prefer `~/.local/bin`.
On macOS/Linux/WSL use the official installer at `https://claude.ai/install.sh`;
on Windows use `https://claude.ai/install.ps1`. Obtain authorization for running
downloaded installers under the host's policy; a permission failure is not bypassed.
Check `claude --version`; if missing from PATH, add `~/.local/bin` for this run.

For an existing native binary, `claude install [stable|latest|<version>]` selects
a build. Update only when requested with `claude update`.
Check `claude auth status --text`; login only when requested using
`claude auth login`, default claudeai; console/SSO are user-named choices.
Done when version prints and auth state is recorded without revealing secrets.
