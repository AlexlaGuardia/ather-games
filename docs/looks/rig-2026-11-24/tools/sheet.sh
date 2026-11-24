#!/bin/bash
# sheet.sh <name> <outdir>: contact sheet of the rigged clips (6 frames each: idle, sit, walk, run; then the far side + 3/4)
set -e; H=$(cd "$(dirname "$0")" && pwd); N=$1; O=$2
/opt/blender/blender -b -P $H/render.py -- $N $O sheet >$O.log 2>&1
cd $O; IN=""; LAY=""; i=0
for c in idle sit walk run; do for k in 0 1 2 3 4 5; do IN="$IN -i ${c}_$k.png"; LAY="$LAY|$((k*300))_$((i*260))"; done; i=$((i+1)); done
for c in walk run; do for k in o0 o2 o4 q0 q2 q4; do IN="$IN -i ${c}_$k.png"; done; for k in 0 1 2 3 4 5; do LAY="$LAY|$((k*300))_$((i*260))"; done; i=$((i+1)); done
ffmpeg -v error -y $IN -filter_complex "xstack=inputs=36:layout=${LAY#|}" sheet.png
