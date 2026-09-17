#!/usr/bin/env bash
# RED/GREEN guards for marketplace skill set, README skill links, and
# prath-mode playbook coverage.
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

# ---------------------------------------------------------------------------
# 3. prath-mode playbook primary coverage + leaf path resolution
# ---------------------------------------------------------------------------
PLAYBOOK_DIR="skills/engineering/prath-mode/playbooks"
if [ ! -d "$PLAYBOOK_DIR" ] || [ -z "$(find "$PLAYBOOK_DIR" -maxdepth 1 -type f -name '*.md' 2>/dev/null)" ]; then
  PASS=$((PASS + 1))
  echo "ok playbooks coverage skipped (absent)"
else
  coverage_rc="$(
    python3 - <<'PY' || true
from pathlib import Path
import re
import sys

root = Path(".")
playbook_dir = root / "skills/engineering/prath-mode/playbooks"
leaves = sorted(
    p.parent.name
    for p in root.glob("skills/*/*/SKILL.md")
    if p.parent.name != "prath-mode"
)
leaf_set = set(leaves)

def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---\n"):
        raise ValueError("missing frontmatter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("unterminated frontmatter")
    body_start = end + 5
    meta = {}
    for line in text[4:end].splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"bad frontmatter line: {line!r}")
        key, raw = line.split(":", 1)
        key = key.strip()
        raw = raw.strip()
        if raw in ("null", "~", ""):
            meta[key] = None
        elif raw.startswith("[") and raw.endswith("]"):
            inner = raw[1:-1].strip()
            meta[key] = [p.strip() for p in inner.split(",") if p.strip()] if inner else []
        else:
            meta[key] = raw
    return meta, text[body_start:]

primaries = []
errors = []
for path in sorted(playbook_dir.glob("*.md")):
    try:
        meta, body = parse_frontmatter(path.read_text())
    except ValueError as e:
        errors.append(f"{path}: {e}")
        continue
    kind = meta.get("kind")
    primary = meta.get("primary")
    participants = meta.get("participants") or []
    if kind not in ("action", "chain"):
        errors.append(f"{path}: kind must be action|chain, got {kind!r}")
    if kind == "action":
        if not primary or primary not in leaf_set:
            errors.append(f"{path}: action primary must be an existing leaf, got {primary!r}")
        if participants:
            errors.append(f"{path}: action playbook must not list participants")
        if primary:
            primaries.append(primary)
    if kind == "chain":
        if primary is not None:
            errors.append(f"{path}: chain primary must be null, got {primary!r}")
    for name in participants:
        if name not in leaf_set:
            errors.append(f"{path}: unknown participant {name!r}")
    for m in re.finditer(r"(?m)^\s*\d+\.\s+(leaf:([a-z0-9-]+)|parent:implementation)\b", body):
        if m.group(1).startswith("leaf:"):
            name = m.group(2)
            if name not in leaf_set:
                errors.append(f"{path}: unknown leaf:{name}")
            # Resolve from playbook file directory
            eng = playbook_dir / ".." / ".." / name / "SKILL.md"
            personal = playbook_dir / ".." / ".." / ".." / "personal" / name / "SKILL.md"
            if not eng.resolve().is_file() and not personal.resolve().is_file():
                errors.append(f"{path}: leaf:{name} path missing from playbooks/")

from collections import Counter
counts = Counter(primaries)
for name, n in sorted(counts.items()):
    if n != 1:
        errors.append(f"primary {name!r} appears {n} times")

missing = sorted(leaf_set - set(primaries))
extra = sorted(set(primaries) - leaf_set)
if missing:
    errors.append("missing primaries: " + ", ".join(missing))
if extra:
    errors.append("unknown primaries: " + ", ".join(extra))

if errors:
    for e in errors:
        print(e)
    print("FAIL")
    sys.exit(1)
print("PASS")
PY
  )"
  if [ "$coverage_rc" = "PASS" ]; then
    assert "prath-mode playbook coverage" "PASS" "PASS"
  else
    echo "$coverage_rc"
    assert "prath-mode playbook coverage" "FAIL" "PASS"
  fi
fi

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
