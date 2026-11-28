"""M244 sheet 12: RILLESSE's rig = sheet 11's rig_croakalys.py (m244-croakara-2026-11-28/tools, read and run, never edited) with HER sculpt
module (sculpt_rillesse.py) swapped in: sheet 9's ground biped (root, pelvis, spine, chest, neck, head, two arms + forearms, two legs + shins,
a four-bone tail, a motif bone on the chest), Croakalys's own clips (idle = arms up, a bouncing sway: her dance), the PELVIS solved so her
lowest point (body, eyes, the drops on her chest) sits on the ground every frame, the root never moves (her lily pad rides it).
    python rig_rillesse.py <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
SRC = os.path.join(HERE, '../../m244-croakara-2026-11-28/tools/rig_croakalys.py'); src = open(SRC).read()
for a, b in (("import sculpt_croakalys as F", "import sculpt_rillesse as F"), ("NAME = 'croakalys'", "NAME = 'rillesse'")):
    assert a in src, a; src = src.replace(a, b)
exec(compile(src, 'rig_croakalys(rillesse)', 'exec'), dict(__name__='__main__', __file__=os.path.abspath(__file__)))
# + body_verts: her body's vertex count as the glb carries it (the ~9k budget)
import json, trimesh
_o, _m = (sys.argv[3], sys.argv[4]) if len(sys.argv) > 4 else (sys.argv[2], sys.argv[3]); _M = json.load(open(_m))
_M['body_verts'] = int(len(trimesh.load(_o, force='scene').geometry['body'].vertices)); json.dump(_M, open(_m, 'w'), indent=1); print('body_verts', _M['body_verts'])
