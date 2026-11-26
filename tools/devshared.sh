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
    grep -q '^own=1' "$f" 2>/dev/null && continue   # a --own lane runs its own server, not a user of this one
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
    _shared_start
  ) 9>"$SHARED_LOCKF" || return 1
  shared_wait_up
}

# Caller holds the flock. Starts next dev, writes the record. Does not wait.
_shared_start() {
    cd "$REPO"
    echo ">> starting the shared dev server: :$DEV_SHARED_PORT dist=$DEV_SHARED_DIST (log $SHARED_LOG)"
    # setsid: it must outlive the lane shell that happened to start it. `9>&-`: it must NOT inherit the
    # flock fd, or the server holds the lock for its whole life and every other lane hangs joining (found in test).
    NEXT_DIST_DIR="$DEV_SHARED_DIST" setsid npx next dev -p "$DEV_SHARED_PORT" > "$SHARED_LOG" 2>&1 < /dev/null 9>&- &
    printf 'pid=%s\nport=%s\nts=%s\n' "$!" "$DEV_SHARED_PORT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SHARED_REC"
}

shared_wait_up() {
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

# Total RSS (MB) of the shared server's process tree (npx wrapper + node + next-server + workers).
shared_tree_rss_mb() {
  local p; p=$(shared_pid); [ -n "$p" ] || { echo 0; return; }
  local all="$p" q kids frontier="$p"
  while [ -n "$frontier" ]; do
    kids=""; for q in $frontier; do kids="$kids $(pgrep -P "$q" 2>/dev/null | tr '\n' ' ')"; done
    frontier="$(echo $kids)"; all="$all $frontier"
  done
  ps -o rss= -p "$(echo $all | tr ' ' ',')" 2>/dev/null | awk '{s+=$1} END{print int(s/1024)}'
}

# ── ★ RECYCLE A BLOATED SHARED SERVER (2026-11-26, serb, Alex's call) ────────────────────────────
# A long-running `next dev` creeps (Turbopack caches every route it ever compiled). One bloated server
# is the next mem-watcher shed and it takes EVERY lane's preview with it, so it is restarted on our
# terms instead: only when it is over the size AND idle (its log, which gets a line per request and per
# recompile, quiet for $idle s, and nobody holding the box browser). Lanes still forwarding get a fresh
# server on the same port with no action of theirs (their forwarders never stop); no lanes = just stop.
#   shared_recycle [force]      restart now (force) ...
#   shared_recycle_if_bloated <mb> <idle_s>   ... or only under those conditions (mem_watcher calls this)
shared_recycle() {
  mkdir -p "$COORD_DIR"
  (
    flock -w 60 9 || { echo "devshared: lock busy, recycle skipped" >&2; exit 1; }
    shared_alive || { echo "devshared: no shared server running"; exit 0; }
    p=$(shared_pid); rss=$(shared_tree_rss_mb)
    _ds_kill_tree "$p"; sleep 2; kill -0 "$p" 2>/dev/null && kill -KILL "$p" 2>/dev/null || true
    rm -f "$SHARED_REC"
    if [ "$(shared_users)" -gt 0 ]; then
      echo "recycled the shared dev server (was pid $p, ${rss} MB): restarting for $(shared_users) lane(s)"
      _shared_start
    else
      echo "stopped the shared dev server (was pid $p, ${rss} MB): no lane uses it"
    fi
  ) 9>"$SHARED_LOCKF"
}
shared_recycle_if_bloated() {
  local mb="${1:-3000}" idle="${2:-300}" rss quiet
  shared_alive || return 0
  rss=$(shared_tree_rss_mb); [ "$rss" -ge "$mb" ] || return 0
  quiet=$(( $(date +%s) - $(stat -c %Y "$SHARED_LOG" 2>/dev/null || echo 0) ))
  [ "$quiet" -ge "$idle" ] || { echo "shared dev server ${rss} MB >= ${mb} but busy (log ${quiet}s ago); not recycling"; return 0; }
  [ -f "$COORD_DIR/browser" ] && { echo "shared dev server ${rss} MB but the box browser is held; not recycling"; return 0; }
  shared_recycle
}
