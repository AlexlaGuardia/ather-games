#!/usr/bin/env bash
# devwin — start a satellite window's own dev server.
#
# Why this exists: the swarm shares one working tree, so the only thing two windows
# actually collide on is build output and the port. Give each window its own
# `.next-<lane>` and its own port and they stop colliding, which is what lets a
# satellite SEE its work instead of waiting on the hub to deploy.
#
#   tools/devwin.sh <lane> [port]
#
# The production `.next` and port 3200 are refused on purpose: `coord build` deploys
# from `.next` and pm2 serves 3200, and a dev server pointed at either is the
# `.next`-corruption footgun the build lock exists to prevent.
#
# ── ★ AND IT STILL REACHED THE PRODUCTION BUILD ONCE, THROUGH tsconfig (2026-08-13) ──────────────
# Separate dist dirs are not separate enough on their own. Next.js REWRITES the shared
# `tsconfig.json` on dev start to add its dist dir to `include` — so running this appended
# `.next-world/dev/types/**/*.ts`, and the next `coord build` typechecked a LANE DEV SERVER's
# generated types as part of the production build. It failed on a half-written `validator.ts`
# (`Cannot find name 'vault'`) — a deploy broken by a file no human wrote, in a lane nobody was
# building. Worse, it is a cross-window failure: the satellite that ran devwin is not the window
# whose deploy breaks.
#
# Fixed at the root rather than by asking anyone to remember: `tsconfig.json` now carries
# `.next-*` in `exclude`, and **exclude filters include**, so Next may re-add whatever it likes and
# it stays out of the build. (`.next-*` does not match `.next`, so the production types still load.)
# ⚠ If you add a dist dir that is not named `.next-<lane>`, add it to that exclude too.
#
# ── ★★ AND THE REWRITE ITSELF IS NOW PREVENTED, NOT JUST DEFUSED (2026-08-17) ────────────────────
# The `exclude` above stops a lane's dev types reaching the production BUILD, which was the harmful
# half. It does nothing about the other half: while a satellite previews, `tsconfig.json` sits DIRTY
# in a tree four windows share, and one `git add -A` from any of them ships it. The `restore` trap
# below covers a clean exit and cannot cover a SIGKILL or a lost terminal.
#
# So `tsconfig.json` now PRE-SEEDS the four lane globs (`.next-{world,sprites,play,assets}` × both
# `types` and `dev/types`). Next only appends what is missing, so with them present it rewrites
# nothing at all — **verified by running this script and hashing the file before and after: byte
# identical, where an unseeded run comes back modified.** Excluded and seeded is not a contradiction:
# `include` decides what Next thinks it must add, `exclude` decides what the compiler reads.
# ⚠ A lane NOT in that list (anything falling through to port 3205) is unseeded and will still dirty
# the file — the trap is what catches it, so keep the trap.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# --own (anywhere): this lane gets its OWN next dev instead of joining the shared one. See below.
OWN=0; _args=()
for _a in "$@"; do if [ "$_a" = "--own" ]; then OWN=1; else _args+=("$_a"); fi; done
set -- "${_args[@]+"${_args[@]}"}"
LANE="${1:-}"
PORT="${2:-}"

if [ -z "$LANE" ]; then
  echo "usage: tools/devwin.sh <lane> [port] [--own]   (lane = world|sprites|play|assets|...)" >&2
  exit 2
fi

# Default port per lane so two satellites don't have to negotiate one.
if [ -z "$PORT" ]; then
  case "$LANE" in
    world)   PORT=3201 ;;
    sprites) PORT=3202 ;;
    play)    PORT=3203 ;;
    assets)  PORT=3204 ;;
    # The sound lane (2026-08-27, Alex: "i think we should have a whole lane for sound"). It gets a
    # named port for the same reason the others do: the catch-all 3205 is shared, so two unnamed
    # lanes silently fight over it and the loser's preview shows the winner's build.
    sound)   PORT=3206 ;;
    *)       PORT=3205 ;;
  esac
fi

if [ "$LANE" = "hub" ]; then
  echo "refusing: the hub deploys through 'coord build' and reads the real .next." >&2
  echo "A hub dev server is the collision this script exists to avoid." >&2
  exit 1
fi
if [ "$PORT" = "3200" ]; then
  echo "refusing port 3200 — that's the live pm2 server (ather-games)." >&2
  exit 1
fi

if [ "$PORT" = "${DEV_SHARED_PORT:-3210}" ]; then
  echo "refusing port $PORT: that is the shared dev server's own port; give the lane its own." >&2
  exit 1
fi

cd "$REPO"

# ── ★★★ ONE SHARED DEV SERVER, NOT ONE PER LANE (2026-11-26, serb, Alex's call) ─────────────────
# Everything above about per-lane dist dirs stays true history; what changed is that a lane no
# longer runs `next dev` at all. The tree is shared, so N servers compiled the same code N times at
# ~2 GB each, and four lanes OOM-shed the box four times on 11-26. Now this script (1) makes sure the
# ONE shared server is up (tools/devshared.sh: refcounted, memory-gated, :3210, dist .next-shared)
# and (2) holds the lane's own port as a ~15 MB forwarder onto it, so `--port 3203` checks and the
# lane-port habit keep working. Exiting stops the forwarder; the last lane out stops the server.
# The tsconfig notes above now apply to .next-shared (seeded the same way).
COORD_DIR="${COORD_DIR:-$REPO/.coord}"
DEVWINS_DIR="$COORD_DIR/devwins"
mkdir -p "$DEVWINS_DIR"
REG="$DEVWINS_DIR/$LANE"
# shellcheck source=devshared.sh
. "$REPO/tools/devshared.sh"

if [ -f "$REG" ] && kill -0 "$(sed -n 's/^pid=//p' "$REG")" 2>/dev/null; then
  echo "lane '$LANE' already has a live devwin ($(sed -n 's/^pid=//p' "$REG")): preview http://localhost:$PORT" >&2
  exit 1
fi
if port_listening "$PORT"; then
  echo "refusing: :$PORT is already in use by something that is not this lane's devwin (ss -ltnp | grep :$PORT)." >&2
  exit 1
fi

# ── --own: the escape hatch (2026-11-26, Alex's call) ─────────────────────────────────────────────
# For a lane that truly needs isolation from the shared server: it is changing next.config / env /
# middleware, or it needs a clean restart without kicking every other lane's preview. It is the old
# per-lane server (own `.next-<lane>`, own port, ~2 GB), so it waits at the memory gate first, and its
# record carries own=1 so it never counts as a user keeping the shared server alive.
if [ "$OWN" = 1 ]; then
  "$REPO/tools/coord.sh" memgate 2200 600 "own dev server for '$LANE'" || exit 1
  DIST=".next-$LANE"
  echo ">> lane '$LANE' --own: its own next dev, dist=$DIST port=$PORT (~2 GB; the shared server is untouched)"
  env NEXT_DIST_DIR="$DIST" npx next dev -p "$PORT" &
  DEV_PID=$!
  printf 'lane=%s\npid=%s\nport=%s\nsession=%s\nts=%s\nown=1\n' "$LANE" "$DEV_PID" "$PORT" "${COORD_SESSION:-}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$REG"
  echo ">> registered: $REG (pid $DEV_PID, own). 'coord release $LANE' or 'coord reap' stops it"
  cleanup_own() {
    if kill -0 "$DEV_PID" 2>/dev/null; then pkill -TERM -P "$DEV_PID" 2>/dev/null || true; kill -TERM "$DEV_PID" 2>/dev/null || true; fi
    rm -f "$REG"
    head="$(mktemp)"
    if git -C "$REPO" show HEAD:tsconfig.json > "$head" 2>/dev/null && ! cmp -s "$REPO/tsconfig.json" "$head"; then cp "$head" "$REPO/tsconfig.json"; echo ">> restored tsconfig.json from HEAD"; fi
    rm -f "$head"
  }
  trap cleanup_own EXIT INT TERM
  wait "$DEV_PID"
  exit $?
fi

shared_ensure || { echo "devwin: shared dev server unavailable; rely on tests or try again." >&2; exit 1; }

python3 "$REPO/tools/devfwd.py" "$PORT" "$DEV_SHARED_PORT" &
DEV_PID=$!
printf 'lane=%s\npid=%s\nport=%s\nsession=%s\nts=%s\nshared=%s\n' "$LANE" "$DEV_PID" "$PORT" "${COORD_SESSION:-}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$DEV_SHARED_PORT" > "$REG"
echo ">> lane '$LANE': http://localhost:$PORT -> shared dev server :$DEV_SHARED_PORT  (production stays on :3200)"
echo ">> registered: $REG (forwarder pid $DEV_PID). 'coord release $LANE' or 'coord reap' stops it; the last lane out stops the shared server"
cleanup_devwin() {
  kill -TERM "$DEV_PID" 2>/dev/null || true
  rm -f "$REG"
  shared_gc
}
trap cleanup_devwin EXIT INT TERM
wait "$DEV_PID"
