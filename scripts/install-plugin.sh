#!/usr/bin/env bash
set -euo pipefail

command -v python3 >/dev/null || { echo "python3 required"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_NAME="pratham-skills"
PLUGIN_ID="${PLUGIN_NAME}@local"
# Official local-dev path (Cursor docs: Test plugins locally)
TARGET="$HOME/.cursor/plugins/local/$PLUGIN_NAME"
LOCAL_ROOT="$(dirname "$TARGET")"
STAGE=""

CLAUDE_PLUGINS="$HOME/.claude/plugins/installed_plugins.json"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

cleanup_stage() {
  if [[ -n "$STAGE" && -d "$STAGE" ]]; then
    rm -rf "$STAGE"
  fi
}
trap cleanup_stage EXIT

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

if [[ -L "$TARGET" ]]; then
  echo "error: $TARGET is a symlink, refusing to delete" >&2
  exit 1
fi

# Validate existing Claude config JSON before mutating anything
python3 - "$CLAUDE_PLUGINS" "$CLAUDE_SETTINGS" "$PLUGIN_ID" <<'PY'
import json, os, sys

plugins_path, settings_path, pid = sys.argv[1], sys.argv[2], sys.argv[3]

def load_object(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"error: refuse to overwrite corrupt {path}: {e}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(data, dict):
        print(f"error: refuse to overwrite non-object JSON in {path}", file=sys.stderr)
        sys.exit(1)
    return data

plugins_data = load_object(plugins_path)
plugins = plugins_data.get("plugins", {})
if "plugins" in plugins_data and not isinstance(plugins, dict):
    print(f"error: refuse to overwrite invalid plugins map in {plugins_path}", file=sys.stderr)
    sys.exit(1)
existing = plugins.get(pid) if isinstance(plugins, dict) else None
if existing is not None and not isinstance(existing, list):
    print(f"error: plugins['{pid}'] is not a list", file=sys.stderr)
    sys.exit(1)

settings_data = load_object(settings_path)
enabled = settings_data.get("enabledPlugins", {})
if "enabledPlugins" in settings_data and not isinstance(enabled, dict):
    print(f"error: refuse to overwrite invalid enabledPlugins in {settings_path}", file=sys.stderr)
    sys.exit(1)
PY

# 1. Stage plugin files, then swap into place
mkdir -p "$LOCAL_ROOT" "$HOME/.claude/plugins"
STAGE=$(mktemp -d "$LOCAL_ROOT/$PLUGIN_NAME.staging.XXXXXX")
for dir in .cursor-plugin commands rules skills scripts; do
  if [[ -d "$REPO_ROOT/$dir" ]]; then
    cp -RP "$REPO_ROOT/$dir" "$STAGE/"
  fi
done
if [[ -f "$REPO_ROOT/README.md" ]]; then
  cp -P "$REPO_ROOT/README.md" "$STAGE/"
fi

rm -rf "$TARGET"
mv "$STAGE" "$TARGET"
STAGE=""

# Shared JSON upsert helper: exclusive lock + atomic replace
upsert_json() {
  python3 - "$@" <<'PY'
import fcntl, json, os, sys, tempfile

mode = sys.argv[1]
path = sys.argv[2]
pid = sys.argv[3]
ipath = sys.argv[4] if mode == "plugins" else None

os.makedirs(os.path.dirname(path), exist_ok=True)
# Hold an exclusive lock across read-modify-write
lock_path = path + ".lock"
lock_fd = open(lock_path, "a+")
fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)

data = {}
if os.path.exists(path):
    with open(path) as f:
        data = json.load(f)

if mode == "plugins":
    plugins = data.setdefault("plugins", {})
    existing = plugins.get(pid)
    if existing is not None and not isinstance(existing, list):
        print(f"error: plugins['{pid}'] is not a list", file=sys.stderr)
        sys.exit(1)
    entries = [
        e
        for e in (existing or [])
        if not (isinstance(e, dict) and e.get("scope") == "user")
    ]
    entries.insert(0, {"scope": "user", "installPath": ipath})
    plugins[pid] = entries
    msg = f"Registered {pid} -> {ipath}"
else:
    data.setdefault("enabledPlugins", {})[pid] = True
    msg = f"Enabled {pid}"

fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-", suffix=".json")
try:
    with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.replace(tmp, path)
finally:
    if os.path.exists(tmp):
        os.unlink(tmp)

fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)
lock_fd.close()
print(msg)
PY
}

# 2. Register in installed_plugins.json (upsert, don't clobber)
upsert_json plugins "$CLAUDE_PLUGINS" "$PLUGIN_ID" "$TARGET"

# 3. Enable in settings.json (upsert, don't clobber)
upsert_json settings "$CLAUDE_SETTINGS" "$PLUGIN_ID"

echo "Installed $PLUGIN_NAME to $TARGET"
echo "Restart Cursor (or Developer: Reload Window)."
echo "If components are missing, enable third-party plugins under Settings > Features."
