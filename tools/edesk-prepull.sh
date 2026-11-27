#!/usr/bin/env bash
# Runs ON the EliteDesk tree right before edesk-check's `git pull --ff-only` (11-27).
# A check writes its shots into the repo (docs/looks/...); the lane then commits the same shots on the box, and the next
# pull here aborts on "untracked working tree files would be overwritten", for EVERY lane. So: fetch, then for each
# untracked file that origin/master now tracks, delete it if byte-identical (git has it, nothing lost) or move it to
# /home/ajin/edesk-aside/<stamp>/ if it differs. Touches nothing else. Never fails the check: errors are only printed.
{
cd "${EDESK_REPO:-/home/ajin/ather-games}" || exit 0
git fetch -q origin || exit 0
aside="${EDESK_ASIDE:-/home/ajin/edesk-aside}/$(date -u +%Y%m%d-%H%M%S)"
git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
  theirs=$(git rev-parse -q --verify "origin/master:$f" 2>/dev/null) || continue
  if [ "$(git hash-object "$f")" = "$theirs" ]; then
    rm -f -- "$f" && echo "edesk-prepull: removed untracked copy identical to origin: $f"
  else
    mkdir -p "$aside/$(dirname "$f")" && mv -- "$f" "$aside/$f" && echo "edesk-prepull: moved differing untracked file aside: $f -> $aside/$f"
  fi
done
exit 0
}
