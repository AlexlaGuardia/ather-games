"""M244 sheet 12: the rig for Croakrillok / Croakrillvex / Croakrilleth:  python rig_croakrillaw.py <ok|vex|eth> <in.glb> <out-rigged.glb> <metrics.json>
Runs sheet 11's rig_croakaraw.py (m244-croakara-2026-11-28/tools, read and run, never edited) with HER sculpt module (sculpt_croakrillaw.py)
swapped in: so she gets the live Croakrill's rig = the BASE Croakling's own rig (19 bones, five clips: idle, walk hops, run bounds, sit croaks,
lie asleep) fitted to her landmarks, + her AURA part (the motif: AURA_ROOT colours ride the root = Croakrilleth's cloud + rain; AURA_HIPS ride the hips =
Croakrillvex's wake + bubbles, as one piece; the rest is skinned to the nearest body vertex = Croakrillok's jet off her mouth), the base ground() / low() counting the aura, and
sheet 11's baked springs on the lure chain. Writes body_mean_top, aura_lowest_glb, glbLen, jiggle_peak_rad into her metrics."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
SRC = os.path.join(HERE, '../../m244-croakara-2026-11-28/tools/rig_croakaraw.py'); src = open(SRC).read()
for a, b in (("os.environ['CROAKARAW_FORM'] = FORM", "os.environ['CROAKRILLAW_FORM'] = FORM"), ("import sculpt_croakaraw as F; S = F.S", "import sculpt_croakrillaw as F; S = F.S"),
             ("aw[lu] = 0; aw[lu, ix('lure3')] = 1;", "hp = isc(F.AURA_HIPS); aw[hp] = 0; aw[hp, ix('hips')] = 1; aw[lu] = 0; aw[lu, ix('lure3')] = 1;")):
    assert a in src, a; src = src.replace(a, b)
exec(compile(src, 'rig_croakaraw(croakrill)', 'exec'), dict(__name__='__main__', __file__=os.path.abspath(__file__)))
# + body_verts: her body's vertex count as the glb carries it (the ~9k budget)
import json, trimesh
_o, _m = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else (sys.argv[2], sys.argv[3]); _M = json.load(open(_m))
_M['body_verts'] = int(len(trimesh.load(_o, force='scene').geometry['body'].vertices)); json.dump(_M, open(_m, 'w'), indent=1); print('body_verts', _M['body_verts'])
