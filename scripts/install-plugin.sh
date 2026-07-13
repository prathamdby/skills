#!/usr/bin/env bash
set -euo pipefail

command -v python3 >/dev/null || { echo "python3 required"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_NAME="pratham-skills"
PLUGIN_ID="${PLUGIN_NAME}@local"
# Official local-dev path (Cursor docs: Test plugins locally)
TARGET="$HOME/.cursor/plugins/local/$PLUGIN_NAME"

CLAUDE_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

# Refuse to run from the install target (would rm -rf the only copy)
case "$REPO_ROOT" in
  "$TARGET"|"$TARGET"/*|"$HOME/.cursor/plugins"/*)
    echo "error: run install-plugin.sh from the git clone, not from $REPO_ROOT" >&2
    echo "clone: https://github.com/prathamdby/skills.git" >&2
    exit 1
    ;;
esac

if [[ ! -f "$REPO_ROOT/.cursor-plugin/plugin.json" ]]; then
  echo "error: missing $REPO_ROOT/.cursor-plugin/plugin.json" >&2
  exit 1
fi

# Validate existing Claude config JSON before mutating anything
python3 - "$CLAUDE_PLUGINS" "$CLAUDE_SETTINGS" <<'PY'
import json, os, sys

def check(path, label):
    if not os.path.exists(path):
        return
    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"error: refuse to overwrite corrupt {path}: {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(data, dict):
        print(f"error: refuse to overwrite non-object JSON in {path}", file=sys.stderr)
        sys.exit(1)
    if label == "plugins":
        plugins = data.get("plugins", {})
        if "plugins" in data and not isinstance(plugins, dict):
            print(f"error: refuse to overwrite invalid plugins map in {path}", file=sys.stderr)
            sys.exit(1)
    if label == "settings":
        enabled = data.get("enabledPlugins", {})
        if "enabledPlugins" in data and not isinstance(enabled, dict):
            print(f"error: refuse to overwrite invalid enabledPlugins in {path}", file=sys.stderr)
            sys.exit(1)

check(sys.argv[1], "plugins")
check(sys.argv[2], "settings")
PY

# 1. Copy plugin files
mkdir -p "$(dirname "$TARGET")" "$HOME/.claude/plugins"
rm -rf "$TARGET"
mkdir -p "$TARGET"
for dir in .cursor-plugin commands rules skills scripts; do
  [[ -d "$REPO_ROOT/$dir" ]] && cp -R "$REPO_ROOT/$dir" "$TARGET/"
done
[[ -f "$REPO_ROOT/README.md" ]] && cp "$REPO_ROOT/README.md" "$TARGET/"

# 2. Register in installed_plugins.json (upsert, don't clobber)
python3 - "$CLAUDE_PLUGINS" "$PLUGIN_ID" "$TARGET" <<'PY'
import json, os, sys

path, pid, ipath = sys.argv[1], sys.argv[2], sys.argv[3]
data = {}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
plugins = data.setdefault("plugins", {})
entries = [
    e
    for e in plugins.get(pid, [])
    if not (isinstance(e, dict) and e.get("scope") == "user")
]
entries.insert(0, {"scope": "user", "installPath": ipath})
plugins[pid] = entries
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(f"Registered {pid} -> {ipath}")
PY

# 3. Enable in settings.json (upsert, don't clobber)
python3 - "$CLAUDE_SETTINGS" "$PLUGIN_ID" <<'PY'
import json, os, sys

path, pid = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)
data.setdefault("enabledPlugins", {})[pid] = True
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(f"Enabled {pid}")
PY

echo "Installed $PLUGIN_NAME to $TARGET"
echo "Restart Cursor (or Developer: Reload Window)."
echo "If components are missing, enable third-party plugins under Settings > Features."
