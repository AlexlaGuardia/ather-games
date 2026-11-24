"""Game-ready rig of b-v2 on the M132 s1 quadruped plan (bones, weights, idle as s1).  blender -b -P rig_v2.py  -> ../b-v2-rigged.glb + ../b-v2-metrics.json
Own gaits (legs never past their reach, paws never under the ground, a long gallop), plus sit and lie.
No stand-up pitch, no tuck, no gates round a fused tail: the body is already standing."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
import numpy as np, rigcore as K
from plans import quadruped as Q
from rigcore import Pose
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
TAU = 2 * np.pi; sm = K.smooth
D = dict(pitch=0, neck=.5, tail=['tail1', 'tail2', 'tail3', 'tail4'], idletail=[0, 0, 0, 0], idlelift=[0, 0, 0, 0], drop={}, stance={p + s: (x * w, z) for s, x in (('l', 1), ('r', -1)) for p, w, z in (('f', .080, .145), ('h', .088, -.175))})
WALK = dict(v=.55, duty=.625, reach=.14, lift=.05, toe=.5, phase=dict(hl=0, fl=.75, hr=.5, fr=.25), beats=2, bob0=.4, bob=.007, dy=-.034, n=24, over=.25)
# the gallop: a low chest and a spine that opens and closes buy the reach, short contacts buy the air. Stride 1.21 m
RUN = dict(v=2.8, duty=.2, reach=.173, lift=.085, toe=.8, phase=dict(hl=0, hr=.925, fl=.5, fr=.425), beats=1, n=40, over=.06)
live = K.Glb(os.path.join(HERE, '../b-v2.glb')).meshes(); parts = {}; m = live['body']; V0 = m['POSITION'].astype(float)
w = K.skin_weights(V0, m['F'], B, 7, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
W = K.four(W); parts['body'] = dict(m, W=W); e = np.zeros((len(live['eyes']['POSITION']), len(nb))); e[:, nb.index('head')] = 1; parts['eyes'] = dict(live['eyes'], W=e)
LEGS = ('fl', 'fr', 'hl', 'hr'); SOLE = {f: V0[(W[:, nb.index(f + '_paw')] > .5) & (V0[:, 1] < .10)] - np.array(SK[f + '_paw'][1]) for f in LEGS}
LEN = {f: sum(np.linalg.norm(np.array(SK[f + a][1]) - np.array(SK[f + b][1])) for a, b in (('_up', '_lo'), ('_lo', '_paw'))) for f in LEGS}
def clear(f, R):
    """how far the paw joint must rise so a turned paw stays above the ground"""
    return max(0, SK[f + '_paw'][1][1] * -1 - (SOLE[f] @ R.T)[:, 1].min() + .0) if f else 0
def setleg(p, f, z, y, R=np.eye(3), planted=True, x=None, bend=None, cap=1.0):
    hx, hz = D['stance'][f]; t = np.array([hx if x is None else x, SK[f + '_paw'][1][1] + max(y, clear(f, R)), hz + z]); A = p.glob(f + '_up')[1]
    if not planted:                                  # a swinging paw is pulled in to the leg's reach, never the leg out to the paw
        d = t - A; k = np.linalg.norm(d) / (cap * .99 * LEN[f])
        if k > 1: t = A + d / k; t[1] = max(t[1], SK[f + '_paw'][1][1] + clear(f, R))
    return p.leg(f + '_up', f + '_lo', f + '_paw', t, R, bend=bend or ((0, 0, -1) if f[0] == 'f' else (0, .25, 1)), maxstretch=2)
def feet(p, ph, g):
    st = []
    for f, off in g['phase'].items():
        u = (ph + off) % 1
        if u < g['duty'] - 1e-9: st.append(setleg(p, f, g['reach'] * (1 - 2 * u / g['duty']), 0)); continue
        u = (u - g['duty']) / (1 - g['duty']); r = g['reach']; mm = -2 * r * (1 - g['duty']) / g['duty'] * g['over']
        z = (2*u**3 - 3*u**2 + 1) * -r + (u**3 - 2*u**2 + u) * mm + (3*u**2 - 2*u**3) * r + (u**3 - u**2) * mm
        st.append(setleg(p, f, z, g['lift'] * max(0, np.sin(np.pi * u)) ** 1.2, rx(g['toe'] * np.sin(np.pi * u) * (1 - u) * 2), False))
    return max(st)
def rx(a): return K.rx(a)
def tail(p, lift, sw, ph, side=(0, 0, 0, 0)):
    for i, b in enumerate(D['tail']): p.rot(b, rx(lift[i]), K.ry(side[i] + sw * np.sin(TAU * ph - i * .9) * (.5 + i * .35)))
def walk(g):
    out, st = [], []
    for i in range(g['n'] + 1):
        ph = (i % g['n']) / g['n']; c = np.cos(TAU * 2 * ph + g['bob0']); s = np.sin(TAU * ph); p = Q.stand(SK, D, 0, g['dy'] + g['bob'] * c, 0)
        p.rot('spine', K.ry(.06 * s)); p.rot('chest', K.ry(-.06 * s)); p.rot('head', rx(.02 * c)); p.rot('pelvis', K.rz(.04 * s)); Q.ears(p, .05 * np.sin(TAU * ph * 2 - .8), .04 * s)
        tail(p, [0, -.05, -.05, -.05], .10, ph); st.append(feet(p, ph, g)); out.append(p)
    return out, max(st)
def run(g):
    """hind pair pushes 0..0.275, flight (stretched), fore pair 0.5..0.775, flight (gathered). close = +1 gathered, -1 stretched"""
    out, st = [], []
    for i in range(g['n'] + 1):
        ph = (i % g['n']) / g['n']; cl = np.cos(TAU * (ph - .955)); rock = np.sin(TAU * (ph - .14)); air = np.cos(TAU * 2 * (ph - .39))
        p = Pose(SK); hindlow = .5 - .5 * np.cos(TAU * (ph - .62)); frontlow = 1 - hindlow
        p.T['root'] = np.array([0, -.062 + .012 * air, .012 * -cl]); p.R['pelvis'] = rx(.02 + .07 * rock + .09 * cl)
        p.rot('spine', rx(-.09 * cl)); p.rot('chest', rx(-.08 * cl)); p.rot('neck', rx(.10 - .04 * rock)); p.rot('head', rx(-.08 - .03 * rock + .06 * cl)); p.rot('pelvis', K.rz(.02 * np.sin(TAU * ph)))
        Q.ears(p, -.28 + .10 * np.sin(TAU * ph - .8), .03 * np.sin(TAU * ph)); tail(p, [.02 + .08 * rock, -.22 + .08 * np.sin(TAU * ph - 1.6), -.32 + .09 * np.sin(TAU * ph - 2.4), -.26 + .10 * np.sin(TAU * ph - 3.2)], .05, ph)
        st.append(feet(p, ph, g)); out.append(p)
    return out, max(st)
PB = W[:, [nb.index(b) for b in nb if b in ('tail2', 'tail3', 'tail4') or b[-3:] in ('_lo', 'paw') or b[0] == 'f']].sum(1) < .25; TB = W[:, [nb.index(b) for b in D['tail']]].sum(1) > .5
def low(p, M): return K.skin(V0[M], W[M], SK, p)[:, 1].min()
def rest(kind, n, pose):
    out, st = [], []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); e = sm(0, .10, u) * (1 - sm(.90, 1, u)); look = .5 * (sm(.14, .19, u) - sm(.40, .45, u)) - .45 * (sm(.56, .61, u) - sm(.80, .85, u))
        p = pose(br); p.rot('neck', K.ry(look * .35)); p.rot('head', K.ry(look * .6), K.rz(-.14 * look)); p.rot('chest', rx(.010 * br))
        fl = np.sin(np.pi * np.clip((u - .48) / .05, 0, 1)); p.rot('ear_l', K.rz(-.35 * fl)); p.rot('ear_r', K.rz(.22 * np.sin(np.pi * np.clip((u - .9) / .05, 0, 1))))
        st.append(POST[kind](p, u)); out.append(p)
    return out, max(st)
# sit: on her haunches, forelegs straight under the chest, brush laid round her left side with its tip up
def sitpose(br):
    p = Pose(SK); a = SITA; ch, pv = np.array(SK['chest'][1]), np.array(SK['pelvis'][1]); R = rx(-a); d = ch + np.array([0, SITY, -.035]) - R @ (ch - pv)
    p.R['pelvis'] = R; p.T['pelvis'] = d - pv; p.rot('spine', rx(.16)); p.rot('chest', rx(.16)); p.rot('neck', rx(.30)); p.rot('head', rx(.24)); return p
def sitpost(p, u):
    st = [setleg(p, f, -.035, 0) for f in ('fl', 'fr')] + [setleg(p, f, .165, 0, x=.128 * (1 if f == 'hl' else -1), bend=(.35 if f == 'hl' else -.35, .9, .7)) for f in ('hl', 'hr')]
    sw = .05 * np.sin(TAU * u); tail(p, [SITT[0], SITT[1], SITT[2], SITT[3] + .04 * np.sin(TAU * u * 2)], 0, 0, (.30 + sw * .2, .26 + sw * .6, .22 + sw, .10 + sw)); return max(st)
def liepose(br):
    p = Pose(SK); p.T['root'] = np.array([0, LIEY + .002 * br, 0]); p.R['pelvis'] = rx(.0); p.rot('spine', rx(-.06)); p.rot('chest', rx(-.05)); p.rot('neck', rx(.06)); p.rot('head', rx(.04)); return p
def liepost(p, u):
    st = [setleg(p, f, .205, 0, x=.092 * s, bend=(s * .9, .5, -.6)) for f, s in (('fl', 1), ('fr', -1))] + [setleg(p, f, .14, 0, x=.150 * s, bend=(s * .7, .9, .4)) for f, s in (('hl', 1), ('hr', -1))]
    sw = .04 * np.sin(TAU * u); tail(p, [LIET, -.10, -.30, -.28 + .03 * np.sin(TAU * u * 2)], 0, 0, (.40 + sw * .2, .55 + sw * .5, .55 + sw, .45 + sw)); return max(st)
POST = dict(sit=sitpost, lie=liepost)
# numbers the ground decides: solved, not guessed (rump / belly / brush just touch)
def solve(f, a, b):
    for _ in range(22):
        c = (a + b) / 2; a, b = (a, c) if f(c) > 0 else (c, b)
    return b
SITA = .88; SITY = -.03; SITT = [0, -.12, -.05, 0]; LIEY = -.2; LIET = 0
SITY = -.06
def _st(v): global SITT; SITT = [v, -.12, -.05, 0]; return min(low((lambda p: (sitpost(p, u), p)[1])(sitpose(0)), TB) for u in (.25, .75)) - .003
_st(solve(_st, -.3, 2.0))
BODY = W[:, [nb.index(b) for b in ('pelvis', 'spine', 'chest')]].sum(1) > .6
def _ly(v): global LIEY; LIEY = v; p = liepose(-1); liepost(p, 0); return low(p, BODY) - .002
LIEY = solve(_ly, -.36, 0)
def _lt(v): global LIET; LIET = v; return min(low((lambda p: (liepost(p, u), p)[1])(liepose(-1)), TB) for u in (.25, .75)) - .003
_lt(solve(_lt, -.6, 1.6)); p = sitpose(0); sitpost(p, 0); print('rump', low(p, W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5)); print('solved', SITY, SITT, LIEY, LIET)
clips, T, st = {}, {}, {}
for n, g, fn in (('walk', WALK, walk), ('run', RUN, run)): T[n] = 2 * g['reach'] * H / g['duty'] / g['v']; clips[n], st[n] = fn(g)
clips['idle'] = Q.idle(SK, D, 48); T['idle'] = 4.8; clips['sit'], st['sit'] = rest('sit', 48, sitpose); T['sit'] = 5.; clips['lie'], st['lie'] = rest('lie', 48, liepose); T['lie'] = 5.6
path = os.path.join(HERE, '../b-v2-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; bw = lambda b: (ww * (JJ == P.names.index(b))).sum(1); M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), weights_bad=int((~np.isfinite(ww)).sum()))
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 80; fr = [P.verts('body', P.globals(c, T[c] * k / N)) for k in range(N)]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(f[:, 1].min() for f in fr) * H, 4), rest_lowest_m=round(float(pos[:, 1].min()) * H, 4))
    q = np.array([np.percentile(np.linalg.norm(f[E[ok, 0]] - f[E[ok, 1]], axis=1) / l0[ok], [99, 100]) for f in fr]); d['edge_stretch_p99'], d['edge_stretch_max'] = [round(float(x), 2) for x in q.max(0)]
    if c in st: d['leg_reach_ratio_max'] = round(float(st[c]), 2)
    if c in ('walk', 'run'):
        g = dict(walk=WALK, run=RUN)[c]; dr = 0
        for f, off in g['phase'].items():
            so = (bw(f + '_paw') > .99) & (pos[:, 1] < .025); k = sorted((i for i in range(N) if ((i / N + off) % 1) < g['duty']), key=lambda i: (i / N + off) % 1); A = np.array([fr[i][so] for i in k]) * H; A[:, :, 2] += (g['v'] * np.array([((i / N + off) % 1) * T[c] for i in k]))[:, None]; x = np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max(1); dr = max(dr, x.max())
        d['stride_m'] = round(g['v'] * T[c], 3); d['plays_1to1_at_mps'] = g['v']; d['cadence_at_mps'] = {str(v): round(v / (g['v'] * T[c]), 2) for v in (.55, 1.15, 1.92, g['v'], 4.2, 6.5)}
        d['planted_foot_drift_max_m'] = round(float(dr), 4)
    h = [np.vstack([x, P.verts('eyes', P.globals(c, T[c] * k / N))]) for k, x in enumerate(fr) if k % 8 == 0]; d['length_m'], d['height_m'] = round(float(np.mean([x[:, 2].max() - x[:, 2].min() for x in h])) * H, 3), round(float(np.mean([x[:, 1].max() for x in h])) * H, 3)
    i = int(np.argmin([f[:, 1].min() for f in fr])); k = int(fr[i][:, 1].argmin()); d['lowest_bone'] = P.names[JJ[k][ww[k].argmax()]]
    M[c] = d
json.dump(M, open(os.path.join(HERE, '../b-v2-metrics.json'), 'w'), indent=1); print(json.dumps(M))
