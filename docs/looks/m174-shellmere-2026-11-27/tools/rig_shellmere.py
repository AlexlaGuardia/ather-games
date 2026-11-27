"""Shellmere rig + clips on rigcore (M132 s1), the Lepara / Dewbear route.   python rig_shellmere.py  -> ../shellmere-rigged.glb + ../shellmere-metrics.json
18 bones: root, shell (the whole carapace + plastron ride it rigid), neck, head, lids, tail, two-bone antennae, one leg + one foot bone a leg.
Manner = spirits-species.md "Slow, armored, ancient, patient ... Chill energy, steady presence". Clips under the game's names:
idle (slow breaths, a long look round, antennae bobbing, a slow blink and a nod), walk (a slow plod: one foot at a time, hind then fore, the
shell rolling a little), run (a hurried trot: diagonal pairs), sit (settles the plastron to the ground, legs out, head up, antennae perked),
lie (SLEEP: down flat, head drawn back into the shell rim, chin down, legs tucked, antennae drooped, lids shut)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt_shellmere as S
from rigcore import Pose, rx, ry, rz
H = .464; TAU = 2 * np.pi; sm = K.smooth
AM = (S.AB + S.AT) / 2
SK = {'root': (None, (0, 0, 0)), 'shell': ('root', (0, .30, -.05)), 'neck': ('shell', (0, .36, .22)), 'head': ('neck', (0, .45, .42)), 'lids': ('head', (0, .50, .62)),
      'tail': ('shell', (0, .23, -.43))}
FT = [(i, s) for i in range(2) for s in 'lr']
for s, x in (('l', 1), ('r', -1)):
    X = np.array([x, 1, 1]); SK['ant_' + s] = ('head', tuple(S.AB * X)); SK['ant2_' + s] = ('ant_' + s, tuple(AM * X))
    for i, (a, b) in enumerate(S.LEGS): SK['leg%d_%s' % (i, s)] = ('shell', tuple(np.array(a) * X)); SK['foot%d_%s' % (i, s)] = ('leg%d_%s' % (i, s), tuple(np.array(b) * X))
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(HERE, '../shellmere.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
SH, HD, NK, LG, TL, CL = S.shell(A0), S.head(A0), S.neck(A0), S.legs(A0), S.tail(V0), S.claws(A0)
mn = np.min([SH, HD, NK, LG, TL, CL], 0); isp = lambda d: d <= mn + 1e-9
leg = (isp(LG) | isp(CL)) & (V0[:, 1] < .30); hed = isp(HD) & ~leg; nek = isp(NK) & ~leg & ~hed; tl = isp(TL) & ~leg; shl = ~(leg | hed | nek | tl)
g = lambda mask: (lambda V: mask)
B = [('shell', (0, .30, -.30), (0, .30, .20), .40, g(shl)), ('neck', (0, .36, .22), (0, .44, .40), .14, g(nek | hed)), ('head', (0, .45, .45), (0, .50, .58), .26, g(hed)), ('tail', J('tail'), (0, .15, -.61), .07, g(tl))]; RIG = []
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > 0
    for i in range(2):
        a, f = J('leg%d_%s' % (i, s)), J('foot%d_%s' % (i, s)); me = leg & sd & ((V0[:, 2] > -.05) if i == 0 else (V0[:, 2] <= -.05))
        B += [('leg%d_%s' % (i, s), a, a + (f - a) * .6, .11, g(me)), ('foot%d_%s' % (i, s), f, f + (0, -.02, .08), .10, g(me & (V0[:, 1] < .12)))]; RIG.append((len(B) - 1, g(me & (V0[:, 1] < .05))))
nm = [b[0] for b in B]; w = K.skin_weights(V0, m['F'], B, 6, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
W = K.four(W); parts = {'body': dict(m, W=W)}
eP = live['eyes']['POSITION'].astype(float); eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), (60, 92, 70)); ant = isc(S.STALK, S.BULB); from scipy.spatial import cKDTree
e = W[cKDTree(V0).query(eP)[1]].copy()                                                       # runes, eyes, mouth ride the body skin under them
e[lid] = 0; e[lid, ix('lids')] = 1
for s, x in (('l', 1), ('r', -1)):
    me = ant & (eP[:, 0] * x > 0); u = np.clip((eP[me] - S.AB * [x, 1, 1]) @ (S.AT - S.AB) / np.sum((S.AT - S.AB) ** 2), 0, 1); k = sm(.30, .62, u)
    e[me] = 0; e[me, ix('ant_' + s)] = 1 - k; e[me, ix('ant2_' + s)] = k
parts['eyes'] = dict(live['eyes'], W=K.four(e)); print('lid verts', lid.sum(), 'antenna verts', ant.sum())
SOLE = {k: V0[W[:, ix('foot%d_%s' % k)] > .5] - J('foot%d_%s' % k) for k in FT}; ST = []
def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(eP, e, SK, p)[:, 1].min())
def foot(p, i, s, z=0, y=0, x=0, R=np.eye(3)):
    """the stub leg has one bone: it aims at the planted foot and is drawn out or pushed in to reach it"""
    L, f = 'leg%d_%s' % (i, s), 'foot%d_%s' % (i, s); j = J(f); sx = 1 if s == 'l' else -1; c = max(0, -j[1] - (SOLE[i, s] @ R.T)[:, 1].min()); T = np.array([j[0] + sx * x, j[1] + max(y, c), j[2] + z])
    p.R[L] = np.eye(3); Rp, A = p.glob(L); d0 = j - J(L); R1 = K.align(Rp @ d0, T - A) @ Rp; p.R[L] = Rp.T @ R1; p.T[f] = R1.T @ (T - A) - d0; p.R[f] = R1.T @ R; ST.append(np.linalg.norm(T - A) / np.linalg.norm(d0))
def lids(p, k): p.T['lids'] = np.array([0, 0, S.LID * k])
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .03, c + .035, c + .07) for c in cs)
def antennae(p, u, hz, amp, droop=0., perk=0.):
    for s, x, ph in (('l', 1, 0), ('r', -1, 1.3)):
        a = np.sin(TAU * u * hz + ph); b = np.sin(TAU * u * hz + ph - .9)
        p.rot('ant_' + s, rx(droop * .9 - perk * .25 + amp * .5 * a), rz(-x * (.10 * perk - .15 * droop + amp * .3 * b))); p.rot('ant2_' + s, rx(droop * .7 + amp * b), rz(-x * amp * .5 * a))
def breathe(p, b): p.T['shell'] = np.array([0, .004 * b, 0]); p.rot('shell', rx(-.008 * b))
def idle(u):
    """slow breaths, a long look round one way then the other, antennae bobbing, a slow blink, one slow nod"""
    p = Pose(SK); br = np.sin(TAU * u * 2); breathe(p, br); lk = pulse(u, .10, .20, .34, .44) - pulse(u, .50, .60, .70, .78); nd = pulse(u, .82, .87, .90, .95)
    p.rot('neck', ry(.16 * lk), rx(.10 * nd)); p.rot('head', ry(.28 * lk), rx(.16 * nd - .02 * br), rz(.06 * lk))
    antennae(p, u, 2, .10 + .06 * pulse(u, .44, .48, .56, .60)); lids(p, max(blink(u, .06, .47, .76), .55 * pulse(u, .84, .87, .90, .93)))
    p.rot('tail', ry(.15 * np.sin(TAU * u))); [foot(p, *k) for k in FT]; return p
WALK = dict(v=.55, duty=.70, reach=.090, n=32); RUN = dict(v=1.9, duty=.42, reach=.145, n=28)
PH = {'walk': {(1, 'l'): 0, (0, 'l'): .25, (1, 'r'): .5, (0, 'r'): .75}, 'run': {(0, 'l'): 0, (1, 'r'): 0, (0, 'r'): .5, (1, 'l'): .5}}
def gait(u, G, ph, hgt, roll, bob, yaw, nod):
    p = Pose(SK); a = TAU * u; d = G['duty']; r = G['reach']; k2 = 2 * a if G is RUN else 4 * a
    p.T['root'] = np.array([.010 * np.sin(a), -bob * (1 + np.cos(k2)) / 2, 0]); p.R['root'] = rz(roll * np.sin(a)) @ ry(yaw * np.sin(a))
    p.rot('neck', ry(-yaw * .8 * np.sin(a)), rx(nod * np.sin(k2))); p.rot('head', rz(-roll * .6 * np.sin(a)), rx(-nod * .6 * np.sin(k2 - .5))); p.rot('tail', ry(.25 * np.sin(a - 1.2)))
    antennae(p, u, 2, .10 + nod * 2)
    for (i, s), o in ph.items():
        k = (u - o + 1e-9) % 1
        if k < d - 1e-9: foot(p, i, s, r * (1 - 2 * k / d), 0, .004)
        else: q = (k - d) / (1 - d); foot(p, i, s, -r + 2 * r * sm(.04, .96, q), hgt * max(0, np.sin(np.pi * q)) ** .9, .012 * np.sin(np.pi * q), rx(.35 * np.sin(np.pi * min(1, q * 1.5)) * (1 - q)))
    return p
walk = lambda u: gait(u, WALK, PH['walk'], .055, .035, .006, .05, .03)
run = lambda u: gait(u, RUN, PH['run'], .075, .05, .012, .06, .05)
def ground(p, aim=0):
    l = low(p); p.T['root'] = p.T['root'] + np.array([0, aim - l, 0]); return p
def sit(u):
    """settles the plastron onto the ground, legs out to the sides, head up looking about, antennae perked"""
    p = Pose(SK); br = np.sin(TAU * u * 2); p.T['shell'] = np.array([0, -.075 + .003 * br, 0]); p.rot('shell', rx(.03))
    lk = pulse(u, .15, .25, .45, .55) - pulse(u, .60, .68, .82, .90); p.rot('neck', rx(-.18), ry(.15 * lk)); p.rot('head', rx(-.10 - .015 * br), ry(.25 * lk))
    antennae(p, u, 1.5, .08, 0, 1); lids(p, blink(u, .10, .58, .93)); p.rot('tail', ry(.1 * np.sin(TAU * u)))
    for i, s in FT: foot(p, i, s, (.03, -.02)[i], 0, .07)
    return ground(p, 0)
def lie(u):
    """asleep: plastron flat on the ground, head drawn back into the rim with the chin down, legs tucked in, antennae drooped, lids shut"""
    p = Pose(SK); br = np.sin(TAU * u); p.T['shell'] = np.array([0, -.10 + .004 * br, 0]); p.rot('shell', rx(.02))
    p.T['neck'] = np.array([0, -.02, -.09]); p.rot('neck', rx(.30)); p.rot('head', rx(.12 + .01 * br), rz(.06)); antennae(p, u, 1, .03, 1); lids(p, 1); p.rot('tail', ry(.4))
    for i, s in FT: foot(p, i, s, (-.05, .05)[i], 0, -.02)
    return ground(p, 0)
clips, T, R = {}, {}, {}
for n, fn, k, t in (('idle', idle, 48, 9.), ('walk', walk, WALK['n'], 2 * WALK['reach'] * H / WALK['duty'] / WALK['v']), ('run', run, RUN['n'], 2 * RUN['reach'] * H / RUN['duty'] / RUN['v']), ('sit', sit, 40, 7.), ('lie', lie, 20, 5.)):
    ST.clear(); clips[n] = wrap(fn, k); T[n] = t; R[n] = max(ST); print(n, 'leg reach', round(min(ST), 2), round(max(ST), 2))
path = os.path.join(HERE, '../shellmere-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F'])), height_m=H)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 110; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g_) for g_ in gl]; ef = [P.verts('eyes', g_) for g_ in gl]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(min(x[:, 1].min(), y[:, 1].min()) for x, y in zip(fr, ef)) * H, 4))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    i = int(np.argmax([x.max() for x in s])); k = int(s[i].argmax()); vv = E[ok][k][0]; d['worst_edge_at'] = [P.names[JJ[vv][ww[vv].argmax()]], *np.round(pos[vv], 2).tolist()]
    d['leg_reach_ratio_max'] = round(float(R[c]), 2); d['mean_top'] = round(float(np.mean([max(x[:, 1].max(), y[:, 1].max()) for x, y in zip(fr, ef)])), 3)
    if c in ('walk', 'run'):
        G = WALK if c == 'walk' else RUN; dr = 0
        for (fi, fs), o in PH[c].items():
            J_ = P.names.index('foot%d_%s' % (fi, fs)); so = np.where((pos[:, 1] < .04) & ((ww * (JJ == J_)).sum(1) > .97))[0]; A = []
            for k in np.linspace(.002, G['duty'] - .002, 24): t = ((o + k) % 1) * T[c]; x = P.verts('body', P.globals(c, t))[so] * H; x[:, 2] += G['v'] * k * T[c]; A.append(x)
            A = np.array(A); dr = max(dr, float(np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max()))
        d['planted_foot_drift_max_m'] = round(dr, 4); v = G['v']; d['stride_m'] = round(v * T[c], 3); d['plays_1to1_at_mps'] = v; d['cadence_at_mps'] = {str(q): round(q / (v * T[c]), 2) for q in (.55, 1.15, 1.92, 2.8, 4.2, 6.5, 9)}
    d['span_m'], d['length_m'], d['top_m'] = [round(float(max(f(x) for x in fr)) * H, 3) for f in (lambda x: np.ptp(x[:, 0]), lambda x: np.ptp(x[:, 2]), lambda x: x[:, 1].max())]; M[c] = d
json.dump(M, open(os.path.join(HERE, '../shellmere-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
