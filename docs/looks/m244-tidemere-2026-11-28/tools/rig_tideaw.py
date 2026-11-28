"""M244 sheet 11: rig Tidemere's awakened forms on TIDEMERE'S OWN GLIDE RIG (m202-tidemere-glide-2026-11-28/tools/rig_tidemere.py, run with
only its file paths swapped + the fore / hind flipper split made by nearest chain instead of a fixed z, so a swept-back fore-flipper stays
fore): 14 bones, no legs, the plastron riding CLEAR over her ground in every clip (the game draws her water sheet there), the flippers
stroking, never stepping. Steps in at rigcore.write, as the 11-28 quality standard does (m244-quality-2026-11-28):
  (1) her AURA part (motif) rides the bone the sculpt named for each piece (<form>-aura.json, in vertex order)
  (2) baked SPRINGS (the quality tool's spring + tip_acc): each flipper blade flexes after its flipper, her head nods after her neck;
      a blade spring is halved on any frame it would take the blade under the fin floor
  (3) ground headroom: every clip's lowest key (body, eyes, aura) >= 1 mm glb
    TIDEAW_FORM=<form> python rig_tideaw.py <form> <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
FORM, GIN, GOUT, MOUT = sys.argv[1:5]; os.environ['TIDEAW_FORM'] = FORM
GLIDE = os.path.join(HERE, '../../m202-tidemere-glide-2026-11-28/tools/rig_tidemere.py'); QT = os.path.join(HERE, '../../m244-quality-2026-11-28/tools/rig_quality.py')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), os.path.join(HERE, '../../m202-shellmere-line-2026-11-27/tools'), HERE): sys.path.insert(0, p)
import rigcore as K
import sculpt_tideaw as SA                       # registers the re-shaped module as sculpt_tidemere (the glide rig imports it by that name)
Q = {'__file__': QT, '__name__': 'rig_quality_lib'}; exec(compile(open(QT).read().split('_write = K.write')[0], QT, 'exec'), Q)
DIAL = dict(tidemok=1.9, tidessa=1.75, tidemerk=1.8, tidemyr=1.85)[FORM]
STATS = {}

def nearest_chain(V0, i, x):
    """fore (i=0) or hind (i=1) flipper vertex: the nearer of the two flipper chains (x = side)"""
    X = np.array([x, 1, 1]); d = []
    for ch in (SA.F.FORE, SA.F.HIND):
        best = np.full(len(V0), 9.)
        for a, b in zip(ch[:-1], ch[1:]):
            a, b = a * X, b * X; u = np.clip((V0 - a) @ (b - a) / np.sum((b - a) ** 2), 0, 1); best = np.minimum(best, np.linalg.norm(V0 - a - u[:, None] * (b - a), axis=1))
        d.append(best)
    return (d[0] <= d[1]) if i == 0 else (d[1] < d[0])

_write = K.write
def write(path, parts, sk, clips, fps):
    nb = list(sk); ix = nb.index; V0 = parts['body']['POSITION'].astype(float); W = parts['body']['W']
    A = K.Glb(GIN).meshes()['aura']; aP = A['POSITION'].astype(float); aw = np.zeros((len(aP), len(nb))); o = 0
    for n, bone in json.load(open(GIN.replace('.glb', '-aura.json'))):
        aw[o:o + n, ix(bone)] = 1; STATS.setdefault('aura', {})[bone] = STATS.get('aura', {}).get(bone, 0) + n; o += n
    assert o == len(aP) and (aw.sum(1) > .99).all(), 'every aura vertex on a bone'
    parts = dict(parts, aura=dict(A, W=aw))
    finsel = {k: (W[:, [ix('flip%d_%s' % k), ix('blade%d_%s' % k)]].sum(1) > .5) for k in [(i, s) for i in range(2) for s in 'lr']}
    raw = {}
    for c, poses in clips.items():
        dt = 1. / fps[c]; a = Q['tip_acc'](sk, poses, ['head'], 'neck', fps[c]); raw[c, 'head'] = Q['spring'](-a[:, 1], dt, 26, .30)
        for (fi, s) in finsel:
            a = Q['tip_acc'](sk, poses, ['blade%d_%s' % (fi, s)], 'flip%d_%s' % (fi, s), fps[c]); raw[c, (fi, s)] = Q['spring'](-a[:, 1], dt, 30, .28)
    TARGET = dict(head=.05, blade=.12)                 # peak spring angle (rad) in the clip each is fitted on (head: walk, blades: run)
    gain = dict(head=TARGET['head'] / max(np.abs(raw['walk', 'head']).max(), 1e-6), blade=TARGET['blade'] / max(max(np.abs(raw['run', k]).max() for k in finsel), 1e-6))
    peak, halved = {}, 0
    for c, poses in clips.items():
        n = len(poses) - 1
        th = np.clip(raw[c, 'head'] * gain['head'], -1.6 * TARGET['head'], 1.6 * TARGET['head'])
        for i in range(n): poses[i].rot('head', K.rx(th[i]))
        peak[c + ':head'] = round(float(np.abs(th).max()), 3)
        for (fi, s), sel in finsel.items():
            x = 1 if s == 'l' else -1; th = np.clip(raw[c, (fi, s)] * gain['blade'], -1.6 * TARGET['blade'], 1.6 * TARGET['blade'])
            for i in range(n):
                p = poses[i]; R0 = p.R['blade%d_%s' % (fi, s)].copy(); t = th[i]
                for _ in range(5):
                    p.R['blade%d_%s' % (fi, s)] = R0 @ K.rz(x * t)
                    if K.skin(V0[sel], W[sel], sk, p)[:, 1].min() >= G.FIN_FLOOR - .004: break
                    t *= .5; halved += 1
            peak['%s:blade%d%s' % (c, fi, s)] = round(float(np.abs(th).max()), 3)
        for b in ['head'] + [bn for bn in nb if bn.startswith('blade')]: poses[n].R[b] = poses[0].R[b].copy()
    STATS['spring_gain'] = {k: round(float(v), 4) for k, v in gain.items()}; STATS['spring_halved'] = halved
    STATS['springs'] = peak
    for c in clips:                                                                                       # ground headroom
        lo = min(min(K.skin(parts[q]['POSITION'].astype(float), parts[q]['W'], sk, p)[:, 1].min() for q in ('body', 'eyes', 'aura')) for p in clips[c])
        STATS.setdefault('key_low', {})[c] = round(float(lo), 4)
        if lo < .001:
            for p in clips[c]: p.T['shell'] = np.asarray(p.T['shell'], float) + (0, .001 - lo, 0)
            STATS.setdefault('lift', {})[c] = round(float(.001 - lo), 4)
    print('TIDEAW', STATS); return _write(path, parts, sk, clips, fps)
K.write = write

src = open(GLIDE).read()
for a, b in (("os.path.join(LINE, 'tidemere.glb')", 'GIN'), ("os.path.join(HERE, '../tidemere-rigged.glb')", 'GOUT'), ("os.path.join(HERE, '../tidemere-metrics.json')", 'MOUT'),
             ("((V0[:, 2] > -.05) if i == 0 else (V0[:, 2] <= -.05))", 'nearest_chain(V0, i, x)')):
    assert src.count(a) == 1, a; src = src.replace(a, b)
G = type('G', (), {})()
ns = dict(__file__=GLIDE, __name__='__main__', GIN=GIN, GOUT=GOUT, MOUT=MOUT, nearest_chain=nearest_chain)
G.FIN_FLOOR = .040; exec(compile(src, GLIDE, 'exec'), ns); assert ns['FIN_FLOOR'] == G.FIN_FLOOR

# extra metrics over every clip, aura included (glb units): lowest, plastron clearance, idle height + length, extents
P = K.Player(GOUT); M = json.load(open(MOUT)); alow, lo, hi = 9., np.full(3, 9.), np.full(3, -9.)
for c in ('idle', 'walk', 'run', 'sit', 'lie'):
    T = M[c]['dur_s']
    for k in range(60):
        g = P.globals(c, T * k / 60); X = np.vstack([P.verts(q, g) for q in ('body', 'eyes', 'aura')]); alow = min(alow, X[:, 1].min()); lo, hi = np.minimum(lo, X.min(0)), np.maximum(hi, X.max(0))
bv = P.m['body']['POSITION']
M.update(form=FORM, dial=DIAL, all_lowest_with_aura_glb=round(float(alow), 4), extent_lo=lo.round(3).tolist(), extent_hi=hi.round(3).tolist(), span_rest_glb=round(float(np.ptp(bv[:, 0])), 3),
         body_verts=int(len(bv)), aura_tris=len(P.m['aura']['F']), quality=dict(standard='m244-quality-2026-11-28 (springs: blades, head; aura on bones)', **STATS))
json.dump(M, open(MOUT, 'w'), indent=1); print('dial', DIAL, 'lowest+aura', M['all_lowest_with_aura_glb'], 'top', M['body_mean_top'], 'long', M['glb_long'], 'verts', len(bv))
