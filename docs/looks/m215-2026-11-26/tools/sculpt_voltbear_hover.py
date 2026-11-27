"""M215 (Alex 11-26): VOLTBEAR WITHOUT LEGS, a thundercloud cocoon that hovers. Her M202 body (sculpt_voltbear.py, untouched) with
the four short legs taken off; her stub arms, hood, spines, veins and face are the same. The lowest flank spines (they sat on the
legs' line) go with them. Her hover is drawn by the rig (rig_cocoon.py), not by the sculpt.
    uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_voltbear_hover.py <out.glb>"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../m202-dewbear-line-2026-11-26/tools'))
import numpy as np
import sculpt_voltbear as V
from bear_common import su, cone, ell, mir, build
def limbs(P):
    M = mir(P); a = V.L['arm']; d = su(cone(M, a[0], a[1], .065, .055), cone(M, a[1], a[2], .055, .05), .02)
    for oz in (-.03, .0, .03): d = su(d, ell(M, (a[2][0] + .01, a[2][1] - .05, a[2][2] + oz), (.018, .024, .016)), .01)
    return d
V.limbs = limbs
V.SPINES = [s for s, (th, y, ln) in zip(V.SPINES, V.SPN) if y > .15]
V.NAME = 'voltbear'
RIG, L = V.RIG, V.L
sys.modules[__name__].__dict__.update({k: getattr(V, k) for k in ('field', 'classes', 'deco', 'PAL', 'ORDER', 'LO', 'HI', 'NAME', 'trunk', 'hood', 'spines')})
if __name__ == '__main__': build(V, sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10000)
