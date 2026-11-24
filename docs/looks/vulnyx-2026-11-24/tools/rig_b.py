"""Quick rig fit of candidate B on the M132 s1 quadruped plan.  blender -b -P rig_b.py   -> ../b-rigged.glb + ../b-metrics.json
No stand-up pitch, no tuck, no gates round a fused tail: the body is already standing."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
import numpy as np, rigcore as K
from plans import quadruped as Q
H = .70; SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', (0, .39, -.15)), 'spine': ('pelvis', (0, .40, -.02)), 'chest': ('spine', (0, .41, .09)), 'neck': ('chest', (0, .455, .17)), 'head': ('neck', (0, .53, .22))}
for s, x in (('l', 1), ('r', -1)):
    SK |= {'ear_' + s: ('head', (x * .135, .68, .22)), 'f%s_up' % s: ('chest', (x * .080, .38, .145)), 'f%s_lo' % s: ('f%s_up' % s, (x * .084, .205, .112)), 'f%s_paw' % s: ('f%s_lo' % s, (x * .086, .055, .145)),
           'h%s_up' % s: ('pelvis', (x * .082, .36, -.165)), 'h%s_lo' % s: ('h%s_up' % s, (x * .100, .215, -.115)), 'h%s_paw' % s: ('h%s_lo' % s, (x * .096, .055, -.190))}
TP = [(0, .41, -.25), (0, .38, -.45), (0, .44, -.64), (0, .66, -.765), (0, .89, -.89)]
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TP[i])
J = lambda b: SK[b][1]; tail = lambda V: V[:, 2] < -.245 - .6 * np.clip(.30 - V[:, 1], 0, .5); body = lambda V: ~tail(V) & (V[:, 1] < .56); hd = lambda V: (V[:, 1] > .43) & (V[:, 2] > 0)
B = [('pelvis', (0, .385, -.2), (0, .39, -.1), .13, body), ('spine', J('spine'), (0, .40, .04), .12, body), ('chest', (0, .39, .1), (0, .38, .17), .13, body), ('neck', (0, .44, .18), (0, .49, .21), .11, lambda V: V[:, 2] > 0), ('head', (0, .57, .2), (0, .6, .3), .2, hd)]
for s, x in (('l', 1), ('r', -1)):
    side = lambda V, x=x: V[:, 0] * x > .006; fore = lambda V, x=x: (V[:, 0] * x > .006) & (V[:, 2] > .02) & (V[:, 1] < .40); hind = lambda V, x=x: (V[:, 0] * x > .006) & (V[:, 2] < 0) & ~tail(V) & (V[:, 1] < .42)
    B += [('ear_' + s, (x * .145, .72, .215), (x * .212, .99, .15), .10, lambda V, x=x: (V[:, 1] > .66) & (V[:, 0] * x > .03)),
          ('f%s_up' % s, (x * .088, .31, .135), J('f%s_lo' % s), .062, fore), ('f%s_lo' % s, J('f%s_lo' % s), J('f%s_paw' % s), .060, fore), ('f%s_paw' % s, (x * .086, .03, .14), (x * .086, .02, .21), .060, fore),
          ('h%s_up' % s, (x * .09, .33, -.165), J('h%s_lo' % s), .088, hind), ('h%s_lo' % s, J('h%s_lo' % s), (x * .096, .11, -.20), .062, hind), ('h%s_paw' % s, (x * .096, .03, -.19), (x * .096, .02, -.12), .060, hind)]
B += [('tail%d' % (i + 1), TP[i], TP[i + 1], .13, tail) for i in range(4)]
nb = list(SK); nm = [b[0] for b in B]
RIG = [(nm.index(a + s + '_paw'), (lambda V, x=x, a=a: (V[:, 1] < .06) & (V[:, 0] * x > 0) & ((V[:, 2] > .02) == (a == 'f')))) for a in 'fh' for s, x in (('l', 1), ('r', -1))]
D = dict(pitch=0, neck=.5, tail=['tail1', 'tail2', 'tail3', 'tail4'], idletail=[0, 0, 0, 0], idlelift=[0, 0, 0, 0], drop={}, stance={p + s: (x * w, z) for s, x in (('l', 1), ('r', -1)) for p, w, z in (('f', .080, .145), ('h', .088, -.175))})
WALK = dict(v=.55, duty=.62, reach=(.12, .12), lift=.05, toe=.5, phase=dict(hl=0, fl=.75, hr=.5, fr=.25), beats=2, bob0=.4, bob=.007, dy=-.018, pitch=0, rock=0, flex=0, yaw=.06, roll=.04, nod=.02, headdown=0, ear=0, earf=.05, tailback=[0] * 4, taillift=[0, -.05, -.05, -.05], tailf=.04, tailsw=.10)
RUN = dict(v=1.92, duty=.32, reach=(.150, .150), lift=.07, toe=.9, phase=dict(hl=0, hr=.93, fl=.52, fr=.45), beats=1, bob0=-.5, bob=.022, dy=-.012, pitch=.03, rock=.10, flex=.10, yaw=0, roll=.02, nod=0, headdown=.05, ear=-.28, earf=.12, tailback=[0] * 4, taillift=[.10, -.35, -.40, -.30], tailf=.12, tailsw=.05)
live = K.Glb(os.path.join(HERE, '../b.glb')).meshes(); parts = {}; m = live['body']
w = K.skin_weights(m['POSITION'].astype(float), m['F'], B, 7, RIG); W = np.zeros((len(m['POSITION']), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
parts['body'] = dict(m, W=K.four(W)); e = np.zeros((len(live['eyes']['POSITION']), len(nb))); e[:, nb.index('head')] = 1; parts['eyes'] = dict(live['eyes'], W=e)
clips, T, st = {}, {}, {}
for n, g in (('walk', WALK), ('run', RUN)): T[n] = 2 * g['reach'][0] * H / g['duty'] / g['v']; clips[n], st[n] = Q.gait(SK, D, g, 24)
clips['idle'] = Q.idle(SK, D, 48); T['idle'] = 4.8; path = os.path.join(HERE, '../b-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; bw = lambda b: (ww * (JJ == P.names.index(b))).sum(1); M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), weights_bad=int((~np.isfinite(ww)).sum()))
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 48; fr = [P.verts('body', P.globals(c, T[c] * k / N)) for k in range(N)]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(f[:, 1].min() for f in fr) * H, 4), rest_lowest_m=round(float(pos[:, 1].min()) * H, 4))
    q = np.array([np.percentile(np.linalg.norm(f[E[ok, 0]] - f[E[ok, 1]], axis=1) / l0[ok], [99, 100]) for f in fr]); d['edge_stretch_p99'], d['edge_stretch_max'] = [round(float(x), 2) for x in q.max(0)]
    if c in st:
        g = dict(walk=WALK, run=RUN)[c]; d['leg_reach_ratio_max'] = round(float(st[c]), 2); dr = 0
        for f, off in g['phase'].items():
            so = (bw(f + '_paw') > .99) & (pos[:, 1] < .025); k = sorted((i for i in range(N) if ((i / N + off) % 1) < g['duty']), key=lambda i: (i / N + off) % 1); A = np.array([fr[i][so] for i in k]) * H; A[:, :, 2] += (g['v'] * np.array([((i / N + off) % 1) * T[c] for i in k]))[:, None]; dr = max(dr, np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max())
        d['planted_foot_drift_max_m'] = round(float(dr), 4)
    M[c] = d
json.dump(M, open(os.path.join(HERE, '../b-metrics.json'), 'w'), indent=1); print(json.dumps(M))
