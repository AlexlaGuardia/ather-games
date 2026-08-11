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
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LANE="${1:-}"
PORT="${2:-}"

if [ -z "$LANE" ]; then
  echo "usage: tools/devwin.sh <lane> [port]   (lane = world|sprites|play|assets|...)" >&2
  exit 2
fi

# Default port per lane so two satellites don't have to negotiate one.
if [ -z "$PORT" ]; then
  case "$LANE" in
    world)   PORT=3201 ;;
    sprites) PORT=3202 ;;
    play)    PORT=3203 ;;
    assets)  PORT=3204 ;;
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

DIST=".next-$LANE"
if [ "$DIST" = ".next" ]; then
  echo "refusing: dist dir resolved to the production .next" >&2
  exit 1
fi

cd "$REPO"

# `next dev` appends its build dir's type globs to tsconfig.json on startup. In a shared
# tree that means every lane leaves a diff another window could sweep into a commit, so
# snapshot it and put it back on the way out.
TSCONFIG="$REPO/tsconfig.json"
TSBACKUP="$(mktemp)"
cp "$TSCONFIG" "$TSBACKUP"
restore_tsconfig() {
  if ! cmp -s "$TSCONFIG" "$TSBACKUP"; then
    cp "$TSBACKUP" "$TSCONFIG"
    echo ">> restored tsconfig.json (next dev had added $DIST type globs)"
  fi
  rm -f "$TSBACKUP"
}
trap restore_tsconfig EXIT INT TERM

echo ">> lane '$LANE'  dist=$DIST  port=$PORT"
echo ">> preview: http://localhost:$PORT  (production stays on :3200, untouched)"
env NEXT_DIST_DIR="$DIST" npx next dev -p "$PORT"
