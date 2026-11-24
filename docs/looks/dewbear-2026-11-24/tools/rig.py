"""Dewbear rig + clips on rigcore (M132 s1).   blender -b -P rig.py  (or any python with numpy + scipy)  -> ../dewbear-v2-rigged.glb + ../dewbear-v2-metrics.json
Clips: idle, walk (a waddle, the eight legs in a wave from back to front), run (a hurried rocking waddle: one side's four feet, then the other's),
sit (up on the rear plates), lie (SLEEP, lids down), tun (curls into the tun-ball, rocks, uncurls)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt as S
from rigcore import Pose, rx, ry, rz
H = .50; TAU = 2 * np.pi; sm = K.smooth
SK = {'root': (None, (0, 0, 0)), 's2': ('root', (0, .64, -.07)), 's1': ('s2', (0, .68, .015)), 's0': ('s1', (0, .68, .185)), 'neck': ('s0', (0, .62, .37)), 'head': ('neck', (0, .60, .43)), 'lids': ('head', (0, .62, .60)),
      's3': ('s2', (0, .66, -.155)), 's4': ('s3', (0, .58, -.320)), 's5': ('s4', (0, .46, -.468)), 'tail': ('s5', (0, .25, -.58)), 'belly': ('s2', (0, .15, -.06))} | {'hem%d' % i: ('s%d' % i, (0, .25, S.PL[i][0])) for i in range(5)}
HOST = ('s0', 's1', 's2', 's4')
for s, x in (('l', 1), ('r', -1)):
    for i in range(4): a, b, c = S.LEG[i][:3]; SK['leg%d_%s' % (i, s)] = (HOST[i], (x * a[0], a[1], a[2])); SK['foot%d_%s' % (i, s)] = ('leg%d_%s' % (i, s), (x * c[0], c[1] + .012, c[2]))
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(HERE, '../dewbear-v2.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
PD = np.stack(S.plates(A0), 1); HD = S.head(A0); LD = np.stack([S.leg(A0, i) for i in range(4)], 1); BD = S.belly(A0); TD = S.tail(V0)
sh, hd = PD.min(1), HD; other = np.minimum(np.minimum(sh, hd), BD); legv = (LD.min(1) < other - .0005) & (V0[:, 1] < .40); tl = (TD < np.minimum(sh, BD)) & ~legv & (V0[:, 2] < -.58); head = (hd < np.minimum(sh, BD)) & ~legv
pl = PD.argmin(1); zc = np.array([p[0] for p in S.PL]); bz = np.abs(V0[:, 2:3] - zc[None]).argmin(1); seg = np.where(sh < BD, pl, bz); idg = lambda mask: (lambda V: mask); body = ~legv & ~tl & ~head
B = [('s%d' % i, (0, .5, zc[i]), (0, .6, zc[i]), .3, idg(body & (seg == i))) for i in range(6)] + [('head', (0, .6, .5), (0, .6, .55), .3, idg(head)), ('tail', J('tail'), (0, .15, -.73), .1, idg(tl))]; RIG = []
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > 0
    for i in range(4):
        me = legv & sd & (LD.argmin(1) == i); a, f = J('leg%d_%s' % (i, s)), J('foot%d_%s' % (i, s)); B += [('leg%d_%s' % (i, s), a, a + (f - a) * .62, .1, idg(me)), ('foot%d_%s' % (i, s), f, f + (0, -.02, .05), .085, idg(me & (V0[:, 1] < .13)))]; RIG.append((len(B) - 1, idg(me & (V0[:, 1] < .055))))
nm = [b[0] for b in B]; w = K.skin_weights(V0, m['F'], B, 5, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
def along(P, tau=.026):
    """how much of each plate (and the head) a point of the shell rides on: a smooth function of place, so a seam opens evenly all along"""
    A = np.c_[np.abs(P[:, 0]), P[:, 1:]]; D = np.c_[np.stack(S.plates(A), 1), S.head(A)]; D -= D.min(1, keepdims=True); w_ = np.exp(-D / tau); w_ /= w_.sum(1, keepdims=True); X = np.zeros((len(P), len(nb)))
    h_ = np.where(P[:, 1] < .5, 1 - sm(.23, .47, P[:, 1]), 0)
    for k_, b_ in enumerate(['s%d' % k for k in range(6)] + ['head']):
        if k_ < 5: X[:, ix(b_)] = w_[:, k_] * (1 - h_); X[:, ix('hem%d' % k_)] = w_[:, k_] * h_          # the flank's lower edge has its own bone: it is drawn up to the ball's middle in the curl
        else: X[:, ix(b_)] = w_[:, k_]
    return X
def bel(P):
    w_ = np.exp(-((P[:, 2:3] - zc[None]) / .10) ** 2); w_ /= w_.sum(1, keepdims=True); X = np.zeros((len(P), len(nb)))
    for k_ in range(6): X[:, ix('s%d' % k_)] = w_[:, k_]
    return X
trunk = np.clip(1 - W[:, [ix(n) for n in nb if n[:3] in ('leg', 'foo', 'tai')]].sum(1), 0, 1)[:, None]; q = sm(-.015, .015, np.minimum(sh, hd) - BD)[:, None]
smooth = along(V0) * (1 - q) + bel(V0) * q; limb = W.copy(); limb[:, [ix('s%d' % k) for k in range(6)] + [ix('head')]] = 0; bw = q * (1 - sm(.14, .32, V0[:, 1]))[:, None] * .9; smooth = smooth * (1 - bw); smooth[:, ix('belly')] = bw[:, 0]; W = K.four(limb + smooth * trunk); parts = {'body': dict(m, W=W)}
eP = live['eyes']['POSITION'].astype(float); eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), (58, 96, 112)); onb = (eP[:, 2] < .50) & ~lid; e = np.zeros((len(eP), len(nb))); e[~onb & ~lid, ix('head')] = 1; e[lid, ix('lids')] = 1
e[onb] = along(eP[onb]); bead = isc(tuple(S.BEAD), (244, 252, 252)); e[bead] = np.eye(len(nb))[along(eP[bead]).argmax(1)]; e = K.four(e); parts['eyes'] = dict(live['eyes'], W=e); print('lid verts', lid.sum(), 'seam + dew verts', onb.sum())
VE = eP; FT = [(i, s) for i in range(4) for s in 'lr']; SOLE = {k: V0[W[:, ix('foot%d_%s' % k)] > .5] - J('foot%d_%s' % k) for k in FT}; ST = []
NL = ~legv & (W[:, [ix(n) for n in nb if n[:3] in ('leg', 'foo')]].sum(1) < .02)
def low(p, trunk=False): return K.skin(V0[NL], W[NL], SK, p)[:, 1].min() if trunk else min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(VE, e, SK, p)[:, 1].min())
def foot(p, i, s, z=0, y=0, x=0, R=np.eye(3)):
    """the stub leg has one bone: it aims at the planted foot and is drawn out or pushed in to reach it"""
    L, f = 'leg%d_%s' % (i, s), 'foot%d_%s' % (i, s); j = J(f); sx = 1 if s == 'l' else -1; c = max(0, -j[1] - (SOLE[i, s] @ R.T)[:, 1].min()); T = np.array([j[0] + sx * x, j[1] + max(y, c), j[2] + z])
    p.R[L] = np.eye(3); Rp, A = p.glob(L); d0 = j - J(L); R1 = K.align(Rp @ d0, T - A) @ Rp; p.R[L] = Rp.T @ R1; p.T[f] = R1.T @ (T - A) - d0; p.R[f] = R1.T @ R; ST.append(np.linalg.norm(T - A) / np.linalg.norm(d0))
def lids(p, k): p.T['lids'] = np.array([0, 0, S.LID * k])
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .024, c + .026, c + .050) for c in cs)
def breathe(p, b): p.T['s2'] = np.array([0, .006 * b, 0]); p.rot('s1', rx(-.012 * b)); p.rot('s3', rx(.012 * b))
def idle(u):
    """breathes, rocks from side to side, looks left, then leans in close with a tilted head: no personal space"""
    p = Pose(SK); br = np.sin(TAU * u * 3); breathe(p, br); r = np.sin(TAU * u * 1); ln = pulse(u, .52, .60, .80, .90); lk = pulse(u, .16, .22, .36, .44)
    p.T['root'] = np.array([.012 * r, 0, .050 * ln]); p.R['root'] = rz(-.018 * r); p.rot('s0', ry(.10 * lk), rx(-.05 * ln)); p.rot('neck', ry(.20 * lk), rx(-.06 * ln)); p.rot('head', ry(.30 * lk - .10 * ln), rx(-.10 * ln + .012 * br), rz(.24 * ln)); p.rot('tail', ry(.16 * np.sin(TAU * u * 4)))
    lids(p, blink(u, .09, .40, .62, .655)); [foot(p, *k) for k in FT]; return p
WALK = dict(v=1.0, duty=.5, reach=.115, n=28); RUN = dict(v=2.8, duty=.30, reach=.185, n=40)
def gait(u, G, lag, hgt, roll, lean, drop, bounce, yaw):
    p = Pose(SK); a = TAU * u; d = G['duty']; mid = d / 2
    p.T['root'] = np.array([.034 * roll / .10 * np.sin(TAU * (u - mid) + np.pi / 2), -drop - bounce * np.cos(2 * TAU * (u - mid)), 0]); p.R['root'] = rx(lean) @ rz(-roll * np.sin(TAU * (u - mid) + np.pi / 2)) @ ry(yaw * np.sin(a))
    for b, k in (('s1', .35), ('s0', .5), ('neck', .3)): p.rot(b, ry(-yaw * k * 2 * np.sin(a - .4)))
    for b, k in (('s3', .35), ('s4', .5), ('s5', .5)): p.rot(b, ry(yaw * k * 1.6 * np.sin(a - 1.0)))
    p.rot('head', rz(roll * .8 * np.sin(TAU * (u - mid) + np.pi / 2)), rx(-lean + .03 * np.sin(2 * a))); p.rot('tail', ry(.30 * np.sin(a - 1.4)), rx(.10 * np.sin(2 * a)))
    for i, s in FT:
        k = (u - (0 if s == 'l' else .5) - (3 - i) * lag + 1e-9) % 1; r = G['reach']
        if k < d - 1e-9: foot(p, i, s, r * (1 - 2 * k / d), 0, .004)
        else: q = (k - d) / (1 - d); foot(p, i, s, -r + 2 * r * sm(.04, .96, q), hgt * max(0, np.sin(np.pi * q)) ** .9, .030 * np.sin(np.pi * q), rx((.45 if G is WALK else .20) * np.sin(np.pi * min(1, q * 1.5)) * (1 - q)))
    return p
walk = lambda u: gait(u, WALK, 1 / 7, .085, .105, .0, .012, .010, .07)
run = lambda u: gait(u, RUN, .05, .10, .13, .04, .005, .035, .10)
def ground(p, aim=0, trunk=False):
    l = low(p, trunk); p.T['root'] = p.T['root'] + np.array([0, aim - l, 0]); return p
def sit(u):
    """up on her rear plates, the front four legs hanging, paws paddling now and then"""
    p = Pose(SK); br = np.sin(TAU * u * 3); p.R['root'] = rx(-.58 - .012 * br); p.T['root'] = np.array([0, 0, .22]); p.rot('s1', rx(.06)); p.rot('s0', rx(.10)); p.rot('neck', rx(.16)); p.rot('head', rx(.26 + .012 * br)); p.rot('s3', rx(.16)); p.rot('s4', rx(.22)); p.rot('s5', rx(.26)); p.rot('tail', rx(.15), ry(.2 * np.sin(TAU * u * 2)))
    lk = pulse(u, .20, .26, .42, .48) - pulse(u, .62, .67, .80, .86); p.rot('head', ry(.38 * lk), rz(-.12 * lk)); lids(p, blink(u, .12, .55, .90))
    for i, s in FT:
        x = 1 if s == 'l' else -1; pd = pulse(u, .48, .52, .58, .62) * np.sin(TAU * u * 12 + (0 if x > 0 else np.pi) + i)
        if i < 3: p.R['leg%d_%s' % (i, s)] = rx(.30 - .10 * i + .20 * pd + .02 * br) @ rz(-x * (.16 if i == 0 else .05)); p.R['foot%d_%s' % (i, s)] = rx(.35)
    ground(p, 0, True)
    for s in 'lr':                                                  # only the hind pair reaches the ground: feet out in front of the rump
        A = p.glob('leg3_' + s)[1]; L_ = np.linalg.norm(J('foot3_' + s) - J('leg3_' + s)) * 1.12; z = np.sqrt(max(.02, L_ ** 2 - (A[1] - .067) ** 2 - .05 ** 2)); foot(p, 3, s, A[2] + z - J('foot3_' + s)[2], 0, .06)
    return p
def lie(u):
    """down on her belly: the belly gives, the hem rests near the ground, chin on the ground between the forefeet, lids shut"""
    p = Pose(SK); br = np.sin(TAU * u); p.T['belly'] = np.array([0, .16, 0])
    for b, k in (('s1', .03), ('s0', .05), ('neck', .05), ('head', .10)): p.rot(b, rx(k))
    p.rot('s4', rx(.04)); p.rot('s5', rx(.12)); [p.T.__setitem__('hem%d' % i, np.array([0, .035, 0])) for i in range(5)]
    p.T['head'] = np.array([0, -.030, 0]); p.T['neck'] = np.array([0, -.020, 0]); p.rot('head', rz(.07)); p.rot('tail', rx(.55), ry(.25)); p.T['tail'] = np.array([0, .05, 0]); lids(p, 1)
    ground(p, 0, True); p.T['s2'] = np.array([0, .006 * (br + 1), 0])
    for i, s in FT: foot(p, i, s, (.04, .02, -.01, -.04)[i], 0, (.12, .12, .12, .12)[i])
    return p
CURL = dict(s1=.78, s0=.82, neck=.42, head=.34, s3=-.78, s4=-.86, s5=-.66)
def ball(k, rock=0):
    p = Pose(SK)
    for b, a in CURL.items(): p.rot(b, rx(a * k))
    p.T['head'] = np.array([0, .0, -.19]) * k; p.rot('tail', rx(.9 * k)); p.T['tail'] = np.array([0, .10, .12]) * k; lids(p, sm(.25, .5, k)); p.T['belly'] = np.array([0, .24, 0]) * sm(.1, .7, k)
    for i in range(5): p.T['hem%d' % i] = np.array([0, (.14, .19, .22, .21, .16)[i], 0]) * sm(.15, 1, k)
    for i, s in FT:
        x = 1 if s == 'l' else -1; t = sm(.05, .75, k); p.R['leg%d_%s' % (i, s)] = rz(-x * .55 * t); p.T['foot%d_%s' % (i, s)] = (J('leg%d_%s' % (i, s)) - J('foot%d_%s' % (i, s))) * .72 * t; p.T['leg%d_%s' % (i, s)] = np.array([-x * .17, .20, (0, 0, .03, .10)[i]]) * t
    p.R['root'] = rx(.20 * k + rock); return ground(p, .009 * k)
def tun(u):
    k = sm(.10, .30, u) * (1 - sm(.74, .92, u)); sh = pulse(u, .03, .06, .09, .12) * np.sin(TAU * u * 40) * .02
    if k < 1e-6: p = Pose(SK); p.R['root'] = rz(sh); p.T['root'] = np.array([0, -.03 * pulse(u, .02, .08, .085, .10), 0]); [foot(p, *q) for q in FT]; return p
    ro = .22 * np.sin(TAU * (u - .30) / .13) * np.exp(-(u - .30) / .13) * (u > .30) if u < .74 else 0; return ball(k, ro)
clips, T, R = {}, {}, {}
for n, fn, k, t in (('idle', idle, 42, 7.), ('walk', walk, WALK['n'], 2 * WALK['reach'] * H / WALK['duty'] / WALK['v']), ('run', run, RUN['n'], 2 * RUN['reach'] * H / RUN['duty'] / RUN['v']), ('sit', sit, 40, 6.), ('lie', lie, 20, 4.2), ('tun', tun, 60, 5.)):
    ST.clear(); clips[n] = wrap(fn, k); T[n] = t; R[n] = max(ST); print(n, 'leg reach', min(ST), max(ST))
path = os.path.join(HERE, '../dewbear-v2-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F'])), height_m=H)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 110; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; ef = [P.verts('eyes', g) for g in gl]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(min(x[:, 1].min(), y[:, 1].min()) for x, y in zip(fr, ef)) * H, 4))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    i = int(np.argmax([x.max() for x in s])); k = int(s[i].argmax()); vv = E[ok][k][0]; d['worst_edge_at'] = [P.names[JJ[vv][ww[vv].argmax()]], *np.round(pos[vv], 2).tolist()]
    if R[c]: d['leg_reach_ratio_max'] = round(float(R[c]), 2)
    if c in ('walk', 'run'):                                       # every foot over its own stance, not just one
        G, lag = (WALK, 1 / 7) if c == 'walk' else (RUN, .05); dr = 0
        for fi, fs in FT:
            J_ = P.names.index('foot%d_%s' % (fi, fs)); so = np.where((pos[:, 1] < .05) & ((ww * (JJ == J_)).sum(1) > .97))[0]; o = (0 if fs == 'l' else .5) + (3 - fi) * lag
            A = []
            for k in np.linspace(.002, G['duty'] - .002, 24): t = ((o + k) % 1) * T[c]; x = P.verts('body', P.globals(c, t))[so] * H; x[:, 2] += G['v'] * k * T[c]; A.append(x)
            A = np.array(A); dr = max(dr, float(np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max()))
        d['planted_foot_drift_max_m'] = round(dr, 4)
    if c in ('walk', 'run'): v = dict(walk=WALK, run=RUN)[c]['v']; d['stride_m'] = round(v * T[c], 3); d['plays_1to1_at_mps'] = v; d['cadence_at_mps'] = {str(q): round(q / (v * T[c]), 2) for q in (.55, 1.15, 1.92, 2.8, 4.2, 6.5)}
    d['span_m'], d['length_m'], d['top_m'] = [round(float(max(f(x) for x in fr)) * H, 3) for f in (lambda x: np.ptp(x[:, 0]), lambda x: np.ptp(x[:, 2]), lambda x: x[:, 1].max())]; M[c] = d
json.dump(M, open(os.path.join(HERE, '../dewbear-v2-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
