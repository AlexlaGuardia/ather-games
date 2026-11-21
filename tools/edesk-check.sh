#!/usr/bin/env bash
# Run a PROD browser check on the EliteDesk instead of this box (Alex 11-19: "can we use the desktop to help").
# Chrome lives there, so a check never competes with the live site for this server's 8 GB, and lanes don't have to
# take turns on one browser. ONLY for checks aimed at https://ather.games: the EliteDesk cannot see localhost devwins.
#   tools/edesk-check.sh scripts/<check>.mts [args...]        e.g. tools/edesk-check.sh scripts/gem-check.mts --url https://ather.games
# It runs what is PUSHED on origin/master (git pull there first), so push your check before you run it.
# Output: the full log is printed here; each run's log stays on the EliteDesk under /home/ajin/edesk-out/<check>-<lane>-<stamp>-<pid>/
# (edesk-out/<check>-latest points at the newest), and its screenshots wherever the check's own --out says.
# EDESK_TIMEOUT=<s> raises the 1800 s cap for a long check (11-21: the M9 30-min heap run). Exit code = the check's. The desktop must be powered on; if ssh fails, run the check here as before (one browser at a time).
set -uo pipefail
[ $# -ge 1 ] || { sed -n 2,8p "$0"; exit 2; }
script="$1"; shift
name=$(basename "$script" .mts)
args=""
for a in "$@"; do args+=" $(printf '%q' "$a")"; done
# ★ A RUN GETS ITS OWN FOLDER (11-20): edesk-out/<script>-<lane>-<utc stamp>-<pid>/log.txt, plus edesk-out/<script>-latest ->
# the newest run. The old shared edesk-out/<script>/log.txt let two windows running ONE check truncate each other's log
# mid-run (11-19 night: a phone loop and a desktop glade-check). Pass --out <dir> to put a check's screenshots elsewhere.
run="$name-${COORD_WIN:-nolane}-$(date -u +%m%d-%H%M%S)-$$"
/root/cortex/scripts/elitedesk "su - ajin -c 'cd /home/ajin/ather-games && git pull -q --ff-only && mkdir -p /home/ajin/edesk-out/$run && cd /home/ajin/ather-games && timeout ${EDESK_TIMEOUT:-1800} npx tsx $script$args > /home/ajin/edesk-out/$run/log.txt 2>&1; rc=\$?; ln -sfn $run /home/ajin/edesk-out/$name-latest; cat /home/ajin/edesk-out/$run/log.txt; echo EDESK_RUN=$run; echo EDESK_EXIT=\$rc'" 2>&1 | tr -d '\000' | tee /dev/stderr | grep -o 'EDESK_EXIT=[0-9]*' | tail -1 | { IFS== read -r _ rc; exit "${rc:-99}"; }
