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

# ── browser run (11-23): one call takes, runs, ALWAYS releases, passes the exit code through ──
COORD_WIN=play C browser down >/dev/null 2>&1
held() { [ -f "$T/browser" ]; }
COORD_WIN=world C browser run "ok check" -- bash -c 'grep -q "^pid=[0-9]" "$0"' "$T/browser" >/dev/null 2>&1; rc=$?
[ "$rc" = 0 ]; ok $? "run: the command runs while holding, with the wrapper pid recorded (rc $rc)"
! held; ok $? "run: released after success"
COORD_WIN=world C browser run "bad check" -- bash -c 'exit 7' >/dev/null 2>&1; rc=$?
[ "$rc" = 7 ]; ok $? "run: the command's exit code is passed through (got $rc)"
! held; ok $? "run: released after failure"
COORD_WIN=world C browser up "a window holds it" >/dev/null
ran=0; COORD_WIN=play C browser run "x" -- bash -c "touch $T/ran" >/dev/null 2>"$T/err"; rc=$?
[ "$rc" = 1 ] && [ ! -f "$T/ran" ] && grep -q "HELD by 'world'" "$T/err"; ok $? "run: held by a live window -> exit 1, command NOT run (got $rc)"
held && grep -q '^owner=world' "$T/browser"; ok $? "run: a refused run leaves the holder's lock alone"
COORD_WIN=world C browser down >/dev/null
# killed (TERM): the trap releases and the child dies too
COORD_WIN=world COORD_DIR="$T" COORD_SESSION=test tools/coord.sh browser run "long" -- sleep 30 >/dev/null 2>&1 & w=$!
for _ in $(seq 1 50); do held && break; sleep 0.1; done
held; ok $? "run: holds while its command runs"
COORD_WIN=play C browser run "x" -- true >/dev/null 2>&1; [ $? = 1 ]; ok $? "run: a live run refuses a second run"
COORD_WIN=world C browser run "x" -- true >/dev/null 2>&1; [ $? = 1 ]; ok $? "run: a live run refuses a second run from the SAME window"
kill -TERM "$w"; wait "$w"; rc=$?
[ "$rc" = 143 ] && ! held; ok $? "run: killed with TERM -> released, exit 143 (got $rc)"
! pgrep -x -f 'sleep 30' >/dev/null; ok $? "run: the TERMed wrapper took its child down with it"
# SIGKILL (no trap can run): the dead pid is stale AT ONCE, status says so, up and run take over
COORD_WIN=world COORD_DIR="$T" COORD_SESSION=test tools/coord.sh browser run "doomed" -- sleep 30 >/dev/null 2>&1 & w=$!
for _ in $(seq 1 50); do held && break; sleep 0.1; done
kill -KILL "$w"; wait "$w" 2>/dev/null; pkill -x -f 'sleep 30' 2>/dev/null
held; ok $? "run: SIGKILL leaves the file behind (the case the pid rule exists for)"
C browser status | grep -q "STALE (holder pid $w is dead)"; ok $? "status: a dead-pid holder reads STALE at once"
COORD_WIN=play C browser up "after a kill" >/dev/null 2>"$T/err"; rc=$?
[ "$rc" = 0 ] && grep -q "taking over STALE holder 'world'" "$T/err" && grep -q '^owner=play' "$T/browser"; ok $? "up: takes over a dead-pid holder at once (rc $rc)"
COORD_WIN=play C browser down >/dev/null
printf 'owner=world\nts=%s\nnote=dead\npid=999999\npidstart=1\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$T/browser"
COORD_WIN=play C browser run "after a dead pid" -- true >/dev/null 2>&1; ok $? "run: takes over a dead-pid holder at once"
! held; ok $? "run: ...and releases it after"
printf 'owner=world\nts=%s\nnote=fresh up, no pid\npid=\npidstart=\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$T/browser"
COORD_WIN=play C browser up "x" >/dev/null 2>&1; [ $? = 1 ]; ok $? "up without a pid keeps the 45-min rule (fresh -> refused)"
printf 'owner=world\nts=%s\nnote=old up, no pid\n' "$(date -u -d '-50 min' +%Y-%m-%dT%H:%M:%SZ)" > "$T/browser"
COORD_WIN=play C browser up "x" >/dev/null 2>&1; ok $? "up without a pid keeps the 45-min rule (50 min old -> taken)"

echo "coord-browser: $pass pass, $fail fail"
[ "$fail" = 0 ]
