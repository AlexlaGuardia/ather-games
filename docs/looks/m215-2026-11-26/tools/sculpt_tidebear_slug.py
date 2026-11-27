"""M215 (Alex 11-26): TIDEBEAR AS A SLUG, sliding along the ground. Her M202 body (sculpt_tidebear.py, untouched) with the four
splash feet taken off and one wet SOLE under her instead: a low flat foot a little wider than her column that trails out behind
her (a slug's foot), foam-pale where it meets the ground. Head, crown, folded arms, rings, bubbles and kelp are the same.
    uv run --no-project --with numpy,scipy,trimesh,fast_simplification,networkx python sculpt_tidebear_slug.py <out.glb>"""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../m202-dewbear-line-2026-11-26/tools'))
import numpy as np
import sculpt_tidebear as T
from bear_common import su, ell, build
def sole(P):
    d = ell(P, (0, .05, -.05), (.30, .055, .40))                    # the foot: low, flat, longer behind than before
    return su(d, ell(P, (0, .03, -.27), (.16, .033, .18)), .05)     # the trailing tip
T.feet = sole
RIG, L = T.RIG, T.L
if __name__ == '__main__': build(T, sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 10000)
