#!/usr/bin/env bash
# BETA M94: refuse a build that would silently drop an uncommitted dev-page save (see tools/dev-written.txt).
#   tools/dev-written-check.sh [repo]   exit 0 = clear (source-class warnings may print), 3 = refused (data-class dirty)
set -u
REPO="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
LIST="$REPO/tools/dev-written.txt"
[ -f "$LIST" ] || { echo ">> ⚠ dev-written check: $LIST missing, skipped"; exit 0; }
paths() { awk -v c="$1" '$1==c {print $3}' "$LIST" | sort -u; }
dirty() { local p; p=$(paths "$1"); [ -n "$p" ] || return 0; git -C "$REPO" status --porcelain -- $p 2>/dev/null | grep -E '^( *[MADRC]|\?\?)' | sed -E 's/^...//' ; }
src=$(dirty source)
if [ -n "$src" ]; then
  echo ">> ⚠ uncommitted files a dev-page editor can write (NOT shipping; if a dev page saved them, commit them or the save is lost):"
  echo "$src" | sed 's/^/>>    /'
fi
dat=$(dirty data)
if [ -n "$dat" ]; then
  echo ">> ⛔ REFUSED: uncommitted dev-page saves. This build ships a snapshot of HEAD, so these would be DROPPED:"
  echo "$dat" | sed 's/^/>>    /'
  echo ">>   They are what an owner dev page wrote (a vote, an edit). Commit them, push, then build again:"
  echo ">>   git commit -m \"dev-page saves\" -- $(echo $dat) && git push"
  exit 3
fi
exit 0
