#!/usr/bin/env bash
# coord.sh — multi-window game-dev coordination for /root/ather-games
#
# One shared machine, one master branch, one build (:3200). Windows swarm a
# single game in disjoint lanes. This script is the ONE mechanism etiquette
# can't be trusted with: serializing the build/deploy so two `npm run build`s
# never corrupt .next or OOM the box.
#
# Identity: export COORD_WIN=<lane> once per window (e.g. hub, world, sprites).
# Optional: export COORD_SESSION=<cc-session-id> so cortex claims attribute to
# your window's handoff. Falls back safely if unset.
#
# Usage:
#   coord claim <lane> [note]   register this window as owner of a lane
#   coord status                show all claims + build-lock state
#   coord build [msg]           acquire build lock -> build -> pm2 restart -> release
#   coord release [lane]        drop your claim
#   coord lock / unlock         manual build-lock control (edge cases)

set -euo pipefail

REPO="/root/ather-games"
COORD_DIR="$REPO/.coord"
CLAIMS_DIR="$COORD_DIR/claims"
LOCKDIR="$COORD_DIR/build.lock"        # mkdir is atomic -> our mutex
STALE_LOCK_SECS="${STALE_LOCK_SECS:-900}"   # 15m: a build that outlives this is dead, steal it
WAIT_SECS="${WAIT_SECS:-240}"               # how long `build` waits for the lock before giving up
MCP_URL="https://mcp.guardiacontent.com/mcp/call?key=guardia-hq-72a1ee34e43d8b66a70a44c67d64bd0b"

WIN="${COORD_WIN:-$(hostname)-$$}"
SESSION="${COORD_SESSION:-}"

mkdir -p "$CLAIMS_DIR"

now_epoch() { date +%s; }
now_iso()   { date -u +%Y-%m-%dT%H:%M:%SZ; }

signal() {
  # best-effort cortex signal, never fails the command
  local content="$1"
  local args="{\"content\":\"[coord] $content\",\"from_agent\":\"jin-cc\""
  [ -n "$SESSION" ] && args="$args,\"session_id\":\"$SESSION\""
  args="$args}"
  curl -s --max-time 8 -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -d "{\"tool\":\"cortex_signal\",\"arguments\":$args}" >/dev/null 2>&1 || true
}

cmd_claim() {
  local lane="${1:?usage: coord claim <lane> [note]}"; shift || true
  local note="${*:-}"
  printf 'owner=%s\nts=%s\nnote=%s\n' "$WIN" "$(now_iso)" "$note" > "$CLAIMS_DIR/$lane"
  echo "claimed lane '$lane' as '$WIN'${note:+ — $note}"
  signal "$WIN claims lane '$lane'${note:+ — $note}"
}

cmd_release() {
  local lane="${1:-$WIN}"
  if [ -f "$CLAIMS_DIR/$lane" ]; then
    rm -f "$CLAIMS_DIR/$lane"
    echo "released lane '$lane'"
    signal "$WIN releases lane '$lane'"
  else
    echo "no claim on lane '$lane'"
  fi
}

lock_owner_info() {
  [ -f "$LOCKDIR/info" ] && cat "$LOCKDIR/info" || echo "owner=? ts=0 pid=?"
}

lock_age() {
  local ts
  ts=$(sed -n 's/^ts=//p' "$LOCKDIR/info" 2>/dev/null || echo 0)
  echo $(( $(now_epoch) - ${ts:-0} ))
}

acquire_lock() {
  local waited=0
  while true; do
    if mkdir "$LOCKDIR" 2>/dev/null; then
      printf 'owner=%s\nts=%s\npid=%s\n' "$WIN" "$(now_epoch)" "$$" > "$LOCKDIR/info"
      return 0
    fi
    # lock exists — steal if stale
    local age; age=$(lock_age)
    if [ "$age" -gt "$STALE_LOCK_SECS" ]; then
      echo "build lock stale (${age}s, held by: $(lock_owner_info | tr '\n' ' ')) — stealing"
      rm -rf "$LOCKDIR"
      continue
    fi
    if [ "$waited" -ge "$WAIT_SECS" ]; then
      echo "could not acquire build lock after ${WAIT_SECS}s. Held by:"
      lock_owner_info | sed 's/^/  /'
      return 1
    fi
    echo "build lock held by $(sed -n 's/^owner=//p' "$LOCKDIR/info" 2>/dev/null) — waiting... (${waited}s)"
    sleep 6; waited=$((waited+6))
  done
}

release_lock() { rm -rf "$LOCKDIR"; }

cmd_build() {
  local msg="${*:-deploy}"
  acquire_lock || exit 1
  trap release_lock EXIT
  echo ">> build lock acquired by '$WIN'"
  signal "$WIN building: $msg"
  cd "$REPO"
  if npm run build && pm2 restart ather-games >/dev/null; then
    echo ">> build + restart OK"
    signal "$WIN deployed OK: $msg"
  else
    echo ">> BUILD FAILED — nothing deployed"
    signal "$WIN BUILD FAILED: $msg"
    release_lock; trap - EXIT
    exit 1
  fi
  release_lock; trap - EXIT
}

cmd_lock()   { acquire_lock && echo "locked by '$WIN' (release with: coord unlock)"; }
cmd_unlock() { release_lock; echo "build lock released"; }

cmd_status() {
  echo "=== window: $WIN ==="
  echo "--- lane claims ---"
  if ls "$CLAIMS_DIR"/* >/dev/null 2>&1; then
    for f in "$CLAIMS_DIR"/*; do
      local lane owner ts note
      lane=$(basename "$f")
      owner=$(sed -n 's/^owner=//p' "$f"); ts=$(sed -n 's/^ts=//p' "$f"); note=$(sed -n 's/^note=//p' "$f")
      printf "  %-14s %-10s %s%s\n" "$lane" "$owner" "$ts" "${note:+  ($note)}"
    done
  else
    echo "  (none)"
  fi
  echo "--- build lock ---"
  if [ -d "$LOCKDIR" ]; then
    echo "  HELD — $(lock_owner_info | tr '\n' ' ')  age=$(lock_age)s"
  else
    echo "  free"
  fi
}

case "${1:-status}" in
  claim)   shift; cmd_claim "$@" ;;
  release) shift; cmd_release "$@" ;;
  build)   shift; cmd_build "$@" ;;
  lock)    cmd_lock ;;
  unlock)  cmd_unlock ;;
  status)  cmd_status ;;
  *) echo "usage: coord {claim <lane> [note] | status | build [msg] | release [lane] | lock | unlock}"; exit 1 ;;
esac
