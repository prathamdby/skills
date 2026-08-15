#!/usr/bin/env bash
# CLI contracts for pr-reply.ts. Validation must fail before any GitHub call.
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

# Stub gh so a leaked spawn is visible and cannot hit the network.
BIN="$WORKDIR/bin"
write_exec "$BIN/gh" <<'EOF'
#!/bin/sh
echo "leaked-gh $*" >&2
exit 97
EOF

BODY="$WORKDIR/body.md"
printf 'Fixed in abc123. Guard empty ids.\n' >"$BODY"

run_reply() {
  PATH="$BIN:$TEST_PATH" "$RUN" "$ROOT/pr-reply.ts" "$@"
}

set +e
help_out="$(run_reply --help 2>&1)"
help_st=$?
set -e
assert "help exit" "$help_st" "0"
assert_contains "help usage" "$help_out" "usage: pr-reply.ts"
assert_contains "help in-reply-to" "$help_out" "--in-reply-to"
assert_contains "help conversation" "$help_out" "--conversation"
assert_contains "help body-file" "$help_out" "--body-file"

set +e
err="$(run_reply --pr 1 --body-file "$BODY" 2>&1 >/dev/null)"
st=$?
set -e
assert "missing target exit" "$st" "1"
assert_contains "missing target names flags" "$err" "--in-reply-to"
assert_contains "missing target names conversation" "$err" "--conversation"

set +e
err="$(run_reply --pr 1 --in-reply-to 9 --conversation --body-file "$BODY" 2>&1 >/dev/null)"
st=$?
set -e
assert "both targets exit" "$st" "1"
assert_contains "both targets message" "$err" "not both"

set +e
err="$(run_reply --pr 1 --in-reply-to 9 2>&1 >/dev/null)"
st=$?
set -e
assert "missing body exit" "$st" "1"
assert_contains "missing body names flags" "$err" "--body-file"

set +e
err="$(run_reply --pr 1 --in-reply-to 9 --body 'hi' --body-file "$BODY" 2>&1 >/dev/null)"
st=$?
set -e
assert "both bodies exit" "$st" "1"
assert_contains "both bodies message" "$err" "not both"

: >"$WORKDIR/empty.md"
set +e
err="$(run_reply --pr 1 --conversation --body-file "$WORKDIR/empty.md" 2>&1 >/dev/null)"
st=$?
set -e
assert "empty body-file exit" "$st" "1"
assert_contains "empty body-file message" "$err" "empty"

set +e
err="$(run_reply --pr 1 --in-reply-to abc --body-file "$BODY" 2>&1 >/dev/null)"
st=$?
set -e
assert "bad comment id exit" "$st" "1"
assert_contains "bad comment id message" "$err" "review comment id"

if [[ "$err" == *leaked-gh* ]] || [[ "$help_out" == *leaked-gh* ]]; then
  FAIL=$((FAIL + 1))
  echo "not ok validation must not spawn gh"
else
  PASS=$((PASS + 1))
  echo "ok validation must not spawn gh"
fi

echo
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
