#!/usr/bin/env bash
# dev-written.test (BETA M94): (1) every route that writes a file is in tools/dev-written.txt, and every path literal it joins is
# covered by one of its rows; (2) the check REFUSES a dirty data file (naming it), only WARNS on a dirty source file, and passes a
# clean tree. Scratch git repo for (2), never the real tree.   bash tools/dev-written.test.sh
set -u
cd "$(dirname "$0")/.."
pass=0; fail=0
ok() { if [ "$1" = 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); echo "  ✗ $2"; fi }
LIST=tools/dev-written.txt
rows() { grep -vE '^\s*(#|$)' "$LIST"; }

# (1) the list covers every writing route
for f in $(grep -rlE "writeFile|safeWriteFile" src/app --include=route.ts); do
  rows | awk -v r="$f" '$2==r' | grep -q . ; ok $? "writing route not in $LIST: $f"
  for lit in $(grep -oE "join\(process\.cwd\(\), *'[^']+'( *, *'[^']+')*" "$f" | sed -E "s/join\(process\.cwd\(\), *//; s/'//g; s/ *, */\//g" | sort -u); do
    covered=1
    for p in $(rows | awk -v r="$f" '$2==r {print $3}'); do
      case "$lit/" in "$p"*) covered=0 ;; esac; case "$p" in "$lit"|"$lit/"*) covered=0 ;; esac
    done
    ok $covered "$f joins '$lit', which none of its rows cover"
  done
done
for p in $(rows | awk '$1!="runtime" {print $3}' | sort -u); do [ -d "$(dirname "${p%/}")" ]; ok $? "listed path has no parent dir (typo?): $p"; done   # a route may create the file itself on first save
rows | awk '$1!="data" && $1!="source" && $1!="runtime"' | grep -q . ; [ $? = 1 ]; ok $? "a row has an unknown class"

# (2) the check, in a scratch repo
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/tools" "$T/src/app/shimmer/open/shared" "$T/src/app/shimmer/world"
cp tools/dev-written-check.sh "$T/tools/"; cp "$LIST" "$T/tools/"
echo '[]' > "$T/src/app/shimmer/open/shared/sounds.json"; echo 'export {}' > "$T/src/app/shimmer/world/npcs.ts"
git -C "$T" init -q && git -C "$T" add -A && git -C "$T" -c user.email=t@t -c user.name=t commit -qm init
out=$(bash "$T/tools/dev-written-check.sh" "$T"); rc=$?
[ "$rc" = 0 ] && [ -z "$out" ]; ok $? "a clean tree passes silently (rc $rc)"
echo 'export const x = 1' > "$T/src/app/shimmer/world/npcs.ts"
out=$(bash "$T/tools/dev-written-check.sh" "$T"); rc=$?
[ "$rc" = 0 ] && echo "$out" | grep -q 'npcs.ts'; ok $? "a dirty SOURCE file warns, names it, and does not refuse (rc $rc)"
echo '[{"id":"x","status":"yay"}]' > "$T/src/app/shimmer/open/shared/sounds.json"
out=$(bash "$T/tools/dev-written-check.sh" "$T"); rc=$?
[ "$rc" = 3 ] && echo "$out" | grep -q 'REFUSED' && echo "$out" | grep -q 'sounds.json'; ok $? "a dirty sounds.json REFUSES (rc 3) and names it (rc $rc)"
git -C "$T" -c user.email=t@t -c user.name=t commit -qm vote -- src/app/shimmer/open/shared/sounds.json
bash "$T/tools/dev-written-check.sh" "$T" >/dev/null; ok $? "committed, it clears"
mkdir -p "$T/src/app/shimmer/data/blueprints"; echo '{}' > "$T/src/app/shimmer/data/blueprints/new.json"
bash "$T/tools/dev-written-check.sh" "$T" >/dev/null; [ $? = 3 ]; ok $? "an UNTRACKED file in a data dir refuses too"

echo "dev-written: $pass pass, $fail fail"
[ "$fail" = 0 ]
