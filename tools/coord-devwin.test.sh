#!/usr/bin/env bash
# coord devwins — the register/reap contract, on a SCRATCH board with a fake dev server.
# Run: bash tools/coord-devwin.test.sh   (never touches .coord; COORD_NO_SIGNAL=1 so nothing posts)
#
# What it proves: a devwin record whose lane has NO claim is an ORPHAN and `coord reap` kills its
# whole tree; a devwin on a CLAIMED lane is left alone by reap; `coord release` reaps the lane's
# devwin with the lane; a record whose pid is dead is cleared, not "killed"; `status` names each.
set -u
pass=0; fail=0
ok() { if [ "$1" = 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  ✗ $2"; fi; }
BOARD=$(mktemp -d)
export COORD_DIR="$BOARD" COORD_NO_SIGNAL=1 COORD_WIN=tester COORD_SESSION=test-session
C="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/coord.sh"
mkdir -p "$BOARD/claims" "$BOARD/devwins"

# A fake dev server: a wrapper shell with a child sleep — the npx → next-server shape.
fake() { bash -c 'sleep 300 & wait' >/dev/null 2>&1 & echo $!; }   # stdio detached, or the $(…) waits on the child
reg() { printf 'lane=%s\npid=%s\nport=%s\nsession=%s\nts=%s\n' "$1" "$2" "$3" "test-session" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BOARD/devwins/$1"; }

# 1. an orphan (no claim) is reaped, tree and all
P1=$(fake); sleep 0.3; reg play "$P1" 3203
KID=$(pgrep -P "$P1" | head -1)
out=$("$C" status); echo "$out" | grep -q "play.*ORPHAN"; ok $? "status flags the unclaimed devwin as an orphan"
out=$("$C" reap); echo "$out" | grep -q "reaped devwin 'play'"; ok $? "reap reports the orphan"
sleep 1.2
kill -0 "$P1" 2>/dev/null; [ $? -ne 0 ]; ok $? "the wrapper is dead"
kill -0 "$KID" 2>/dev/null; [ $? -ne 0 ]; ok $? "…and its child (the next-server stand-in) with it"
[ ! -f "$BOARD/devwins/play" ]; ok $? "the record is gone"

# 2. a claimed lane's devwin survives reap
P2=$(fake); sleep 0.3; reg world "$P2" 3201
printf 'owner=w\nts=%s\nsession=other\nnote=x\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BOARD/claims/world"
out=$("$C" reap); echo "$out" | grep -q "no orphan devwins"; ok $? "reap leaves a claimed lane's devwin alone"
kill -0 "$P2" 2>/dev/null; ok $? "…and it is still running"
out=$("$C" status); echo "$out" | grep -q "world.*live"; ok $? "status calls it live"

# 3. release reaps the lane's devwin with the lane (forced: the claim is another session's)
out=$(COORD_FORCE=1 "$C" release world); echo "$out" | grep -q "reaped devwin 'world'"; ok $? "release reaps the released lane's devwin"
sleep 1.2
kill -0 "$P2" 2>/dev/null; [ $? -ne 0 ]; ok $? "…and it is dead"
[ ! -f "$BOARD/claims/world" ] && [ ! -f "$BOARD/devwins/world" ]; ok $? "claim and record both gone"

# 4. a stale record (dead pid) is cleared, not killed
reg sprites 999999 3202
out=$("$C" status); echo "$out" | grep -q "sprites.*DEAD"; ok $? "status names a dead record"
out=$("$C" reap); echo "$out" | grep -q "cleared stale devwin record 'sprites'"; ok $? "reap clears it"
[ ! -f "$BOARD/devwins/sprites" ]; ok $? "…and the record is gone"

# 5. the devwin script writes the record shape the reaper reads (textual — starting next dev is not a test)
D="$(dirname "$C")/devwin.sh"
grep -q "DEVWINS_DIR/\$LANE" "$D" && grep -q "trap cleanup_devwin EXIT INT TERM" "$D" && grep -q 'wait "\$DEV_PID"' "$D"; ok $? "devwin.sh registers, traps and waits"
grep -q "printf 'lane=%s\\\\npid=%s\\\\nport=%s\\\\nsession=%s\\\\nts=%s\\\\n'" "$D"; ok $? "…in the record shape coord reads (lane/pid/port/session/ts)"

rm -rf "$BOARD"
echo "coord-devwin: $pass passed, $fail failed"
[ "$fail" = 0 ]
