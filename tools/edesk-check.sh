#!/usr/bin/env bash
# Run a PROD browser check on the EliteDesk instead of this box (Alex 11-19: "can we use the desktop to help").
# Chrome lives there, so a check never competes with the live site for this server's 8 GB, and lanes don't have to
# take turns on one browser. ONLY for checks aimed at https://ather.games: the EliteDesk cannot see localhost devwins.
#   tools/edesk-check.sh scripts/<check>.mts [args...]        e.g. tools/edesk-check.sh scripts/gem-check.mts --url https://ather.games
# It runs what is PUSHED on origin/master (git pull there first), so push your check before you run it.
# Output: the full log is printed here; screenshots/out dirs stay on the EliteDesk under /home/ajin/edesk-out/<check>/.
# Exit code = the check's. The desktop must be powered on; if ssh fails, run the check here as before (one browser at a time).
set -uo pipefail
[ $# -ge 1 ] || { sed -n 2,8p "$0"; exit 2; }
script="$1"; shift
name=$(basename "$script" .mts)
args=""
for a in "$@"; do args+=" $(printf '%q' "$a")"; done
/root/cortex/scripts/elitedesk "su - ajin -c 'cd /home/ajin/ather-games && git pull -q --ff-only && mkdir -p /home/ajin/edesk-out/$name && cd /home/ajin/ather-games && timeout 1800 npx tsx $script$args > /home/ajin/edesk-out/$name/log.txt 2>&1; rc=\$?; cat /home/ajin/edesk-out/$name/log.txt; echo EDESK_EXIT=\$rc'" 2>&1 | tr -d '\000' | tee /dev/stderr | grep -o 'EDESK_EXIT=[0-9]*' | tail -1 | { IFS== read -r _ rc; exit "${rc:-99}"; }
