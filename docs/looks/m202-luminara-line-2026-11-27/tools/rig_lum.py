"""M202 the Luminara line's rigs: python rig_lum.py <form>  -> ../<form>-rigged.glb + ../<form>-metrics.json
Each form runs the BASE Luminara's own rig (docs/looks/m174-luminara-2026-11-27/tools/rig_luminara.py, read and run, never edited) on her own
sculpt module (sculpt_<form>.py, which has already re-shaped the base module by name), so she gets the base's 19-bone HOVER plan (the Hovari
contract: b_hover unkeyed, every clip up in the air) and its five clips (idle hover / walk drift / run dart / sit settled / lie asleep in the air)
fitted to HER landmarks: wing roots, arms, antenna curve from her module; the neck / head joints follow her head centre (DH = her HC - the base's).
Changes from the base, each a checked text swap: (1) the unit stays the BASE's (0.3438 m per glb unit, not her own length), so she hangs at the
base's hover in glb units and the game sizes her as the base x her dial; (2) her deco parts (S.DECO colours on the unlit eyes part: crystals,
markings, lightning, moss, bubbles) are skinned to the nearest body vertex. Metrics add body_mean_top (LUM_GLB_TALL: the idle clip's mean body
height), hover_low / hover_top (glb) and the culling sphere + box over every clip."""
import sys, os, importlib, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; F = importlib.import_module('sculpt_' + FORM); S = F.S
import lum_common as C
src = open(os.path.join(C.BASE, 'rig_luminara.py')).read(); DH = S.HC - C.HC0
DECO_HOOK = """dk = isc(*S.DECO) if S.DECO else np.zeros(len(eP), bool)
if dk.any():
    from scipy.spatial import cKDTree
    e[dk] = W[cKDTree(V).query(eP[dk])[1]]; print('deco verts', int(dk.sum()))
parts['eyes'] = dict(live['eyes'],"""
for a, b in (("os.path.join(HERE, '../luminara.glb')", "GLB_IN"), ("os.path.join(HERE, '../luminara-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../luminara-metrics.json')", "MET_OUT"), ("import numpy as np, rigcore as K, sculpt_luminara as S", "import numpy as np, rigcore as K"),
             ("H = GROWN_LEN / LONG;", "H = GROWN_LEN / .8725;"),
             ("'neck': ('chest', (0, .55, .09))", "'neck': ('chest', tuple(DH * .5 + (0, .55, .09)))"), ("'head': ('neck', (0, .62, .17))", "'head': ('neck', tuple(DH + (0, .62, .17)))"),
             ("('head', U(0, .64, .18), U(0, .72, .22), .22, g_(hed))", "('head', U(*(DH + (0, .64, .18))), U(*(DH + (0, .72, .22))), .22, g_(hed))"),
             ("parts['eyes'] = dict(live['eyes'],", DECO_HOOK)):
    assert src.count(a) == 1, a; src = src.replace(a, b)
D = os.path.join(HERE, '..'); ns = dict(__name__='rig', __file__=os.path.join(C.BASE, 'rig_luminara.py'), DH=DH, S=S,
     GLB_IN=os.path.join(D, f'{FORM}.glb'), GLB_OUT=os.path.join(D, f'{FORM}-rigged.glb'), MET_OUT=os.path.join(D, f'{FORM}-metrics.json'))
sys.modules['sculpt_luminara'] = S
exec(compile(src, 'rig_luminara(' + FORM + ')', 'exec'), ns)
P, T, clips = ns['P'], ns['T'], ns['clips']
tops = [np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 120))[:, 1]) for k in range(120)]
lo, hi = np.full(3, 9.), np.full(3, -9.); il, it = 9., -9.
for c in clips:
    for k in range(60):
        g = P.globals(c, T[c] * k / 60); X = np.vstack([P.verts(p, g) for p in ('body', 'eyes', 'lamp')]); lo = np.minimum(lo, X.min(0)); hi = np.maximum(hi, X.max(0))
        if c == 'idle': il, it = min(il, X[:, 1].min()), max(it, X[:, 1].max())
ctr = (lo + hi) / 2; M = json.load(open(ns['MET_OUT']))
M.update(body_mean_top=round(float(np.mean(tops)), 3), hover_low=round(float(il), 3), hover_top=round(float(it), 3),
         cull=dict(c=[round(float(x), 2) for x in ctr], r=round(float(np.linalg.norm(hi - ctr)) + .12, 2), min=[round(float(x) - .12, 2) for x in lo], max=[round(float(x) + .12, 2) for x in hi]))
json.dump(M, open(ns['MET_OUT'], 'w'), indent=1); print('body_mean_top', M['body_mean_top'], 'hover', M['hover_low'], M['hover_top'], 'cull', M['cull'], 'glb_long', M['glb_long'])
