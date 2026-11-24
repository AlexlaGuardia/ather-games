#!/bin/bash
# reel-v2.sh <tmpdir>: v1 (left) vs v2 (right), side over rear three-quarter -> ../manalotl-v1-v2.webm + ../contact-sheet-v2.jpg
set -e; H=$(cd "$(dirname "$0")" && pwd); O=$1; F=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
for v in v1 v2; do for j in side rear; do mkdir -p $O/$v$j; /opt/blender/blender -b -P $H/render_v2.py -- $v $O/$v$j clip:$j >$O/$v$j.log 2>&1; done; mkdir -p $O/$v; /opt/blender/blender -b -P $H/render_v2.py -- $v $O/$v views >$O/$v.log 2>&1; done
T="drawtext=fontfile=$F:x=10:y=8:fontsize=16:fontcolor=white:text="
ffmpeg -v error -y -framerate 24 -i $O/v1side/%04d.png -framerate 24 -i $O/v2side/%04d.png -framerate 24 -i $O/v1rear/%04d.png -framerate 24 -i $O/v2rear/%04d.png -filter_complex "[0]${T}'v1'[a];[1]${T}'v2 (tail freed, lower front)'[b];[2]null[c];[3]null[d];[a][b][c][d]xstack=inputs=4:layout=0_0|480_0|0_300|480_300,drawtext=fontfile=$F:x=10:y=578:fontsize=14:fontcolor=white:text='lying, standing, walk 0.42 m/s, run 0.62 m/s'" -c:v libvpx-vp9 -crf 36 -b:v 0 $H/../manalotl-v1-v2.webm
ffmpeg -v error -y -i $O/v1/views.png -i $O/v2/views.png -filter_complex "[0]${T}'v1'[a];[1]${T}'v2  (rows = stand, walk, walk half a stride later, run, lying)'[b];[a][b]vstack,scale=1680:-1" -q:v 4 $H/../contact-sheet-v2.jpg
