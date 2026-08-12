#!/usr/bin/env bash
# coord.sh — multi-window game-dev coordination for /root/ather-games
#
# One shared machine, one master branch, one build (:3200). Windows swarm a
# single game in disjoint lanes. This script is the ONE mechanism etiquette
# can't be trusted with: serializing the build/deploy so two `npm run build`s
# never corrupt .next or OOM the box.
#
# Identity: export COORD_WIN=<lane> once per window (e.g. hub, world, sprites).
# COORD_SESSION=<cc-session-id> attributes cortex signals to your window AND is
# recorded in the claim file, so `status` can tell you which lanes are yours.
# Falls back safely if unset (the lane reads as "session ?" — unknown, not dead).
#
# ⚠ A CLAIM IS NOT A HEARTBEAT. Nothing here observes whether a window is still
# running; `status` reports who claimed a lane and how long ago, and you judge.
# This existed to be judged wrong: before 2026-08-12 the session id was read and
# thrown away, so a live window and a dead claim were byte-identical on disk and
# a booting window mistook another window's lane for its own.
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
# Credentials come from the local untracked env file. This repo is public;
# never inline a secret here.
# shellcheck source=/dev/null
[ -f /root/cortex/.env ] && . /root/cortex/.env
MCP_URL="https://mcp.guardiacontent.com/mcp/call?key=${CORTEX_MCP_KEY:-}"

WIN="${COORD_WIN:-$(hostname)-$$}"
SESSION="${COORD_SESSION:-}"

mkdir -p "$CLAIMS_DIR"

now_epoch() { date +%s; }
now_iso()   { date -u +%Y-%m-%dT%H:%M:%SZ; }

iso_to_epoch() { date -u -d "${1:-}" +%s 2>/dev/null || echo 0; }

age_human() {
  local s="${1:-0}"
  if   [ "$s" -lt 60 ]   ; then echo "${s}s"
  elif [ "$s" -lt 3600 ] ; then echo "$((s/60))m"
  elif [ "$s" -lt 86400 ]; then echo "$((s/3600))h$(((s%3600)/60))m"
  else                          echo "$((s/86400))d$(((s%86400)/3600))h"
  fi
}

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
  # ★ Claiming a lane someone else holds silently DELETED their claim — same hole `release` had,
  # and it bit within the hour: a window re-claimed `hub` believing the board was free and
  # overwrote a live claim, leaving the board asserting the wrong owner while both edited one file.
  # Re-claiming your OWN lane stays free (that is how you update the note), and an unattributed
  # claim stays claimable so a crashed window's lane can be taken.
  if [ -f "$CLAIMS_DIR/$lane" ]; then
    local held; held=$(sed -n 's/^session=//p' "$CLAIMS_DIR/$lane")
    if [ -n "$held" ] && [ -n "$SESSION" ] && [ "$held" != "$SESSION" ] && [ "${COORD_FORCE:-}" != "1" ]; then
      echo "lane '$lane' is already claimed by session ${held:0:8} (yours: ${SESSION:0:8})."
      sed 's/^/  /' "$CLAIMS_DIR/$lane"
      echo "  take it anyway only if that window is gone: COORD_FORCE=1 coord claim $lane \"note\""
      return 1
    fi
  fi
  # ★ session= is written BEFORE note= on purpose: note is free text and is the
  # one field that could ever carry something odd, so it stays last where it can
  # only swallow itself. Empty when COORD_SESSION is unset — an unattributed
  # claim must read as "unknown", never get silently credited to whoever asks.
  printf 'owner=%s\nts=%s\nsession=%s\nnote=%s\n' "$WIN" "$(now_iso)" "$SESSION" "$note" > "$CLAIMS_DIR/$lane"
  echo "claimed lane '$lane' as '$WIN'${note:+ — $note}"
  signal "$WIN claims lane '$lane'${note:+ — $note}"
}

cmd_release() {
  local lane="${1:-$WIN}"
  if [ -f "$CLAIMS_DIR/$lane" ]; then
    # Releasing someone else's lane deletes the only record that they exist. A
    # claim we can positively attribute to a DIFFERENT session is the one case
    # worth blocking; an unattributed claim (legacy format, or a window that
    # never passed COORD_SESSION) stays freely releasable, because cleaning
    # those up is exactly what a human does after a crash.
    local sess; sess=$(sed -n 's/^session=//p' "$CLAIMS_DIR/$lane")
    if [ -n "$sess" ] && [ -n "$SESSION" ] && [ "$sess" != "$SESSION" ] && [ "${COORD_FORCE:-}" != "1" ]; then
      echo "refusing to release lane '$lane' — held by session ${sess:0:8}, not yours (${SESSION:0:8})."
      echo "  if that window is definitely gone: COORD_FORCE=1 coord release $lane"
      return 1
    fi
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
  # A satellite's dev server sets NEXT_DIST_DIR. If one ever leaks into this shell the
  # deploy would build somewhere else and pm2 would restart onto a stale `.next`, with
  # every log line still saying it succeeded. The production build dir is not negotiable.
  unset NEXT_DIST_DIR
  if npm run build && pm2 restart ather-games >/dev/null; then
    echo ">> build + restart OK"
    # Breadcrumb for the health monitor. The lock dies on the next line, but the
    # process we just restarted needs ~5min to look stable — without a marker that
    # outlives the deploy, a monitor tick in that window reads intentional deploy
    # restarts as a crash loop and pages. Written only on SUCCESS: a failed build
    # deploys nothing, so it must not buy suppression.
    date +%s > "$REPO/.coord/last-deploy" 2>/dev/null || true
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
  echo "=== window: $WIN${SESSION:+  (session ${SESSION:0:8})} ==="
  echo "--- lane claims ---"
  if ls "$CLAIMS_DIR"/* >/dev/null 2>&1; then
    for f in "$CLAIMS_DIR"/*; do
      local lane owner ts sess note ep age mark
      lane=$(basename "$f")
      owner=$(sed -n 's/^owner=//p' "$f"); ts=$(sed -n 's/^ts=//p' "$f")
      sess=$(sed -n 's/^session=//p' "$f"); note=$(sed -n 's/^note=//p' "$f")
      ep=$(iso_to_epoch "$ts")
      if [ "$ep" -gt 0 ]; then age="$(age_human $(( $(now_epoch) - ep ))) ago"; else age="?"; fi
      # ★ A CLAIM IS NOT PROOF A WINDOW IS ALIVE. This column is the whole point
      # of the field: say which session owns the lane, and say "?" plainly when
      # the claim predates this format. "?" means UNKNOWN, not dead — the tool
      # must not assert a liveness it cannot observe.
      if   [ -z "$sess" ]           ; then mark="session ?"
      elif [ "$sess" = "$SESSION" ] ; then mark="session ${sess:0:8} (YOU)"
      else                                 mark="session ${sess:0:8}"
      fi
      printf "  %-8s %-8s %-9s %-24s %s\n" "$lane" "$owner" "$age" "$mark" "${note:+— $note}"
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
