"""Athowl rig + clips on rigcore (M132 s1).   blender -b -P rig.py  -> ../athowl-rigged.glb + ../athowl-metrics.json
Clips: idle (patient, then a snap of the head far round), walk (a two-footed hop), run (= FLY, wings beating), glide, sit (= PERCH), lie (= SLEEP, lids down)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt as S
from rigcore import Pose, rx, ry, rz
H = .50; TAU = 2 * np.pi; sm = K.smooth
SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', (0, .20, -.02)), 'chest': ('pelvis', (0, .34, 0)), 'neck': ('chest', (0, .485, 0)), 'neck2': ('neck', (0, .497, 0)), 'head': ('neck2', (0, .509, 0))}
TS = (0, .30, .55, .78); wp = lambda t: S.SH + S.WU * S.WL * t + S.WN * .042 * np.sin(np.pi * t)
for s, x in (('l', 1), ('r', -1)):
    SK |= {'tuft_' + s: ('head', (x * .235, .850, .15)), 'leg_' + s: ('pelvis', (x * .125, .190, -.015)), 'shin_' + s: ('leg_' + s, (x * .140, .118, .035)), 'foot_' + s: ('shin_' + s, (x * .146, .055, .005))}
    for i, t in enumerate(TS): SK['wing%d_%s' % (i + 1, s)] = ('wing%d_%s' % (i, s) if i else 'chest', tuple(wp(t) * (x, 1, 1)))
SK |= {'lids': ('head', (0, .65, .18)), 'tail1': ('pelvis', (0, .17, -.25)), 'tail2': ('tail1', (0, .12, -.33))}
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(HERE, '../athowl.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
t_, w_, n_ = S.wingloc(A0); BL = S.blade(A0); inw = (BL < .006) & (A0[:, 1] < .50) & ((t_ > .04) | (A0[:, 0] > .262)) & (A0[:, 0] > .19); hd = ((V0[:, 1] > .512) | ((S.head(A0) < .006) & (V0[:, 1] > S.NECK_Y - .006))) & ~inw
R0 = np.hypot(V0[:, 0], V0[:, 2]); groove = ~inw & (np.abs(V0[:, 1] - S.NECK_Y) < .022) & (R0 < .31)
tail = ~inw & (V0[:, 2] < -.235) & (V0[:, 1] < .20); leg = ~inw & ~tail & (A0[:, 0] > .03) & (S.feet(A0) < .012) & (V0[:, 1] < .15) & (S.ell(A0, (0, .268, 0), (.296, .222, .266)) > -.004)
idg = lambda mask: (lambda V: mask)
B = [('pelvis', (0, .12, -.02), (0, .24, 0), .25, idg(~inw & ~hd)), ('chest', (0, .34, 0), (0, .46, 0), .22, idg(~inw & ~hd)), ('head', (0, .6, 0), (0, .8, 0), .3, idg(hd))]
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > .006
    B += [('tuft_' + s, (x * .27, .88, .13), (x * .366, .997, .08), .075, idg(hd & sd & (A0[:, 0] > .20) & (V0[:, 1] > .83))), ('leg_' + s, J('leg_' + s), J('shin_' + s), .07, idg(leg & sd)), ('shin_' + s, J('shin_' + s), J('foot_' + s), .06, idg(leg & sd)), ('foot_' + s, (x * .146, .03, .0), (x * .146, .03, .10), .06, idg(leg & sd & (V0[:, 1] < .10)))]
    B += [('wing%d_%s' % (i + 1, s), wp(t) * (x, 1, 1), wp(TS[i + 1] if i < 3 else 1.) * (x, 1, 1), .08, idg(inw & sd & ((t_ >= t - .06) | (i == 0)))) for i, t in enumerate(TS)]
B += [('tail1', J('tail1'), J('tail2'), .05, idg(tail)), ('tail2', J('tail2'), (0, .085, -.42), .05, idg(tail))]
nm = [b[0] for b in B]; RIG = [(nm.index('foot_' + s), idg((V0[:, 1] < .045) & (V0[:, 0] * x > .045) & (V0[:, 2] > -.06) & (V0[:, 2] < .25) & leg)) for s, x in (('l', 1), ('r', -1))]
w = K.skin_weights(V0, m['F'], B, 6, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
# the neck in its groove: a turn is shared out along the hidden wall, so the skin outside it never shears
lo, hi_ = ~hd & groove, hd & groove; q = np.where(V0[:, 1] < S.NECK_Y, .5 * (1 - np.clip((R0 - .135) / .055, 0, 1)), .5 + .5 * np.clip((R0 - .135) / .075, 0, 1))
wall = groove & (R0 < .150); q = np.where(wall, .5 + np.clip((V0[:, 1] - S.NECK_Y) / .017, -1, 1) * .12, q)
for i in np.where(groove)[0]:
    W[i] = 0; a = q[i] * 3; k = min(int(a), 2); c = [ix(b) for b in ('chest', 'neck', 'neck2', 'head')]; W[i, c[k]], W[i, c[k + 1]] = 1 - (a - k), a - k
up = hd & ~groove; W[np.ix_(up, [ix('chest'), ix('pelvis')])] = 0; W[up] /= np.maximum(W[up].sum(1, keepdims=True), 1e-9); W = K.four(W)
parts = {'body': dict(m, W=W)}; eP = live['eyes']['POSITION']; e = np.zeros((len(eP), len(nb))); f = eP[:, 1] < .15; lc = np.array([(224, 212, 230), (104, 80, 128)]); lid = (np.abs(live['eyes']['COLOR_0'][:, None, :3].astype(int) - np.round(255 * (lc / 255.) ** 2.2).astype(int)[None]).max(-1).min(1) <= 1); print('lid verts', lid.sum()); e[~f & ~lid, ix('head')] = 1; e[lid, ix('lids')] = 1; e[f & (eP[:, 0] > 0), ix('foot_l')] = 1; e[f & (eP[:, 0] < 0), ix('foot_r')] = 1; parts['eyes'] = dict(live['eyes'], W=e)
VE = eP.astype(float); SOLE = {s: np.vstack([V0[W[:, ix('foot_' + s)] > .5], VE[e[:, ix('foot_' + s)] > .5]]) - J('foot_' + s) for s in 'lr'}
LEN = sum(np.linalg.norm(J(a) - J(b)) for a, b in (('leg_l', 'shin_l'), ('shin_l', 'foot_l'))); ST = []
def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(VE, e, SK, p)[:, 1].min())
def foot(p, s, z=0, y=0, R=np.eye(3), x=None):
    j = J('foot_' + s); c = max(0, -j[1] - (SOLE[s] @ R.T)[:, 1].min()); r = p.leg('leg_' + s, 'shin_' + s, 'foot_' + s, (j[0] if x is None else x, j[1] + max(y, c), j[2] + z), R, bend=(.2 if s == 'l' else -.2, .1, 1), maxstretch=1.3); ST.append(r)
def wings(p, up, sweep=0, flat=0, tip=0, ext=0, pitch=0, only='lr'):
    """up = out from the side (0 folded, 1.5 level), tip = each outer joint's own bend, ext = how far the blade is drawn out, pitch = leading edge up"""
    for s in only:
        x = 1 if s == 'l' else -1; p.R['wing1_' + s] = rx(-pitch) @ ry(-x * sweep) @ rz(x * up) @ ry(x * flat); ps = [np.array(wp(t) * (x, 1, 1)) for t in TS]
        for i in (1, 2, 3): p.rot('wing%d_%s' % (i + 1, s), rz(x * tip)); p.T['wing%d_%s' % (i + 1, s)] = (ps[i] - ps[i - 1]) * ext
def yaw(p, a, down=0, tilt=0):
    for b in ('neck', 'neck2', 'head'): p.rot(b, ry(a / 3))
    p.rot('head', rx(down), rz(tilt))
def lids(p, k): p.T['lids'] = np.array([0, 0, S.LID * k])
def tufts(p, a):
    p.rot('tuft_l', rz(a)); p.rot('tuft_r', rz(-a))
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
def idle(u):
    """stillness (one breath every 2.2 s), then the head goes round to 130 degrees in a quarter of a second, holds, looks up, snaps home"""
    p = Pose(SK); br = np.sin(TAU * u * 4); p.T['chest'] = np.array([0, .003 * br, 0]); p.R['chest'] = rx(.012 * br); wings(p, .015 + .012 * br)
    a = 2.27 * pulse(u, .34, .372, .60, .632) - .55 * pulse(u, .80, .825, .92, .945); yaw(p, a, .05 * br * .3 - .14 * pulse(u, .47, .49, .56, .58), .32 * pulse(u, .835, .86, .90, .92))
    lids(p, max(pulse(u, c, c + .012, c + .016, c + .034) for c in (.12, .70, .965 - .05)))
    tufts(p, .10 * pulse(u, .30, .33, .36, .42) + .02 * br); p.rot('tail1', rx(.04 * br)); [foot(p, s) for s in 'lr']; return p
HOP = dict(v=.55, duty=.32, reach=.070, n=28)
def hop(u):
    p = Pose(SK); d = HOP['duty']; r = HOP['reach']; st = u < d - 1e-9; k = u / d if st else (u - d) / (1 - d)
    y = -.028 * np.sin(np.pi * k) if st else .125 * 4 * k * (1 - k); lean = .10 + (.12 * (k - .35) if st else .078 - .20 * k + .0 * k); lean = .10 + .10 * np.sin(TAU * (u - .10))
    p.T['root'] = np.array([0, y, 0]); p.R['pelvis'] = rx(lean); p.rot('chest', rx(-.02)); p.rot('head', rx(-lean * .8)); air = 0 if st else np.sin(np.pi * k)
    wings(p, .04 + .42 * air, flat=.15 * air, tip=.10 * air); tufts(p, -.10 * air); p.rot('tail1', rx(-.10 * air + .06 * np.sin(TAU * u)))
    for s in 'lr':
        if st: foot(p, s, r * (1 - 2 * k))
        else: z = -r + 2 * r * sm(.10, .92, k); foot(p, s, z * 1., y * .93 + .012 * air, rx(.55 * np.sin(np.pi * k) * (1 - k) * 1.6))
    return p
FLY = dict(v=2.8, n=24, T=.43, alt=.30, pitch=.72)
def flight(p, alt, pitch):
    p.T['root'] = np.array([0, alt, 0]); p.R['pelvis'] = rx(pitch); [p.rot(b, rx(-pitch * .27)) for b in ('neck', 'neck2', 'head')]; p.rot('tail1', rx(.10)); p.rot('tail2', rx(.10))
    for s in 'lr': p.rot('leg_' + s, rx(.35)); p.rot('shin_' + s, rx(.25)); p.rot('foot_' + s, rx(.30))
def fly(u):
    p = Pose(SK); a = TAU * u; flight(p, FLY['alt'] - .030 * np.cos(a - .5), FLY['pitch'] + .04 * np.sin(a)); dn = np.sin(a)       # beat: up at u .25, down at .75
    wings(p, 1.48 + .72 * np.sin(a), sweep=.18 * np.cos(a), flat=.45, tip=.20 * np.sin(a - 1.1) + .04, ext=.42 + .08 * -np.cos(a), pitch=FLY['pitch'] * .85 + .22 * np.cos(a)); tufts(p, -.25 + .05 * np.sin(a)); return p
def glide(u):
    p = Pose(SK); a = TAU * u; flight(p, FLY['alt'] + .012 * np.sin(a), .80 + .03 * np.sin(a)); p.rot('pelvis', rz(.05 * np.sin(a))); wings(p, 1.60 + .05 * np.sin(a + .6), sweep=.08, flat=.45, tip=.07 + .02 * np.sin(a), ext=.46, pitch=.72); p.rot('head', ry(.22 * np.sin(a))); tufts(p, -.28); return p
DROP = 0
def settle(p, br, fl):
    p.T['root'] = np.array([0, -DROP + .0015 * br, 0]); p.R['pelvis'] = rx(-.02); p.R['chest'] = rx(.03 + .010 * br); wings(p, .05 + .010 * br + .05 * fl, flat=-.05); p.rot('tail1', rx(.34)); p.rot('tail2', rx(.10))
def perch(u):
    p = Pose(SK); br = np.sin(TAU * u * 3); settle(p, br, pulse(u, .86, .89, .92, .97)); lids(p, max(pulse(u, c, c + .016, c + .02, c + .045) for c in (.10, .48))); yaw(p, -1.25 * pulse(u, .22, .25, .40, .43) + 1.75 * pulse(u, .56, .59, .74, .77), .05 + .01 * br, -.28 * pulse(u, .28, .31, .36, .38)); tufts(p, -.08 + .10 * pulse(u, .54, .56, .6, .66)); [foot(p, s) for s in 'lr']; return p
def sleep(u):
    p = Pose(SK); br = np.sin(TAU * u); settle(p, 1.6 * br, 0); p.rot('chest', rx(.05 + .02 * br)); yaw(p, .16, .13 + .025 * br, .12); lids(p, 1); tufts(p, -.30); wings(p, .10 + .02 * br); [foot(p, s) for s in 'lr']; return p
a, b = 0, .12                                                  # the perch settles until she sits on her feet, and not a hair under the ground
for _ in range(16):
    DROP = (a + b) / 2; l = min(low(perch(.0)), low(sleep(.75)), low(perch(1 / 4))); a, b = (DROP, b) if l > -.0005 else (a, DROP)
DROP = a; ST.clear(); print('perch drop', DROP)
clips, T, R = {}, {}, {}
for n, fn, k, t in (('idle', idle, 70, 7.5), ('walk', hop, HOP['n'], 2 * HOP['reach'] * H / HOP['duty'] / HOP['v']), ('run', fly, FLY['n'], FLY['T']), ('glide', glide, 16, 3.2), ('sit', perch, 46, 6.), ('lie', sleep, 20, 4.2)):
    ST.clear(); clips[n] = wrap(fn, k); T[n] = t; R[n] = max(ST) if ST else None
path = os.path.join(HERE, '../athowl-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F'])), height_m=H)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 110; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; ef = [P.verts('eyes', g) for g in gl]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(min(x[:, 1].min(), y[:, 1].min()) for x, y in zip(fr, ef)) * H, 4))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    i = int(np.argmax([x.max() for x in s])); k = int(s[i].argmax()); vv = E[ok][k][0]; d['worst_edge_at'] = [P.names[JJ[vv][ww[vv].argmax()]], *np.round(pos[vv], 2).tolist()]
    if R[c]: d['leg_reach_ratio_max'] = round(float(R[c]), 2)
    if c == 'walk':
        so = np.array([i for i in range(len(pos)) if pos[i, 1] < .03 and (ww[i] * np.isin(JJ[i], [P.names.index('foot_l'), P.names.index('foot_r')])).sum() > .99]); k = [i for i in range(N) if i / N < HOP['duty'] * .999]
        A = np.array([fr[i][so] for i in k]) * H; A[:, :, 2] += (HOP['v'] * T[c] * np.array(k) / N)[:, None]; d['planted_foot_drift_max_m'] = round(float(np.linalg.norm((A - A[0])[:, :, [0, 2]], axis=2).max()), 4); d['planted_verts'] = len(so)
    if c in ('walk', 'run'): v = dict(walk=HOP, run=FLY)[c]['v']; d['stride_m'] = round(v * T[c], 3); d['plays_1to1_at_mps'] = v; d['cadence_at_mps'] = {str(q): round(q / (v * T[c]), 2) for q in (.55, 1.15, 1.92, 2.8, 4.2, 6.5)}
    d['span_m'], d['length_m'], d['top_m'] = [round(float(max(f(x) for x in fr)) * H, 3) for f in (lambda x: np.ptp(x[:, 0]), lambda x: np.ptp(x[:, 2]), lambda x: x[:, 1].max())]; M[c] = d
json.dump(M, open(os.path.join(HERE, '../athowl-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
