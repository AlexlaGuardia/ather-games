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
#     ★ Make the note FALSIFIABLE, not a self-description. "solo jin session" reads fresh (its
#       timestamp keeps updating) while its content rots, and a peer reasoning correctly from it
#       force-took a live lane (2026-08-25). Write something a reader can check in one command:
#       "live hub — HEAD=<sha>, tree clean 0 unpushed (verify: git status)".
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
      # ★ session= stamped on the LOCK, not just owner=. owner is the lane name ("hub"), which is
      # byte-identical across two windows that both call themselves hub — so it cannot tell a slow
      # build of MINE from a live PEER's. session can. (Hardened 2026-08-25; diagnosis by 164b5211.)
      printf 'owner=%s\nsession=%s\nts=%s\npid=%s\n' "$WIN" "$SESSION" "$(now_epoch)" "$$" > "$LOCKDIR/info"
      return 0
    fi
    # lock exists. Steal ONLY a stale lock we can positively attribute to NOBODY (empty session) or
    # to OURSELVES. A stale lock stamped with a different, non-empty session may be a peer's slow
    # build — rm -rf would corrupt it while every line of output still says the lane name. That one
    # case needs an explicit COORD_FORCE=1, the same asymmetry claim/release already encode.
    local age held; age=$(lock_age); held=$(sed -n 's/^session=//p' "$LOCKDIR/info" 2>/dev/null)
    local attributed_to_peer=0
    [ -n "$held" ] && [ -n "$SESSION" ] && [ "$held" != "$SESSION" ] && [ "${COORD_FORCE:-}" != "1" ] && attributed_to_peer=1
    if [ "$age" -gt "$STALE_LOCK_SECS" ] && [ "$attributed_to_peer" = "0" ]; then
      echo "build lock stale (${age}s, held by: $(lock_owner_info | tr '\n' ' ')) — stealing"
      rm -rf "$LOCKDIR"
      continue
    fi
    if [ "$waited" -ge "$WAIT_SECS" ]; then
      echo "could not acquire build lock after ${WAIT_SECS}s. Held by:"
      lock_owner_info | sed 's/^/  /'
      [ "$attributed_to_peer" = "1" ] && echo "  ⚠ stale (${age}s) but attributed to live session ${held:0:8}, not yours — NOT auto-stolen. If that window is truly gone: COORD_FORCE=1 ... coord build"
      return 1
    fi
    echo "build lock held by $(sed -n 's/^owner=//p' "$LOCKDIR/info" 2>/dev/null)${held:+ (session ${held:0:8})} — waiting... (${waited}s)"
    sleep 6; waited=$((waited+6))
  done
}

release_lock() { rm -rf "$LOCKDIR"; }

cmd_build() {
  local msg="${*:-deploy}"
  acquire_lock || exit 1
  trap release_lock EXIT
  echo ">> build lock acquired by '$WIN'"
  # ── ★★ THE BUILD CARRIES ITS OWN OBSERVATION, TAKEN HERE (2026-08-20, second incident) ────────
  # The post-deploy warning below tells you what you just shipped. That is one line too late by
  # design, and the fix for it is NOT "remember to run `git status` first" — the same seat DID run
  # it, hit a full-disk build failure, spent fifteen minutes clearing space, and re-ran without
  # re-checking. **The check was real and it expired.** A pre-build check made by a human is a
  # perishable observation, and every minute between the check and the build is a window another
  # window can commit into; a check taken HERE cannot go stale, because there is no gap.
  #
  # ⚠ It prints and continues — it does not prompt and does not refuse. A build that stops to ask
  # is a build people stop running, and on a shared box the deploy path must stay boring. Naming
  # the files is enough: "greedy.ts is dirty and it isn't mine" is a thought you can only have if
  # something says `greedy.ts`.
  local pre
  pre=$(git -C "$REPO" status --porcelain 2>/dev/null | grep '^ *[MADRC]' || true)
  if [ -n "$pre" ]; then
    echo ">> ⚠ BUILDING A DIRTY TREE — these uncommitted files are about to go live:"
    echo "$pre" | sed 's/^/>>    /'
    echo ">>   if any of them are not yours, STOP and ask that window before this ships."
  fi
  signal "$WIN building: $msg"
  cd "$REPO"
  # A satellite's dev server sets NEXT_DIST_DIR. If one ever leaks into this shell the
  # deploy would build somewhere else and pm2 would restart onto a stale `.next`, with
  # every log line still saying it succeeded. The production build dir is not negotiable.
  unset NEXT_DIST_DIR
  if npm run build && pm2 restart ather-games >/dev/null; then
    # ── ★★★ THE ARTIFACT HAS TO BE WHOLE, AND `npm run build` EXITING 0 DOES NOT PROVE IT ──────
    # 2026-08-27: a build was KILLED MID-WRITE by a harness timeout (the caller passed
    # `timeout 900`; the tool's own 2-minute ceiling won). The trap released the lock cleanly, so
    # the board read FREE, and **prod kept answering 200 for forty minutes** — because the running
    # pm2 process had started from the PREVIOUS good build and was serving what it already had.
    # `.next` had no BUILD_ID. The next restart, from anyone — another window, the mem-watcher,
    # a reboot — would have brought the site up against a half-written artifact.
    #
    # ⚠⚠ SO `prod answers 200` IS NOT EVIDENCE `.next` IS COMPLETE, and neither is a clean lock.
    # The one cheap question that IS evidence: does the build id exist, and are there chunks under
    # it. Asked here, on the success path, because a build that dies must not be able to leave the
    # board saying "free" and the tree saying "fine".
    if [ ! -f "$REPO/.next/BUILD_ID" ]; then
      echo ">> ⚠⚠ INCOMPLETE ARTIFACT — .next has no BUILD_ID after a build that reported success."
      echo ">>   prod may still answer 200 from the OLD build the running process started with."
      echo ">>   DO NOT restart ather-games. Re-run this build to completion first."
      exit 1
    fi
    _chunks=$(ls "$REPO"/.next/static/chunks/*.js 2>/dev/null | wc -l)
    if [ "$_chunks" -lt 20 ]; then
      echo ">> ⚠⚠ INCOMPLETE ARTIFACT — BUILD_ID exists but only $_chunks chunk(s) under .next/static."
      echo ">>   Re-run this build to completion before anything restarts."
      exit 1
    fi
    echo ">> artifact OK — BUILD_ID $(cat "$REPO/.next/BUILD_ID"), $_chunks chunks"
    echo ">> build + restart OK"
    # Breadcrumb for the health monitor. The lock dies on the next line, but the
    # process we just restarted needs ~5min to look stable — without a marker that
    # outlives the deploy, a monitor tick in that window reads intentional deploy
    # restarts as a crash loop and pages. Written only on SUCCESS: a failed build
    # deploys nothing, so it must not buy suppression.
    date +%s > "$REPO/.coord/last-deploy" 2>/dev/null || true
    signal "$WIN deployed OK: $msg"
    # ── ★★ DEPLOYED AND PUSHED ARE DIFFERENT FACTS, AND ONLY ONE OF THEM LEAVES EVIDENCE ────────
    # 2026-08-20: two commits ran live on prod for half an hour while existing on this box only.
    # Nobody was careless — prod answered 200 with the right pixels, which FEELS like completion,
    # so nothing prompted anyone to check the half that leaves no trace. And on a shared box with a
    # single working tree the gap is invisible by construction: every window's tree agrees, so no
    # window can see it by looking at what it has. Only `origin` knows, and nothing asked it.
    #
    # So the deploy asks. Purely advisory — it must never fail a build that succeeded, and it must
    # never push for you: pushing is a judgment call (a satellite may be mid-rebase, a commit may be
    # deliberately local) and a script that pushes on your behalf turns a visible omission into an
    # invisible action. State the fact, name the command, stop.
    # ⚠⚠ AND THE DIRTY-TREE CASE IS THE WORSE ONE, ADDED THE SAME DAY THE ABOVE WAS. The first
    # version counted COMMITS ahead of origin — and I promptly deployed an uncommitted tree past it,
    # because `ahead` is 0 when nothing has been committed at all. **Unpushed means prod runs code
    # that exists on one box; UNCOMMITTED means prod runs code that exists in no history anywhere**,
    # which no `git` command will ever recover if the file is edited again. The narrower guard read
    # as covering the general problem, and it silently covered the milder half of it.
    local dirty
    dirty=$(git -C "$REPO" status --porcelain 2>/dev/null | grep -c '^ *[MADRC]' || true)
    if [ "${dirty:-0}" -gt 0 ] 2>/dev/null; then
      echo ">> ⚠⚠ DEPLOYED FROM A DIRTY TREE — $dirty modified file(s) are live on prod and in no commit."
      echo ">>   git add -p && git commit    (then push; see below)"
    fi
    local ahead
    ahead=$(git -C "$REPO" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
    if [ "${ahead:-0}" -gt 0 ] 2>/dev/null; then
      echo ">> ⚠ DEPLOYED BUT NOT PUSHED — $ahead commit(s) live on prod exist only on this box."
      echo ">>   git push origin master   (pull --rebase first if a satellite has landed work)"
    fi
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
