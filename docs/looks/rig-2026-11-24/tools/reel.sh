#!/bin/bash
# reel.sh <name> <tmpdir>: before (live hop-trot) over after (rigged), same speeds, same camera -> ../<name>-before-after.webm
set -e; H=$(cd "$(dirname "$0")" && pwd); N=$1; O=$2
for j in before rigged; do mkdir -p $O/$j; /opt/blender/blender -b -P $H/render.py -- $N $O/$j clip:$j >$O/$j.log 2>&1; done
F=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
ffmpeg -v error -y -framerate 24 -i $O/before/%04d.png -framerate 24 -i $O/rigged/%04d.png -filter_complex "[0]drawtext=fontfile=$F:text='before (live hop-trot)':x=10:y=8:fontsize=16:fontcolor=white[a];[1]drawtext=fontfile=$F:text='rigged':x=10:y=8:fontsize=16:fontcolor=white[b];[a][b]vstack" -c:v libvpx-vp9 -crf 34 -b:v 0 $H/../$N-before-after.webm
