#!/usr/bin/env bash
# coord-browser.test: the box browser lock refuses a second window with a NON-ZERO exit and its reason on stderr, and the
# pipe trap that ran a browser over a held lock twice on 11-21. Scratch board (COORD_DIR), never the real one.
#   bash tools/coord-browser.test.sh
set -u
cd "$(dirname "$0")/.."
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
C() { COORD_DIR="$T" COORD_SESSION=test tools/coord.sh "$@"; }
pass=0; fail=0
ok() { if [ "$1" = 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  ✗ $2"; fi }

COORD_WIN=world C browser up "world's check" >/dev/null; ok $? "the first window takes the lock"
out=$(COORD_WIN=play C browser up "play's check" 2>"$T/err"); rc=$?
[ "$rc" = 1 ]; ok $? "a second window is REFUSED with exit 1 (got $rc)"
[ -z "$out" ] && grep -q "HELD by 'world'" "$T/err"; ok $? "the refusal says why, on stderr (stdout empty)"
COORD_WIN=play C browser up "x" 2>/dev/null && ran=1 || ran=0
[ "$ran" = 0 ]; ok $? "'coord browser up x && run' does NOT run on a refusal"
ran=0; COORD_WIN=play C browser up "x" 2>&1 | tail -1 >/dev/null && ran=1
[ "$ran" = 1 ]; ok $? "the TRAP, documented: '... | tail -1 && run' DOES run (a pipeline's status is tail's)"
ran=0; ( set -o pipefail; COORD_WIN=play C browser up "x" 2>&1 | tail -1 >/dev/null && ran=1; [ "$ran" = 0 ] ); ok $? "with set -o pipefail the piped form refuses too"
COORD_WIN=play C browser down 2>/dev/null; [ $? = 1 ]; ok $? "only the holder may put it down (play refused)"
COORD_WIN=world C browser down >/dev/null; ok $? "the holder puts it down"
COORD_WIN=play C browser up "now" >/dev/null; ok $? "then the next window takes it"

echo "coord-browser: $pass pass, $fail fail"
[ "$fail" = 0 ]
