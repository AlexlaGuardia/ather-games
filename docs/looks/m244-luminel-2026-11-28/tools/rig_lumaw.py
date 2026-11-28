"""M244 sheet 5: rig Luminel's awakened forms on the BASE Luminara's own hover rig, the way rig_lum.py rigs the line (read + run, never edited).
    python rig_lumaw.py <form>  -> ../<form>-rigged.glb + ../<form>-metrics.json
rig_lum.py's checked text swaps (base unit 0.3438 m per glb unit, head joints follow her HC, deco skinned to the nearest body vertex) plus:
(1) HOVER = 1.35 m / her dial, so grown past Luminel she still hangs at Luminel's ~1.35 m and the game's hover low / top follow;
(2) her AURA part (lamp + motif): each motif colour rides ONE bone rigidly (S.AURA_BONE: halo + stars + roots on the chest, the trail and the
belly sunburst on the abdomen), the lamp copy on the abdomen. Metrics add body_mean_top, hover_low / top and the culling over every clip
(body, eyes, lamp, AURA)."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; os.environ['LUMAW_FORM'] = FORM
import sculpt_lumaw as F; S = F.S
import lum_common as C
DIAL = dict(luminok=2.0, lumilys=1.9, lumivex=1.8, elhae=2.0)[FORM]
src = open(os.path.join(C.BASE, 'rig_luminara.py')).read(); DH = S.HC - C.HC0
DECO_HOOK = """dk = isc(*S.DECO) if S.DECO else np.zeros(len(eP), bool)
if dk.any():
    from scipy.spatial import cKDTree
    e[dk] = W[cKDTree(V).query(eP[dk])[1]]; print('deco verts', int(dk.sum()))
parts['eyes'] = dict(live['eyes'],"""
AURA_HOOK = """parts['lamp'] = dict(live['lamp'], POSITION=(lP + UP).astype(np.float32), W=la)
aP = live['aura']['POSITION'].astype(float); aC = live['aura']['COLOR_0'][:, :3].astype(int); aw = np.zeros((len(aP), len(nb))); aw[:, ix('abd')] = 1
for col, bn in S.AURA_BONE.items():
    k = np.abs(aC - np.round(255 * (np.array(col) / 255.) ** 2.2)).max(1) <= 1; aw[k] = 0; aw[k, ix(bn)] = 1; print('aura', bn, int(k.sum()))
parts['aura'] = dict(live['aura'], POSITION=(aP + UP).astype(np.float32), W=aw)"""
for a, b in (("os.path.join(HERE, '../luminara.glb')", "GLB_IN"), ("os.path.join(HERE, '../luminara-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../luminara-metrics.json')", "MET_OUT"), ("import numpy as np, rigcore as K, sculpt_luminara as S", "import numpy as np, rigcore as K"),
             ("H = GROWN_LEN / LONG;", "H = GROWN_LEN / .8725;"), ("HOVER = .90;", "HOVER = 1.35 / DIAL;"),
             ("'neck': ('chest', (0, .55, .09))", "'neck': ('chest', tuple(DH * .5 + (0, .55, .09)))"), ("'head': ('neck', (0, .62, .17))", "'head': ('neck', tuple(DH + (0, .62, .17)))"),
             ("('head', U(0, .64, .18), U(0, .72, .22), .22, g_(hed))", "('head', U(*(DH + (0, .64, .18))), U(*(DH + (0, .72, .22))), .22, g_(hed))"),
             ("parts['eyes'] = dict(live['eyes'],", DECO_HOOK),
             ("parts['lamp'] = dict(live['lamp'], POSITION=(lP + UP).astype(np.float32), W=la)", AURA_HOOK)):
    assert src.count(a) == 1, a; src = src.replace(a, b)
D = os.path.join(HERE, '..'); ns = dict(__name__='rig', __file__=os.path.join(C.BASE, 'rig_luminara.py'), DH=DH, S=S, DIAL=DIAL,
     GLB_IN=os.path.join(D, f'{FORM}.glb'), GLB_OUT=os.path.join(D, f'{FORM}-rigged.glb'), MET_OUT=os.path.join(D, f'{FORM}-metrics.json'))
sys.modules['sculpt_luminara'] = S
exec(compile(src, 'rig_luminara(' + FORM + ')', 'exec'), ns)
P, T, clips = ns['P'], ns['T'], ns['clips']
tops = [np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 120))[:, 1]) for k in range(120)]
lo, hi = np.full(3, 9.), np.full(3, -9.); il, it = 9., -9.; alow = 9.
for c in clips:
    for k in range(60):
        g = P.globals(c, T[c] * k / 60); X = np.vstack([P.verts(p, g) for p in ('body', 'eyes', 'lamp', 'aura')]); lo = np.minimum(lo, X.min(0)); hi = np.maximum(hi, X.max(0)); alow = min(alow, X[:, 1].min())
        if c == 'idle': il, it = min(il, X[:, 1].min()), max(it, X[:, 1].max())
ctr = (lo + hi) / 2; M = json.load(open(ns['MET_OUT']))
M.update(dial=DIAL, body_mean_top=round(float(np.mean(tops)), 3), hover_low=round(float(il), 3), hover_top=round(float(it), 3), all_lowest_with_aura_glb=round(float(alow), 3),
         aura_tris=len(P.m['aura']['F']), cull=dict(c=[round(float(x), 2) for x in ctr], r=round(float(np.linalg.norm(hi - ctr)) + .12, 2), min=[round(float(x) - .12, 2) for x in lo], max=[round(float(x) + .12, 2) for x in hi]))
json.dump(M, open(ns['MET_OUT'], 'w'), indent=1); print('dial', DIAL, 'body_mean_top', M['body_mean_top'], 'hover', M['hover_low'], M['hover_top'], 'lowest+aura', alow, 'cull', M['cull'], 'glb_long', M['glb_long'])
