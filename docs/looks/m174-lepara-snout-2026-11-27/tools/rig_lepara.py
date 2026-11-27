"""Lepara rig + clips on rigcore (M132 s1), the Dewbear rig.py route.   python rig_lepara.py  -> ../lepara-rigged.glb + ../lepara-metrics.json
20 bones (M174 snout rework: + `nose`, the canon twitchy rabbit nose). Clips under the game's names: idle (breathes, nose twitches, ears swivel one at a time, a little wave, a thump),
walk (small two-footed hops), run (long bounds, ears streaming back), sit (settles low and grooms her face with both paws),
lie (SLEEP: a loaf, ears laid flat down her back, lids shut)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt_lepara as S
from rigcore import Pose, rx, ry, rz
H = .48; TAU = 2 * np.pi; sm = K.smooth
EB = S.EC - S.ER[:, 1] * .150; EM = S.EC + S.ER[:, 1] * .010; ET = S.EC + S.ER[:, 1] * .188          # ear base, middle joint, tip (right side)
SK = {'root': (None, (0, 0, 0)), 'hips': ('root', (0, .17, -.03)), 'chest': ('hips', (0, .32, .01)), 'neck': ('chest', (0, .40, .03)), 'head': ('neck', (0, .48, .05)), 'lids': ('head', (0, .58, .20)), 'nose': ('head', (0, .51, .29)),
      'tail': ('hips', (0, .10, -.22))}
for s, x in (('l', 1), ('r', -1)):
    X = np.array([x, 1, 1]); SK['ear_' + s] = ('head', tuple(EB * X)); SK['ear2_' + s] = ('ear_' + s, tuple(EM * X)); SK['arm_' + s] = ('chest', (x * .165, .33, .07)); SK['paw_' + s] = ('arm_' + s, (x * .142, .24, .19))
    SK['thigh_' + s] = ('hips', (x * .15, .13, -.03)); SK['foot_' + s] = ('thigh_' + s, (x * .13, .036, .12))
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(HERE, '../lepara.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
BD, HD, ER, BL, FT, AR, TL = S.body(A0), S.head(A0), S.ears(A0), S.bill(A0), S.feet(A0), S.arms(A0), S.tail(V0)
mn = np.min([BD, HD, ER, BL, FT, AR, TL], 0); isp = lambda d: d <= mn + 1e-9
ear, hed, arm, ft, tl = isp(ER) & (V0[:, 1] > .62), (isp(HD) | isp(BL)) & ~isp(ER), isp(AR) & ~isp(HD), isp(FT), isp(TL); bod = ~(ear | hed | arm | ft | tl)
g = lambda mask: (lambda V: mask)
B = [('hips', (0, .04, -.03), (0, .22, -.03), .26, g(bod)), ('chest', (0, .28, .01), (0, .38, .03), .20, g(bod)), ('neck', (0, .39, .03), (0, .44, .05), .12, g(bod | hed)),
     ('head', (0, .50, .06), (0, .58, .10), .26, g(hed)), ('tail', J('tail'), (0, .085, -.43), .10, g(tl))]; RIG = []
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > 0; X = np.array([x, 1, 1])
    B += [('ear_' + s, EB * X, EM * X, .09, g(ear & sd)), ('ear2_' + s, EM * X, ET * X, .09, g(ear & sd)), ('arm_' + s, J('arm_' + s), J('paw_' + s), .06, g(arm & sd)), ('paw_' + s, J('paw_' + s), J('paw_' + s) + (0, -.01, .03), .05, g(arm & sd)),
          ('thigh_' + s, J('thigh_' + s), J('thigh_' + s) + (0, -.05, .07), .12, g(bod & sd)), ('foot_' + s, J('foot_' + s), J('foot_' + s) + (0, 0, .14), .09, g(ft & sd))]
    RIG.append((len(B) - 1, g(ft & sd & (V0[:, 1] < .035))))
nm = [b[0] for b in B]; w = K.skin_weights(V0, m['F'], B, 6, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
W = K.four(W); parts = {'body': dict(m, W=W)}
eP = live['eyes']['POSITION'].astype(float); eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), (70, 56, 66)); nos = isc((214, 130, 136)); e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1; e[lid] = 0; e[lid, ix('lids')] = 1; e[nos] = 0; e[nos, ix('nose')] = 1; print('nose verts', nos.sum()); parts['eyes'] = dict(live['eyes'], W=e); print('lid verts', lid.sum())
FTS = ('l', 'r'); SOLE = {s: V0[W[:, ix('foot_' + s)] > .5] - J('foot_' + s) for s in FTS}; ST = []
def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(eP, e, SK, p)[:, 1].min())
def foot(p, s, z=0, y=0, x=0, R=np.eye(3)):
    """the stub leg has one bone: it aims at the planted foot and is drawn out or pushed in to reach it"""
    L, f = 'thigh_' + s, 'foot_' + s; j = J(f); sx = 1 if s == 'l' else -1; c = max(0, -j[1] - (SOLE[s] @ R.T)[:, 1].min()); T = np.array([j[0] + sx * x, j[1] + max(y, c), j[2] + z])
    p.R[L] = np.eye(3); Rp, A = p.glob(L); d0 = j - J(L); R1 = K.align(Rp @ d0, T - A) @ Rp; p.R[L] = Rp.T @ R1; p.T[f] = R1.T @ (T - A) - d0; p.R[f] = R1.T @ R; ST.append(np.linalg.norm(T - A) / np.linalg.norm(d0))
def lids(p, k): p.T['lids'] = np.array([0, 0, S.LID * k])
def ears(p, l, r, back=0., out=0.):
    """l / r = forward (+) or back (-) swing of each ear; back folds the tip; out splays them"""
    for s, a, x in (('l', l, 1), ('r', r, -1)): p.rot('ear_' + s, rx(a), rz(-x * out)); p.rot('ear2_' + s, rx(-back))
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .024, c + .026, c + .050) for c in cs)
def twitch(p, k, u, hz=24): c = np.cos(TAU * u * hz); p.T['nose'] = np.array([0, .0030 * k * c, -.0010 * k * (c > 0)])  # hz = half the clip's keys, so every key flips: a 3 Hz flick, never aliased
def breathe(p, b): p.T['chest'] = np.array([0, .004 * b, 0]); p.rot('chest', rx(-.015 * b))
def idle(u):
    """breathes, nose twitching, ears swivel one at a time, a little wave with her left paw, then one thump of a hind foot"""
    p = Pose(SK); br = np.sin(TAU * u * 3); breathe(p, br); tw = pulse(u, .05, .07, .30, .33) * np.sin(TAU * u * 36) * .025
    lk = pulse(u, .14, .20, .34, .40); p.rot('neck', ry(.14 * lk)); p.rot('head', ry(.22 * lk), rx(tw + .01 * br), rz(.10 * pulse(u, .42, .48, .56, .62)))
    el, er_ = pulse(u, .22, .26, .36, .40), pulse(u, .44, .48, .58, .62); ears(p, .35 * el - .10 * er_, -.30 * er_ + .05 * el, .25 * pulse(u, .66, .70, .74, .78), .06 * np.sin(TAU * u * 2))
    wv = pulse(u, .44, .50, .64, .70); p.rot('arm_l', rx(-1.25 * wv), rz(.55 * wv)); p.rot('paw_l', rz(.35 * wv * np.sin(TAU * u * 14)), rx(-.3 * wv))
    p.rot('tail', ry(.12 * np.sin(TAU * u * 2)), rx(.10 * pulse(u, .80, .83, .88, .92)))
    th = pulse(u, .80, .835, .845, .87); lids(p, max(blink(u, .09, .40, .62), .6 * pulse(u, .845, .85, .86, .88)))
    twitch(p, max(pulse(u, .03, .05, .30, .33), pulse(u, .70, .72, .78, .80), .35), u)
    foot(p, 'l'); foot(p, 'r', .01 * th, .045 * th, 0, rx(-.35 * th)); return p
WALK = dict(v=.6, duty=.50, reach=.090, n=24); RUN = dict(v=2.8, duty=.26, reach=.150, n=30)
def hop(u, G, hgt, lean, sq, earb, arms_, lift):
    """both hind feet together: planted for `duty`, then the body springs, tucks the feet and lands"""
    p = Pose(SK); d = G['duty']; r = G['reach']; k = u % 1
    if k < d: q = k / d; air = 0; drop = sq * np.sin(np.pi * q); zf = r * (1 - 2 * q); yf = 0
    else: q = (k - d) / (1 - d); air = np.sin(np.pi * q); drop = 0; zf = -r + 2 * r * sm(.05, .95, q); yf = hgt * air * .85
    p.T['root'] = np.array([0, hgt * air - drop + lift, 0]); p.R['root'] = rx(lean * (1 + .6 * np.sin(TAU * k - .6)))
    p.rot('chest', rx(.05 * np.sin(TAU * k))); p.rot('neck', rx(-lean * .5)); p.rot('head', rx(-lean * .6 - .06 * np.sin(TAU * k - .3)))
    ears(p, -earb * (.4 + .6 * air), -earb * (.4 + .6 * air), .25 * earb * air)
    p.rot('tail', rx(-.30 * air + .15 * drop / max(sq, 1e-6)))
    for s in FTS: foot(p, s, zf, yf, .004, rx(-.5 * air * (k >= d)))
    for s, x in (('l', 1), ('r', -1)): p.rot('arm_' + s, rx(-arms_ * (.3 + .7 * air)))
    return p
walk = lambda u: hop(u, WALK, .060, .08, .010, .12, .35, .030)
run = lambda u: hop(u, RUN, .130, .22, .015, .55, .9, .050)
def ground(p, aim=0):
    l = low(p); p.T['root'] = p.T['root'] + np.array([0, aim - l, 0]); return p
def sit(u):
    """settles lower and grooms: both paws up to the cheeks and down the face, ears pulled down to be washed, then a shake"""
    p = Pose(SK); br = np.sin(TAU * u * 2); p.T['hips'] = np.array([0, -.02, 0]); p.rot('hips', rx(.05)); breathe(p, br)
    gr = pulse(u, .10, .18, .62, .70); st = np.sin(TAU * u * 5) * gr; sh = pulse(u, .76, .79, .86, .90) * np.sin(TAU * u * 40)
    p.rot('neck', rx(.10 * gr), rz(.06 * sh)); p.rot('head', rx(.12 * gr + .04 * st), rz(.12 * sh))
    for s, x in (('l', 1), ('r', -1)): p.rot('arm_' + s, rx(-1.15 * gr - .25 * st), rz(x * .20 * gr)); p.rot('paw_' + s, rx(-.5 * gr))
    ears(p, -.35 * gr, -.35 * gr, .9 * pulse(u, .30, .36, .55, .60), .10 * sh); lids(p, max(.85 * gr, blink(u, .90)))
    twitch(p, max(pulse(u, .70, .72, .88, .90), .3), u, 22); p.rot('tail', ry(.2 * sh)); [foot(p, s) for s in FTS]; return ground(p, 0)
def lie(u):
    """asleep in a loaf: sunk low, head down on the chest, ears laid flat down her back, paws tucked, lids shut"""
    p = Pose(SK); br = np.sin(TAU * u); p.T['hips'] = np.array([0, -.035, 0]); p.T['chest'] = np.array([0, -.03 + .004 * br, -.01]); p.rot('chest', rx(.10)); p.rot('neck', rx(.20))
    p.rot('head', rx(.18 + .01 * br), rz(.06)); ears(p, -1.95, -1.90, .45, -.12); lids(p, 1)
    for s in ('l', 'r'): p.rot('arm_' + s, rx(.35)); p.rot('paw_' + s, rx(.4))
    p.rot('tail', ry(.35)); [foot(p, s, .01, 0, .01) for s in FTS]; return ground(p, 0)
clips, T, R = {}, {}, {}
for n, fn, k, t in (('idle', idle, 48, 8.), ('walk', walk, WALK['n'], 2 * WALK['reach'] * H / WALK['duty'] / WALK['v']), ('run', run, RUN['n'], 2 * RUN['reach'] * H / RUN['duty'] / RUN['v']), ('sit', sit, 44, 6.), ('lie', lie, 20, 4.4)):
    ST.clear(); clips[n] = wrap(fn, k); T[n] = t; R[n] = max(ST); print(n, 'leg reach', round(min(ST), 2), round(max(ST), 2))
path = os.path.join(HERE, '../lepara-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F'])), height_m=H)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 110; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g_) for g_ in gl]; ef = [P.verts('eyes', g_) for g_ in gl]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(min(x[:, 1].min(), y[:, 1].min()) for x, y in zip(fr, ef)) * H, 4))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    i = int(np.argmax([x.max() for x in s])); k = int(s[i].argmax()); vv = E[ok][k][0]; d['worst_edge_at'] = [P.names[JJ[vv][ww[vv].argmax()]], *np.round(pos[vv], 2).tolist()]
    d['leg_reach_ratio_max'] = round(float(R[c]), 2); d['mean_top'] = round(float(np.mean([x[:, 1].max() for x in fr])), 3)
    if c in ('walk', 'run'):
        G = WALK if c == 'walk' else RUN; dr = 0
        for fs in FTS:
            J_ = P.names.index('foot_' + fs); so = np.where((pos[:, 1] < .03) & ((ww * (JJ == J_)).sum(1) > .97))[0]; A = []
            for k in np.linspace(.002, G['duty'] - .002, 24): t = k * T[c]; x = P.verts('body', P.globals(c, t))[so] * H; x[:, 2] += G['v'] * k * T[c]; A.append(x)
            A = np.array(A); dr = max(dr, float(np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max()))
        d['planted_foot_drift_max_m'] = round(dr, 4); v = G['v']; d['stride_m'] = round(v * T[c], 3); d['plays_1to1_at_mps'] = v; d['cadence_at_mps'] = {str(q): round(q / (v * T[c]), 2) for q in (.6, 1.15, 1.92, 2.8, 4.2, 6.5, 9)}
    d['span_m'], d['length_m'], d['top_m'] = [round(float(max(f(x) for x in fr)) * H, 3) for f in (lambda x: np.ptp(x[:, 0]), lambda x: np.ptp(x[:, 2]), lambda x: x[:, 1].max())]; M[c] = d
json.dump(M, open(os.path.join(HERE, '../lepara-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
