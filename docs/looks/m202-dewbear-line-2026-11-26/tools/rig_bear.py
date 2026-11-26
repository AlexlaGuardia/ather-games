"""M202 the rest of the Dewbear line: ONE skeleton script for Lumebear / Voltbear / Tidebear, off rig_cragbear.py (the M132
quadruped plan: 24 bones, walk / run / idle / sit / lie, solved sit + lie). Every joint is placed from HER sculpt's landmarks
and RIG table (spine joints, what her head carries, her arms, her leg zone, her gait's roll), so each form gets her own skeleton:
the ear bones carry her arms (Lumebear's flippers, Voltbear's stub arms, Tidebear's folded arms), the head bone her crown,
the four tail bones her short tail nub. Her eyes node (eyes + runes / veins / bubbles laid on her) is skinned by the nearest
body vertex, so details on the trunk ride the trunk and the face rides the head.
    blender -b -P rig_bear.py -- <form> <in.glb> <out-rigged.glb> <metrics.json>      (form: lumebear | voltbear | tidebear)"""
import sys, os, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
import numpy as np, rigcore as K
sys.path.insert(0, HERE)
ARGS = sys.argv[sys.argv.index('--') + 1:]; SM = importlib.import_module('sculpt_' + ARGS[0]); IN, OUT, MET = [os.path.abspath(x) for x in ARGS[1:4]]; R = SM.RIG
from plans import quadruped as Q
from rigcore import Pose
H = .70   # metres per glb unit in game (her base's 0.50 x her dial 1.4), the same number space as Cragbear: true relative size
SP = R['spine']; SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', SP['pelvis']), 'spine': ('pelvis', SP['spine']), 'chest': ('spine', SP['chest']), 'neck': ('chest', SP['neck']), 'head': ('neck', SP['head'])}
f, h, a = SM.L['f'], SM.L['h'], SM.L['arm']
for s, x in (('l', 1), ('r', -1)):
    X = lambda p, x=x: (x * p[0], p[1], p[2])
    SK |= {'ear_' + s: ('chest', X(a[0])), 'f%s_up' % s: ('chest', X(f[0])), 'f%s_lo' % s: ('f%s_up' % s, X(f[1])), 'f%s_paw' % s: ('f%s_lo' % s, X(f[2])),
           'h%s_up' % s: ('pelvis', X(h[0])), 'h%s_lo' % s: ('h%s_up' % s, X(h[1])), 'h%s_paw' % s: ('h%s_lo' % s, X(h[2]))}
t0, t2 = np.array(SM.L['tail'][0]), np.array(SM.L['tail'][2]); TP = [tuple(t0 + (t2 - t0) * k / 3 - (0, 0, .01)) for k in range(5)]
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TP[i])
J = lambda b: SK[b][1]
TB_ = R['tailbox']; tail = lambda V: (V[:, 2] < TB_[0]) & (np.abs(V[:, 0]) < TB_[1]) & (V[:, 1] < TB_[3]) & (V[:, 1] > TB_[2])
arm = R['arm']
legz = lambda V: (np.abs(V[:, 0]) > R['legx'][0]) & (V[:, 1] < R['legy']) & (np.abs(V[:, 0]) < R['legx'][1])
crown = lambda V: (V[:, 1] > R['crown']) & ~arm(V)
body = lambda V: ~tail(V) & ~arm(V) & ~legz(V)
cy = R['crown']; B = [('pelvis', np.add(SP['pelvis'], (0, -.04, -.06)), np.add(SP['pelvis'], (0, 0, .09)), .30, lambda V: body(V) & (V[:, 1] < cy - .08)), ('spine', np.add(SP['spine'], (0, -.04, 0)), np.add(SP['spine'], (0, .01, .08)), .30, lambda V: body(V) & (V[:, 1] < cy - .08)),
     ('chest', np.add(SP['chest'], (0, -.03, .04)), np.add(SP['chest'], (0, .04, .12)), .30, lambda V: body(V) & (V[:, 1] < cy - .06)),
     ('neck', np.add(SP['neck'], (0, -.04, -.03)), np.add(SP['neck'], (0, 0, .06)), .30, lambda V: body(V) & (V[:, 1] > cy - .16) & (V[:, 1] < cy + .02)), ('head', np.add(SP['head'], (0, -.06, -.05)), np.add(SP['head'], (0, .02, .05)), .40, lambda V: crown(V))]
for s, x in (('l', 1), ('r', -1)):
    fore = lambda V, x=x: (V[:, 0] * x > .05) & (V[:, 2] > 0) & (V[:, 1] < R['legy'])
    hind = lambda V, x=x: (V[:, 0] * x > .05) & (V[:, 2] <= 0) & (V[:, 1] < R['legy'])
    B += [('ear_' + s, (x * a[0][0], a[0][1], a[0][2]), (x * a[2][0], a[2][1] - .06, a[2][2]), .12, lambda V, x=x: arm(V) & (V[:, 0] * x > 0)),
          ('f%s_up' % s, (x * f[0][0], f[0][1], f[0][2]), J('f%s_lo' % s), .09, fore), ('f%s_lo' % s, J('f%s_lo' % s), J('f%s_paw' % s), .085, fore),
          ('f%s_paw' % s, (x * f[2][0], .03, f[2][2]), (x * f[2][0], .02, f[2][2] + .11), .10, fore),
          ('h%s_up' % s, (x * h[0][0], h[0][1], h[0][2]), J('h%s_lo' % s), .09, hind), ('h%s_lo' % s, J('h%s_lo' % s), J('h%s_paw' % s), .085, hind),
          ('h%s_paw' % s, (x * h[2][0], .03, h[2][2]), (x * h[2][0], .02, h[2][2] + .11), .10, hind)]
B += [('tail%d' % (i + 1), TP[i], TP[i + 1], .10, tail) for i in range(4)]
nb = list(SK); nm = [b[0] for b in B]
RIG = [(nm.index(p + s + '_paw'), (lambda V, x=x, p=p: (V[:, 1] < .05) & (V[:, 0] * x > .06) & ((V[:, 2] > 0) == (p == 'f')))) for p in 'fh' for s, x in (('l', 1), ('r', -1))]
TAU = 2 * np.pi; sm = K.smooth
D = dict(pitch=0, neck=.5, tail=['tail1', 'tail2', 'tail3', 'tail4'], idletail=[0, 0, 0, 0], idlelift=[0, 0, 0, 0], drop={}, stance={p + s: (x * R['stance'][0], z) for s, x in (('l', 1), ('r', -1)) for p, z in (('f', R['stance'][1]), ('h', R['stance'][2]))})
# a heavy waddle: diagonal pairs, the whole barrel rolling over the planted side, arms swinging against the steps
WALK = dict(v=.42, duty=.62, reach=.060, lift=.040, toe=.3, phase=dict(hl=0, fr=.04, hr=.5, fl=.54), bob0=.4, bob=.008, dy=-.010, n=24, over=.25, roll=.075, yaw=.05, arm=.30) | R['walk']
RUN = dict(v=1.15, duty=.44, reach=.075, lift=.055, toe=.4, phase=dict(hl=0, fr=0, hr=.5, fl=.5), bob0=.4, bob=.014, dy=-.016, n=20, over=.25, roll=.11, yaw=.06, arm=.50) | R['run']
live = K.Glb(IN).meshes(); parts = {}; m = live['body']; V0 = m['POSITION'].astype(float)
w = K.skin_weights(V0, m['F'], B, 7, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
W = K.four(W); parts['body'] = dict(m, W=W); EP = live['eyes']['POSITION'].astype(float); nn = np.concatenate([np.argmin(((EP[i:i + 512, None] - V0[None]) ** 2).sum(-1), 1) for i in range(0, len(EP), 512)]); parts['eyes'] = dict(live['eyes'], W=W[nn])
LEGS = ('fl', 'fr', 'hl', 'hr'); SOLE = {g: V0[(W[:, nb.index(g + '_paw')] > .5) & (V0[:, 1] < .10)] - np.array(SK[g + '_paw'][1]) for g in LEGS}
LEN = {g: sum(np.linalg.norm(np.array(SK[g + p][1]) - np.array(SK[g + q][1])) for p, q in (('_up', '_lo'), ('_lo', '_paw'))) for g in LEGS}
def clear(g, R): return max(0, SK[g + '_paw'][1][1] * -1 - (SOLE[g] @ R.T)[:, 1].min()) if len(SOLE[g]) else 0
def setleg(p, g, z, y, R=np.eye(3), planted=True, x=None, bend=None, cap=1.0):
    hx, hz = D['stance'][g]; t = np.array([hx if x is None else x, SK[g + '_paw'][1][1] + max(y, clear(g, R)), hz + z]); A = p.glob(g + '_up')[1]
    if not planted:
        d = t - A; k = np.linalg.norm(d) / (cap * .99 * LEN[g])
        if k > 1: t = A + d / k; t[1] = max(t[1], SK[g + '_paw'][1][1] + clear(g, R))
    return p.leg(g + '_up', g + '_lo', g + '_paw', t, R, bend=bend or ((0, 0, -1) if g[0] == 'f' else (0, .25, 1)), maxstretch=2)
def feet(p, ph, g):
    st = []
    for l, off in g['phase'].items():
        u = (ph + off) % 1
        if u < g['duty'] - 1e-9: st.append(setleg(p, l, g['reach'] * (1 - 2 * u / g['duty']), 0)); continue
        u = (u - g['duty']) / (1 - g['duty']); r = g['reach']; mm = -2 * r * (1 - g['duty']) / g['duty'] * g['over']
        z = (2*u**3 - 3*u**2 + 1) * -r + (u**3 - 2*u**2 + u) * mm + (3*u**2 - 2*u**3) * r + (u**3 - u**2) * mm
        st.append(setleg(p, l, z, g['lift'] * max(0, np.sin(np.pi * u)) ** 1.2, K.rx(g['toe'] * np.sin(np.pi * u) * (1 - u) * 2), False))
    return max(st)
def tailr(p, lift, sw, ph, side=(0, 0, 0, 0)):
    for i, b in enumerate(D['tail']): p.rot(b, K.rx(lift[i]), K.ry(side[i] + sw * np.sin(TAU * ph - i * .9) * (.5 + i * .35)))
def walk(g):
    out, st = [], []
    for i in range(g['n'] + 1):
        ph = (i % g['n']) / g['n']; c = np.cos(TAU * 2 * ph + g['bob0']); s = np.sin(TAU * ph); p = Q.stand(SK, D, 0, g['dy'] + g['bob'] * c, 0)
        p.rot('pelvis', K.rz(g['roll'] * s), K.ry(g['yaw'] * s)); p.rot('chest', K.rz(-.25 * g['roll'] * s)); p.rot('head', K.rz(-.4 * g['roll'] * s), K.rx(.02 * c))
        p.rot('ear_l', K.rx(g['arm'] * s), K.rz(-.10)); p.rot('ear_r', K.rx(-g['arm'] * s), K.rz(.10)); tailr(p, [0, 0, 0, 0], .25, ph); st.append(feet(p, ph, g)); out.append(p)
    return out, max(st)
def low(p, M): return K.skin(V0[M], W[M], SK, p)[:, 1].min()
def idle(n):
    """standing: breath, slow small glances with a hold (the crown turns a little, the barrel stays), a knuckle flex"""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); p = Q.stand(SK, D, 0, .005 * br, 0)
        look = .5 * (sm(.12, .17, u) - sm(.38, .43, u)) - .45 * (sm(.55, .60, u) - sm(.82, .87, u))
        p.rot('neck', K.ry(look * .10)); p.rot('head', K.ry(look * .22), K.rz(-.05 * look)); p.rot('chest', K.rx(.012 * br))
        fl = np.sin(np.pi * np.clip((u - .46) / .06, 0, 1)); p.rot('ear_l', K.rx(-.18 * fl), K.rz(-.06 * br)); p.rot('ear_r', K.rz(.06 * br))
        tailr(p, [0, 0, 0, 0], .2, u)
        for l in LEGS: x, z = D['stance'][l]; p.leg(l + '_up', l + '_lo', l + '_paw', (x, SK[l + '_paw'][1][1], z), bend=(0, 0, -1) if l[0] == 'f' else (0, .25, 1))
        out.append(p)
    return out
def rest(kind, n, pose):
    out, st = [], []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); look = .5 * (sm(.14, .19, u) - sm(.40, .45, u)) - .45 * (sm(.56, .61, u) - sm(.80, .85, u))
        p = pose(br); p.rot('neck', K.ry(look * .08)); p.rot('head', K.ry(look * .18)); p.rot('chest', K.rx(.010 * br))
        st.append(POST[kind](p, u)); out.append(p)
    return out, max(st)
# sit: rocked back onto her rump, front feet off the ground a little ahead, arms resting on her belly
def sitpose(br):
    p = Pose(SK); a = SITA; ch, pv = np.array(SK['chest'][1]), np.array(SK['pelvis'][1]); R = K.rx(-a); d = ch + np.array([0, SITY, -.03]) - R @ (ch - pv)
    p.R['pelvis'] = R; p.T['pelvis'] = d - pv; p.rot('neck', K.rx(.08)); p.rot('head', K.rx(.10 + .01 * br)); return p
def sitpost(p, u):
    st = [setleg(p, l, .06, .0, x=.19 * (1 if l == 'fl' else -1)) for l in ('fl', 'fr')] + [setleg(p, l, .10, 0, x=.21 * (1 if l == 'hl' else -1), bend=(.6 if l == 'hl' else -.6, .9, .4)) for l in ('hl', 'hr')]
    p.rot('ear_l', K.rx(-.30), K.rz(.18)); p.rot('ear_r', K.rx(-.30), K.rz(-.18)); tailr(p, [SITT, 0, 0, 0], 0, 0); return max(st)
# lie = sleep: sunk onto her belly, legs splayed out, arms tucked, crown nodding forward
def liepose(br):
    p = Pose(SK); p.T['root'] = np.array([0, LIEY + .003 * br, 0]); p.rot('neck', K.rx(.06)); p.rot('head', K.rx(.12)); return p
def liepost(p, u):
    st = [setleg(p, l, .06, 0, x=.24 * s, bend=(s * .9, .6, -.3)) for l, s in (('fl', 1), ('fr', -1))] + [setleg(p, l, -.05, 0, x=.24 * s, bend=(s * .9, .6, .3)) for l, s in (('hl', 1), ('hr', -1))]
    p.rot('ear_l', K.rz(.10)); p.rot('ear_r', K.rz(-.10)); tailr(p, [LIET, 0, 0, 0], 0, 0); return max(st)
POST = dict(sit=sitpost, lie=liepost)
def solve(fn, lo, hi):
    for _ in range(22):
        c = (lo + hi) / 2; lo, hi = (lo, c) if fn(c) > 0 else (c, hi)
    return hi
SITA = .26; SITY = 0.; SITT = 0.; LIEY = 0.; LIET = 0.
RUMP = W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5
def _sy(v): global SITY; SITY = v; p = sitpose(0); sitpost(p, 0); return low(p, RUMP) - .005
SITY = solve(_sy, -.40, .20)
TB = W[:, [nb.index(b) for b in D['tail']]].sum(1) > .5
def _st(v): global SITT; SITT = v; return low((lambda p: (sitpost(p, 0), p)[1])(sitpose(0)), TB) - .008 if TB.any() else 1
if TB.any(): SITT = solve(_st, -.3, 1.2)
BODY = np.ones(len(V0), bool)   # the lowest of ALL of her (spines, fins, feet), not only the trunk: nothing sinks under the floor
def _ly(v): global LIEY; LIEY = v; p = liepose(-1); liepost(p, 0); return low(p, BODY) - .006
LIEY = solve(_ly, -.30, .05)
p = sitpose(0); sitpost(p, 0); print('rump', low(p, RUMP)); print('solved', SITY, SITT, LIEY)
clips, T, st = {}, {}, {}
for n, g in (('walk', WALK), ('run', RUN)): T[n] = 2 * g['reach'] * H / g['duty'] / g['v']; clips[n], st[n] = walk(g)
clips['idle'] = idle(48); T['idle'] = 4.8; clips['sit'], st['sit'] = rest('sit', 48, sitpose); T['sit'] = 5.; clips['lie'], st['lie'] = rest('lie', 48, liepose); T['lie'] = 5.6
path = OUT; K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; bw = lambda b: (ww * (JJ == P.names.index(b))).sum(1); M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), weights_bad=int((~np.isfinite(ww)).sum()), solved=dict(sit_y=SITY, sit_tail=SITT, lie_y=LIEY))
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 80; fr = [P.verts('body', P.globals(c, T[c] * k / N)) for k in range(N)]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(x[:, 1].min() for x in fr) * H, 4), rest_lowest_m=round(float(pos[:, 1].min()) * H, 4))
    q = np.array([np.percentile(np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok], [99, 100]) for x in fr]); d['edge_stretch_p99'], d['edge_stretch_max'] = [round(float(v), 2) for v in q.max(0)]
    if c in st: d['leg_reach_ratio_max'] = round(float(st[c]), 2)
    if c in ('walk', 'run'):
        g = dict(walk=WALK, run=RUN)[c]; dr = 0
        for l, off in g['phase'].items():
            so = (bw(l + '_paw') > .99) & (pos[:, 1] < .025); k = sorted((i for i in range(N) if ((i / N + off) % 1) < g['duty']), key=lambda i: (i / N + off) % 1); A = np.array([fr[i][so] for i in k]) * H; A[:, :, 2] += (g['v'] * np.array([((i / N + off) % 1) * T[c] for i in k]))[:, None]; x = np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max(1); dr = max(dr, x.max())
        d['stride_m'] = round(g['v'] * T[c], 3); d['plays_1to1_at_mps'] = g['v']; d['cadence_at_mps'] = {str(v): round(v / (g['v'] * T[c]), 2) for v in (.55, 1.15, 1.92, g['v'], 4.2, 6.5)}
        d['planted_foot_drift_max_m'] = round(float(dr), 4)
    hh = [np.vstack([x, P.verts('eyes', P.globals(c, T[c] * k / N))]) for k, x in enumerate(fr) if k % 8 == 0]; d['length_m'], d['height_m'] = round(float(np.mean([x[:, 2].max() - x[:, 2].min() for x in hh])) * H, 3), round(float(np.mean([x[:, 1].max() for x in hh])) * H, 3)
    i = int(np.argmin([x[:, 1].min() for x in fr])); k = int(fr[i][:, 1].argmin()); d['lowest_bone'] = P.names[JJ[k][ww[k].argmax()]]
    M[c] = d
json.dump(M, open(MET, 'w'), indent=1); print(json.dumps(M))
