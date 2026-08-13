#!/usr/bin/env bash
# RED/GREEN tests for ./run. Failures must be assertion failures, not runner bugs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RUN="$ROOT/run"
TEST_PATH=$PATH
PASS=0
FAIL=0
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

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

assert_contains() {
  local name="$1" haystack="$2" needle="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    PASS=$((PASS + 1))
    echo "ok $name"
  else
    FAIL=$((FAIL + 1))
    echo "not ok $name: missing $(printf %q "$needle") in $(printf %q "$haystack")"
  fi
}

write_exec() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat >"$path"
  chmod +x "$path"
}

# A .ts file the stubs can "run" without Node APIs.
SCRIPT="$WORKDIR/probe.ts"
printf 'console.log("probe")\n' >"$SCRIPT"

# ---------------------------------------------------------------------------
# 1. bun on PATH wins over node
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-bun"
write_exec "$BIN/bun" <<'EOF'
#!/bin/sh
echo "runtime=bun"
echo "script=$1"
shift
echo "args=$*"
EOF
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
echo "runtime=node"
exit 0
EOF
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" --json --open 2>/dev/null || true)"
assert "bun preferred" "$(printf '%s\n' "$out" | sed -n '1p')" "runtime=bun"
assert "bun gets script" "$(printf '%s\n' "$out" | sed -n '2p')" "script=$SCRIPT"
assert "bun gets args" "$(printf '%s\n' "$out" | sed -n '3p')" "args=--json --open"

# ---------------------------------------------------------------------------
# 2. nub on PATH when bun is absent
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-nub"
write_exec "$BIN/nub" <<'EOF'
#!/bin/sh
echo "runtime=nub"
echo "script=$1"
EOF
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
echo "runtime=node"
exit 0
EOF
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" 2>/dev/null || true)"
assert "nub preferred without bun" "$(printf '%s\n' "$out" | sed -n '1p')" "runtime=nub"

# ---------------------------------------------------------------------------
# 3. tsx on PATH when bun and nub are absent
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-tsx"
write_exec "$BIN/tsx" <<'EOF'
#!/bin/sh
echo "runtime=tsx"
EOF
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
echo "runtime=node"
exit 0
EOF
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" 2>/dev/null || true)"
assert "tsx preferred without bun/nub" "$(printf '%s\n' "$out" | sed -n '1p')" "runtime=tsx"

# ---------------------------------------------------------------------------
# 4. Node that cannot load .ts retries with --experimental-strip-types
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-strip"
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
for a in "$@"; do
  if [ "$a" = "--experimental-strip-types" ]; then
    echo "runtime=node-strip"
    exit 0
  fi
done
echo 'TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"' >&2
exit 1
EOF
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" 2>/dev/null || true)"
assert "node strip-types retry" "$out" "runtime=node-strip"

# ---------------------------------------------------------------------------
# 5. bun script failure does not fall through to node
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-bun-fail"
write_exec "$BIN/bun" <<'EOF'
#!/bin/sh
echo "bun-failed" >&2
exit 1
EOF
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
echo "runtime=node"
exit 0
EOF
set +e
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" 2>/dev/null)"
st=$?
set -e
assert "bun failure does not fall through" "$out" ""
assert "bun failure exit" "$st" "1"

# ---------------------------------------------------------------------------
# 6. nvm node is tried when PATH has no TS runtime
# ---------------------------------------------------------------------------
NVM_FAKE="$WORKDIR/nvm"
write_exec "$NVM_FAKE/versions/node/v22.22.2/bin/node" <<'EOF'
#!/bin/sh
echo "runtime=nvm-node"
exit 0
EOF
BIN="$WORKDIR/bin-empty"
mkdir -p "$BIN"
set +e
out="$(PATH="$BIN:/usr/bin:/bin" NVM_DIR="$NVM_FAKE" HOME="$WORKDIR/no-home" "$RUN" "$SCRIPT" 2>/dev/null)"
st=$?
set -e
assert "nvm node discovered" "$out" "runtime=nvm-node"
assert "nvm node exit" "$st" "0"

# ---------------------------------------------------------------------------
# 7. No runtime: exit 2 and name bun, nub, tsx, node
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-none"
mkdir -p "$BIN"
set +e
err="$(PATH="$BIN:/usr/bin:/bin" NVM_DIR="$WORKDIR/missing-nvm" HOME="$WORKDIR/no-home" "$RUN" "$SCRIPT" 2>&1 >/dev/null)"
st=$?
set -e
assert "no runtime exit 2" "$st" "2"
assert_contains "no runtime mentions bun" "$err" "bun"
assert_contains "no runtime mentions nub" "$err" "nub"
assert_contains "no runtime mentions tsx" "$err" "tsx"
assert_contains "no runtime mentions node" "$err" "node"

# ---------------------------------------------------------------------------
# 8. Ambient PATH can run --help through the runner
# ---------------------------------------------------------------------------
set +e
help_out="$(PATH="$TEST_PATH" "$RUN" "$ROOT/pr-snapshot.ts" --help 2>&1)"
help_st=$?
set -e
assert "ambient runtime --help exit" "$help_st" "0"
assert_contains "ambient runtime --help text" "$help_out" "usage: pr-snapshot.ts"

# ---------------------------------------------------------------------------
# 9. Zero args and missing script are exit 2
# ---------------------------------------------------------------------------
set +e
err="$(PATH="/usr/bin:/bin" "$RUN" 2>&1 >/dev/null)"
st=$?
set -e
assert "no-args exit 2" "$st" "2"
assert_contains "no-args usage" "$err" "usage: run <script.ts>"

set +e
err="$(PATH="/usr/bin:/bin" "$RUN" "$WORKDIR/missing.ts" 2>&1 >/dev/null)"
st=$?
set -e
assert "missing-script exit 2" "$st" "2"
assert_contains "missing-script message" "$err" "script not found:"

# ---------------------------------------------------------------------------
# 10. Non-TS node failure does not strip-retry or fall through to nvm
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-syntax"
ARGS="$WORKDIR/node-syntax-args"
: >"$ARGS"
write_exec "$BIN/node" <<EOF
#!/bin/sh
echo "\$*" >> "$ARGS"
echo "SyntaxError: unexpected token" >&2
exit 1
EOF
NVM_FAKE="$WORKDIR/nvm-syntax"
write_exec "$NVM_FAKE/versions/node/v22.22.2/bin/node" <<'EOF'
#!/bin/sh
echo "runtime=nvm-node"
exit 0
EOF
set +e
out="$(PATH="$BIN:/usr/bin:/bin" NVM_DIR="$NVM_FAKE" HOME="$WORKDIR/no-home" "$RUN" "$SCRIPT" 2>/dev/null)"
st=$?
set -e
assert "syntax failure exit" "$st" "1"
assert "syntax failure does not use nvm" "$out" ""
if grep -q 'experimental-strip-types' "$ARGS"; then
  FAIL=$((FAIL + 1))
  echo "not ok syntax failure skips strip-types"
else
  PASS=$((PASS + 1))
  echo "ok syntax failure skips strip-types"
fi

# ---------------------------------------------------------------------------
# 11. nub / tsx script failure does not fall through to node
# ---------------------------------------------------------------------------
BIN="$WORKDIR/bin-nub-fail"
write_exec "$BIN/nub" <<'EOF'
#!/bin/sh
echo "nub-failed" >&2
exit 1
EOF
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
echo "runtime=node"
exit 0
EOF
set +e
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" 2>/dev/null)"
st=$?
set -e
assert "nub failure does not fall through" "$out" ""
assert "nub failure exit" "$st" "1"

BIN="$WORKDIR/bin-tsx-fail"
write_exec "$BIN/tsx" <<'EOF'
#!/bin/sh
echo "tsx-failed" >&2
exit 1
EOF
write_exec "$BIN/node" <<'EOF'
#!/bin/sh
echo "runtime=node"
exit 0
EOF
set +e
out="$(PATH="$BIN:/usr/bin:/bin" "$RUN" "$SCRIPT" 2>/dev/null)"
st=$?
set -e
assert "tsx failure does not fall through" "$out" ""
assert "tsx failure exit" "$st" "1"

# ---------------------------------------------------------------------------
# 12. PATH node that cannot load TS falls through to a later nvm node
# ---------------------------------------------------------------------------
NVM_FAKE="$WORKDIR/nvm-multi"
write_exec "$NVM_FAKE/versions/node/v10.0.0/bin/node" <<'EOF'
#!/bin/sh
for a in "$@"; do
  if [ "$a" = "--experimental-strip-types" ]; then
    echo "node: bad option: --experimental-strip-types" >&2
    exit 9
  fi
done
echo 'TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"' >&2
exit 1
EOF
write_exec "$NVM_FAKE/versions/node/v22.22.2/bin/node" <<'EOF'
#!/bin/sh
echo "runtime=nvm-second"
exit 0
EOF
BIN="$WORKDIR/bin-path-old"
mkdir -p "$BIN"
ln -s "$NVM_FAKE/versions/node/v10.0.0/bin/node" "$BIN/node"
set +e
out="$(PATH="$BIN:/usr/bin:/bin" NVM_DIR="$NVM_FAKE" HOME="$WORKDIR/no-home" "$RUN" "$SCRIPT" 2>/dev/null)"
st=$?
set -e
assert "old node falls through to nvm" "$out" "runtime=nvm-second"
assert "old node nvm exit" "$st" "0"

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
