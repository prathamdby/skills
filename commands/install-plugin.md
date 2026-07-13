---
name: install-plugin
description: Install or refresh this plugin locally into Cursor for development testing
---

# Install plugin locally

Re-copy this plugin into `~/.cursor/plugins/local/` and register it for local Cursor testing.

## Steps

1. Run from the **git clone** of this repository (never from `~/.cursor/plugins/...`):

```bash
bash /path/to/skills/scripts/install-plugin.sh
```

Replace `/path/to/skills` with the absolute path to your clone.

2. Restart Cursor (or run Developer: Reload Window).

3. If commands or skills do not appear, enable third-party plugins under Settings > Features ("Include third-party Plugins, Skills, and other configs").

4. Confirm `/prath-mode` and other skills are available in the agent.
