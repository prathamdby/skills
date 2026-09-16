#!/usr/bin/env bash
# RED/GREEN guards for marketplace skill set and README skill links.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

assert() {
  local name="$1" got="$2" want="$3"
  if [ "$got" = "$want" ]; then
    PASS=$((PASS + 1))
    echo "ok $name"
  else
    FAIL=$((FAIL + 1))
    echo "not ok $name: got $(printf %q "$got") want $(printf %q "$want")"
  fi
}

# ---------------------------------------------------------------------------
# 1. marketplace plugins[0].skills == sorted skills/*/*/SKILL.md dirs
# ---------------------------------------------------------------------------
disk_list="$(
  find skills -mindepth 3 -maxdepth 3 -type f -name SKILL.md \
    | sed 's|/SKILL.md$||' \
    | sed 's|^|./|' \
    | sort
)"
manifest_list="$(
  python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path(".claude-plugin/marketplace.json").read_text())
for path in sorted(data["plugins"][0]["skills"]):
    print(path)
PY
)"
assert "marketplace sorted set equality" "$manifest_list" "$disk_list"

# ---------------------------------------------------------------------------
# 2. every ./skills/ path linked from README.md exists as a file
# ---------------------------------------------------------------------------
missing=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  if [ ! -f "$path" ]; then
    missing=$((missing + 1))
    echo "missing README skill path: $path"
  fi
done < <(grep -oE '\./skills/[^)[:space:]]+' README.md | sort -u)
assert "README ./skills/ links exist" "$missing" "0"

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
