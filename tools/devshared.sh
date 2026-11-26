# devshared: the ONE shared dev server every lane previews through (2026-11-26, serb, Alex's call).
# Sourced by tools/devwin.sh and tools/coord.sh. Callers define REPO, COORD_DIR, DEVWINS_DIR.
#
# Why: every lane edits the SAME working tree, yet each ran its own `next dev` (~2 GB apiece) with
# its own dist dir, so four lanes compiled identical code four times. On the 8 GB box that was four
# OOM sheds on 11-26 (09:03 09:43 10:32 15:56), each killing a ~2 GB dev server mid-check. Now:
#   - the first lane to need a preview starts ONE `next dev` on :$DEV_SHARED_PORT (dist .next-shared);
#   - each lane's own port (3201 world, 3203 play, ...) is a ~15 MB forwarder onto it (tools/devfwd.py),
#     so every check that passes `--port <lane port>` still works unchanged;
#   - the shared server is refcounted by the lane records in .coord/devwins/: when the last live one
#     goes (devwin exit, `coord release`, `coord reap`), shared_gc stops it.
# Trade-off accepted: a peer's broken edit breaks every lane's preview. It already broke every build.
# ⚠ If mem-watcher sheds the shared server, the forwarders stay up; the next `devwin.sh` restarts it
#   and every lane's port works again with nothing re-run.
DEV_SHARED_PORT="${DEV_SHARED_PORT:-3210}"
DEV_SHARED_DIST=".next-shared"          # seeded in tsconfig.json include + covered by the .next-* exclude
SHARED_REC="$COORD_DIR/devshared"       # pid=, port=, ts=  (NOT inside devwins/: it is not a lane)
SHARED_LOCKF="$COORD_DIR/devshared.lock"
SHARED_LOG="$COORD_DIR/devshared.log"

_ds_kill_tree() { local p="$1" c; for c in $(pgrep -P "$p" 2>/dev/null); do _ds_kill_tree "$c"; done; kill -TERM "$p" 2>/dev/null || true; }
shared_pid()   { sed -n 's/^pid=//p' "$SHARED_REC" 2>/dev/null; }
shared_alive() { local p; p=$(shared_pid); [ -n "$p" ] && kill -0 "$p" 2>/dev/null; }
port_listening() { (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Count lane records whose forwarder pid is alive.
shared_users() {
  local f p n=0
  for f in "$DEVWINS_DIR"/*; do
    [ -e "$f" ] || continue
    p=$(sed -n 's/^pid=//p' "$f"); [ -n "$p" ] && kill -0 "$p" 2>/dev/null && n=$((n+1))
  done
  echo "$n"
}

# Start the shared server if it is not running. Holds the flock across the memory gate + start so two
# lanes booting at once start ONE server. Waits (capped) until the port answers.
shared_ensure() {
  mkdir -p "$COORD_DIR"
  (
    flock -w 900 9 || { echo "devshared: could not take $SHARED_LOCKF in 15 min" >&2; exit 1; }
    if shared_alive; then exit 0; fi
    # A fresh `next dev` of this app grows to ~2 GB: wait for room instead of starting and being shed.
    "$REPO/tools/coord.sh" memgate 2500 600 "shared dev server start" || exit 1
    cd "$REPO"
    echo ">> starting the shared dev server: :$DEV_SHARED_PORT dist=$DEV_SHARED_DIST (log $SHARED_LOG)"
    # setsid: it must outlive the lane shell that happened to start it. `9>&-`: it must NOT inherit the
    # flock fd, or the server holds the lock for its whole life and every other lane hangs joining (found in test).
    NEXT_DIST_DIR="$DEV_SHARED_DIST" setsid npx next dev -p "$DEV_SHARED_PORT" > "$SHARED_LOG" 2>&1 < /dev/null 9>&- &
    printf 'pid=%s\nport=%s\nts=%s\n' "$!" "$DEV_SHARED_PORT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SHARED_REC"
  ) 9>"$SHARED_LOCKF" || return 1
  if ! timeout 240 bash -c "until (echo > /dev/tcp/127.0.0.1/$DEV_SHARED_PORT) 2>/dev/null; do sleep 2; done"; then
    echo "devshared: :$DEV_SHARED_PORT did not answer in 240 s; tail of $SHARED_LOG:" >&2
    tail -20 "$SHARED_LOG" >&2
    return 1
  fi
}

# Stop the shared server when no lane uses it. Safe to call from anywhere, any time.
shared_gc() {
  mkdir -p "$COORD_DIR"
  (
    flock -w 60 9 || exit 0
    [ -f "$SHARED_REC" ] || exit 0
    [ "$(shared_users)" -gt 0 ] && exit 0
    p=$(shared_pid)
    if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then
      _ds_kill_tree "$p"; sleep 1; kill -0 "$p" 2>/dev/null && kill -KILL "$p" 2>/dev/null || true
      echo "stopped the shared dev server (pid $p, :$DEV_SHARED_PORT): no lane uses it"
    fi
    rm -f "$SHARED_REC"
    # next dev may have touched tsconfig at start; the committed file is the only clean one.
    head="$(mktemp)"
    if git -C "$REPO" show HEAD:tsconfig.json > "$head" 2>/dev/null && ! cmp -s "$REPO/tsconfig.json" "$head"; then
      cp "$head" "$REPO/tsconfig.json"; echo ">> restored tsconfig.json from HEAD"
    fi
    rm -f "$head"
  ) 9>"$SHARED_LOCKF"
  return 0
}
