"""Noctyx rig + clips on rigcore (M132 s1).   python rig.py  -> ../noctyx-rigged.glb + ../noctyx-metrics.json
The mesh stands with its wings open; fold() wraps them round it as the cloak (each wing bone is laid on an ellipse round the body).
Clips: idle (cloak, ear twitch, cloak shift), walk (hop), run (= FLY), glide, sit, lie (= SLEEP), hang (upside down from a perch at HY)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt as S
from rigcore import Pose, rx, ry, rz
H = .45; TAU = 2 * np.pi; sm = K.smooth; HY = 1.10; mir = np.diag([-1., 1, 1])
SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', (0, .17, -.01)), 'chest': ('pelvis', (0, .30, -.02)), 'neck': ('chest', (0, .405, -.01)), 'head': ('neck', (0, .455, 0)), 'lids': ('head', (0, .56, .1))}
WB = ['arm1', 'arm2'] + ['f%d%s' % (i, c) for i in (1, 2, 3) for c in 'ab']
for s, x in (('l', 1), ('r', -1)):
    m_ = lambda v: tuple(np.array(v, float) * (x, 1, 1))
    SK |= {'ear_' + s: ('head', m_((.19, .68, -.02))), 'hand_' + s: ('chest', m_((.118, .352, .022))), 'leg_' + s: ('pelvis', m_((.098, .165, -.005))), 'shin_' + s: ('leg_' + s, m_((.096, .105, .028))), 'foot_' + s: ('shin_' + s, m_((.092, .050, .012)))}
    SK |= {'arm1_' + s: ('chest', m_(S.ARM[0])), 'arm2_' + s: ('arm1_' + s, m_(S.ARM[1]))}
    for i, f in enumerate(S.FIN): SK |= {'f%da_%s' % (i + 1, s): ('arm2_' + s, m_(f[0])), 'f%db_%s' % (i + 1, s): ('f%da_%s' % (i + 1, s), m_(f[1]))}
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(HERE, '../noctyx.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
inw = (S.wing(A0) < .008) & (A0[:, 0] > .108) & (np.abs(A0[:, 2] - S.ZW) < .036) & (S.ell(A0, (.085, .365, -.06), (.05, .045, .05)) > -.01)
arm = ~inw & (S.armb(A0) < .012) & (A0[:, 0] > .10) & (V0[:, 1] < .345) & (S.ell(A0, (0, .222, 0), (.154, .148, .130)) > .003)
hd = ~inw & ~arm & ((S.head(A0) < .010) & (V0[:, 1] > .395)); ear = hd & (S.ear(A0) < .008) & (A0[:, 0] > .165) & (V0[:, 1] > .60)
leg = ~inw & ~arm & (A0[:, 0] > .02) & (S.feet(A0) < .014) & (V0[:, 1] < .17) & (S.ell(A0, (0, .222, 0), (.154, .148, .130)) > -.02)
idg = lambda mask: (lambda V: mask)
B = [('pelvis', (0, .10, 0), (0, .22, 0), .2, idg(~inw & ~hd & ~arm)), ('chest', (0, .30, 0), (0, .40, 0), .18, idg(~inw & ~hd & ~arm)), ('neck', (0, .405, 0), (0, .44, 0), .06, idg(~inw & ~ear & ~arm)), ('head', (0, .52, 0), (0, .72, 0), .3, idg(hd & ~ear))]
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > .004; m_ = lambda v: np.array(v, float) * (x, 1, 1)
    B += [('ear_' + s, m_((.2, .68, 0)), m_((.404, 1, 0)), .2, idg(ear & sd)), ('hand_' + s, m_(S.ARMB[0]), m_(S.ARMB[2]), .05, idg(arm & sd)), ('leg_' + s, J('leg_' + s), J('shin_' + s), .07, idg(leg & sd)), ('shin_' + s, J('shin_' + s), J('foot_' + s), .06, idg(leg & sd & (V0[:, 1] < .12))), ('foot_' + s, m_((.092, .02, .0)), m_((.092, .02, .10)), .06, idg(leg & sd & (V0[:, 1] < .085)))]
    B += [('arm1_' + s, J('arm1_' + s), J('arm2_' + s), .05, idg(inw & sd))]
nm = [b[0] for b in B]; RIG = [(nm.index('foot_' + s), idg((V0[:, 1] < .045) & (V0[:, 0] * x > .01) & leg)) for s, x in (('l', 1), ('r', -1))]
w = K.skin_weights(V0, m['F'], B, 5, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
# wing: smooth inverse distance to the ribs and to the line where the membrane leaves the body
def sd_(q, a, b): e = b - a; t = np.clip(((q - a) @ e) / (e @ e), 0, 1); return np.linalg.norm(q - a - t[:, None] * e, axis=1)
Z2 = lambda v: np.array(v, float)[:2]
seg = [('arm1', S.ARM[0], S.ARM[1]), ('arm2', S.ARM[1], S.ARM[2])] + [('f%d%s' % (i + 1, c), f[k], f[k + 1]) for i, f in enumerate(S.FIN) for k, c in enumerate('ab')] + [('chest', (.095, .37), (.095, .30)), ('pelvis', (.095, .30), (.095, .21))]
for s, x in (('l', 1), ('r', -1)):
    k = np.where(inw & (V0[:, 0] * x > 0))[0]; q = A0[k, :2]; D = np.stack([sd_(q, Z2(a), Z2(b)) for _, a, b in seg], 1); D = np.maximum(D - .010, 0); I = 1 / (D + .006) ** 1.5
    W[k] = 0
    I = np.maximum(I - np.sort(I, 1)[:, -5:-4] * .999, 0)                                          # the fifth weight is taken off all, so keeping four never jumps
    for c, (n, _, _) in enumerate(seg): W[k, ix(n + '_' + s if n in WB else n)] = I[:, c]
W /= W.sum(1, keepdims=True)
# one smoothing pass at the wing's root so it leaves the back softly; a rib stays a rib
_, wl = np.unique(np.round(V0, 5), axis=0, return_inverse=True); wl = wl.ravel(); E0 = K.edges(wl[m['F']]); E0 = E0[E0[:, 0] != E0[:, 1]]; SW = np.zeros((wl.max() + 1, len(nb))); ct = np.zeros(len(SW)); np.add.at(SW, wl, W); np.add.at(ct, wl, 1); SW /= ct[:, None]
rt = np.zeros(len(SW), bool); rt[wl[(A0[:, 0] > .06) & (A0[:, 0] < .135) & (A0[:, 2] < -.03) & (A0[:, 1] < .46) & (A0[:, 1] > .16) & ~hd & ~leg]] = 1
for _ in range(3):
    N = SW.copy(); np.add.at(N, E0[:, 0], SW[E0[:, 1]]); np.add.at(N, E0[:, 1], SW[E0[:, 0]]); N /= N.sum(1, keepdims=True); SW[rt] = N[rt]
W = K.four(SW[wl]); parts = {'body': dict(m, W=W)}
eP = live['eyes']['POSITION']; e = np.zeros((len(eP), len(nb))); f = eP[:, 1] < .07; h_ = (np.abs(eP[:, 0]) > .17) & (eP[:, 1] < .22); lid = (eP[:, 2] < .13) & (eP[:, 1] > .48) & (np.abs(eP[:, 1] - S.EC[1]) < .064) & (np.abs(np.abs(eP[:, 0]) - S.EC[0]) < .063)
# the lids were laid LID behind: they are told from the eye by their colours
lc = np.array([(90, 77, 134), (40, 26, 62)]); lid = (np.abs(live['eyes']['COLOR_0'][:, None, :3].astype(int) - np.round(255 * (lc / 255.) ** 2.2).astype(int)[None]).max(-1).min(1) <= 1) & (eP[:, 1] > .48) & (eP[:, 1] < .63); print('lid verts', lid.sum())
e[:, ix('head')] = 1; e[lid] = 0; e[lid, ix('lids')] = 1
for s, x in (('l', 1), ('r', -1)):
    for k, b in ((f, 'foot_'), (h_, 'hand_')): k = k & (eP[:, 0] * x > 0); e[k] = 0; e[k, ix(b + s)] = 1
parts['eyes'] = dict(live['eyes'], W=e); VE = eP.astype(float)
SOLE = {s: np.vstack([V0[W[:, ix('foot_' + s)] > .5], VE[e[:, ix('foot_' + s)] > .5]]) - J('foot_' + s) for s in 'lr'}; ST = []
def low(p): return min(K.skin(V0, W, SK, p)[:, 1].min(), K.skin(VE, e, SK, p)[:, 1].min())
def foot(p, s, z=0, y=0, R=np.eye(3), G=None):
    j = J('foot_' + s); c = max(0, -j[1] - (SOLE[s] @ R.T)[:, 1].min()); t = np.array([j[0], j[1] + max(y, c), j[2] + z]); bd = np.array([.15 if s == 'l' else -.15, .1, 1.])
    if G is not None: t = G[0] @ t + G[1]; R = G[0] @ R; bd = G[0] @ bd
    ST.append(p.leg('leg_' + s, 'shin_' + s, 'foot_' + s, t, R, bend=bd, maxstretch=1.35))
# ── wings ──
EA, EB, EZ = .254, .236, -.005
def ring(phi, y, r=1.): return np.array([np.cos(phi) * EA * r, y, np.sin(phi) * EB * r + EZ])
def nrm(phi): n = np.array([np.cos(phi) / EA, 0, np.sin(phi) / EB]); return n / np.linalg.norm(n)
def frame(u, n): u = u / np.linalg.norm(u); n = n - (n @ u) * u; n /= np.linalg.norm(n); return np.stack([u, n, np.cross(u, n)], 1)
DEG = np.pi / 180
def fold(wrap=1., lift=0., r=1., drop=0.):
    """{bone: (local R, local T)} for the left wing laid round the body; wrap = how far round, lift = the collar raised, r = how close"""
    P = lambda d, y: ring(((d + 22) * wrap - 22) * DEG if d > -22 else d * DEG, y, r)
    tgt = dict(arm1=(S.ARM[0], P(-16, .385 + lift * .4)), arm2=(P(-16, .385 + lift * .4), P(30, .405 + lift)))
    wr = tgt['arm2'][1]; ds = {'arm1': -32, 'arm2': 8}
    for i, (d1, y1, d2, y2) in enumerate(((66, .325 + lift * .8, 97, .200), (52, .245, 74, .085), (24, .255, 26, .095))):
        a = P(d1, y1 - drop * .5); tgt['f%da' % (i + 1)] = (wr, a); tgt['f%db' % (i + 1)] = (a, P(d2, y2 - drop)); ds['f%da' % (i + 1)] = (30 + d1) / 2; ds['f%db' % (i + 1)] = (d1 + d2) / 2
    ends = dict(arm1=S.ARM[1], arm2=S.ARM[2]); [ends.__setitem__('f%d%s' % (i + 1, c), f[k + 1]) for i, f in enumerate(S.FIN) for k, c in enumerate('ab')]
    G = {}; out = {}
    for b in WB:
        j = J(b + '_l'); R = frame(tgt[b][1] - tgt[b][0], nrm(((ds[b] + 22) * wrap - 22) * DEG)) @ frame(ends[b] - j, np.array([0, 0, -1.])).T; G[b] = (R, np.array(tgt[b][0])); par = SK[b + '_l'][0][:-2]
        Rp, pp, jp = (np.eye(3), J('chest'), J('chest')) if par not in G else (*G[par], J(par + '_l')); out[b] = (Rp.T @ R, Rp.T @ (G[b][1] - pp) - (j - jp))
    return out
def openw(flap=0., tip=0., ext=0., pitch=0., sweep=0., spread=0.):
    """the open wing: flap up (+) about the body's long axis, tip = the outer joints' own bend, ext = drawn out, spread = fingers fanned"""
    out = {}
    for b in WB:
        R = rx(pitch) @ ry(flap) @ rz(sweep) if b == 'arm1' else ry(tip) if b in ('arm2', 'f1b', 'f2b', 'f3b') else rz(dict(f1a=.5, f2a=.1, f3a=-.25)[b] * spread) @ ry(tip * .6)
        par = SK[b + '_l'][0]; out[b] = (R, (J(b + '_l') - J(par)) * (ext if b != 'arm1' else 0))
    return out
def mix(a, b, k):
    o = {}
    for n in a:
        q, r = K.quat(a[n][0]), K.quat(b[n][0]); r = -r if q @ r < 0 else r; q = q * (1 - k) + r * k; o[n] = (K.mat(q), a[n][1] * (1 - k) + b[n][1] * k)
    return o
def wings(p, w, wr=None):
    for s, o in (('l', w), ('r', wr or w)):
        for b, (R, T) in o.items(): p.R[b + '_' + s], p.T[b + '_' + s] = (R, T) if s == 'l' else (mir @ R @ mir, mir @ T)
def lids(p, k): p.T['lids'] = np.array([0, 0, (S.LID + .015) * k])
def ears(p, l, r=None, tl=0, tr=0):
    """+ = out and down, t = turned"""
    r = l if r is None else r; p.rot('ear_l', rz(-l), ry(tl)); p.rot('ear_r', rz(r), ry(-tr))
def tuck(p, k=1.):
    p.R['hand_l'] = ry(-.35 * k) @ rz(-.36 * k) @ rx(-.50 * k) ; p.R['hand_r'] = mir @ p.R['hand_l'] @ mir
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
def idle(u):
    p = Pose(SK); br = np.sin(TAU * u * 3); p.T['chest'] = np.array([0, .003 * br, 0]); p.R['chest'] = rx(.010 * br); tuck(p)
    k = pulse(u, .40, .46, .50, .58); wings(p, mix(fold(1 - .10 * k, .012 * br * .3 + .02 * k, 1.0 + .012 * br + .04 * k), openw(.2, .1), .10 * k))
    tw = pulse(u, .12, .13, .135, .16) + pulse(u, .165, .175, .18, .205); tr = pulse(u, .68, .695, .70, .73)
    ears(p, .02 * br - .05 * tw, .02 * br + .20 * tr, .55 * tw, .45 * tr); p.rot('neck', ry(.30 * pulse(u, .24, .29, .36, .41) - .34 * pulse(u, .72, .77, .86, .91)), rz(.10 * pulse(u, .76, .80, .84, .89))); p.rot('head', ry(.25 * pulse(u, .24, .29, .36, .41) - .28 * pulse(u, .72, .77, .86, .91)), rx(.02 * br - .06 * k))
    lids(p, max(pulse(u, c, c + .012, c + .018, c + .036) for c in (.08, .43, .70))); [foot(p, s) for s in 'lr']; return p
HOP = dict(v=.55, duty=.27, reach=.070, n=18)
def hop(u):
    p = Pose(SK); d = HOP['duty']; r = HOP['reach']; st = u < d - 1e-9; k = u / d if st else (u - d) / (1 - d); air = 0 if st else np.sin(np.pi * k)
    y = -.030 * np.sin(np.pi * k) if st else .105 * 4 * k * (1 - k); lean = .12 + .09 * np.sin(TAU * (u - .10)); p.T['root'] = np.array([0, y, 0]); p.R['pelvis'] = rx(lean); p.rot('head', rx(-lean * .8)); tuck(p)
    wings(p, mix(fold(1 - .06 * air, .01, 1 + .05 * air), openw(.25 * air, .1), .26 * air)); ears(p, .06 + .16 * np.sin(TAU * (u - .30)))
    for s in 'lr':
        if st: foot(p, s, r * (1 - 2 * k))
        else: z = -r + 2 * r * sm(.10, .92, k); foot(p, s, z, y * .93 + .012 * air, rx(.5 * np.sin(np.pi * k) * (1 - k) * 1.6))
    return p
FLY = dict(v=2.8, n=18, T=.46, alt=.40, pitch=.95)
def flight(p, alt, pitch):
    p.T['root'] = np.array([0, alt, 0]); p.R['pelvis'] = rx(pitch); p.rot('neck', rx(-pitch * .42)); p.rot('head', rx(-pitch * .42)); tuck(p, .8)
    for s in 'lr': p.rot('leg_' + s, rx(.45)); p.rot('shin_' + s, rx(.15)); p.rot('foot_' + s, rx(.35))
def fly(u):
    p = Pose(SK); a = TAU * u; flight(p, FLY['alt'] - .035 * np.sin(a - .4), FLY['pitch'] + .05 * np.sin(a + .6))
    up = max(0, np.cos(a)); wings(p, openw(.10 + .68 * np.sin(a), .26 * np.sin(a - 1.1), .34 - .13 * up, .42 + .16 * np.cos(a), .10 - .14 * up, .55 - .35 * up)); ears(p, .22 + .05 * np.sin(a)); p.rot('chest', rx(.04 * np.sin(a))); return p
def glide(u):
    p = Pose(SK); a = TAU * u; flight(p, FLY['alt'] + .012 * np.sin(a), 1.0 + .03 * np.sin(a)); p.rot('pelvis', ry(.06 * np.sin(a))); wings(p, openw(.16 + .04 * np.sin(a + .6), -.06 + .03 * np.sin(a), .36, .10, .12, .6)); p.rot('head', rz(.10 * np.sin(a)), ry(.18 * np.sin(a))); ears(p, .25); return p
DROP = 0
def settle(p, br): p.T['root'] = np.array([0, -DROP + .0015 * br, 0]); p.R['pelvis'] = rx(-.06); p.R['chest'] = rx(.07 + .010 * br); tuck(p)
def sit(u):
    p = Pose(SK); br = np.sin(TAU * u * 3); settle(p, br); wings(p, fold(1.0, .015 + .006 * br, 1.02 + .010 * br, -DROP * .9)); a = -.45 * pulse(u, .20, .26, .40, .46) + .5 * pulse(u, .56, .62, .76, .82); p.rot('neck', ry(a * .5)); p.rot('head', ry(a * .5), rz(.14 * pulse(u, .60, .66, .72, .80)))
    ears(p, .05 + .02 * br, None, .5 * pulse(u, .10, .115, .12, .15), .5 * pulse(u, .50, .515, .52, .55)); lids(p, max(pulse(u, c, c + .016, c + .022, c + .045) for c in (.16, .52, .90))); [foot(p, s) for s in 'lr']; return p
def sleep(u):
    p = Pose(SK); br = np.sin(TAU * u); settle(p, 1.6 * br); wings(p, fold(1.05, .050 + .006 * br, 1.03 + .012 * br, -DROP * .9)); p.rot('chest', rx(.06 + .015 * br)); p.rot('neck', rx(.10)); p.rot('head', rx(.10 + .02 * br), rz(.10)); lids(p, 1); ears(p, .24 + .02 * br, .28 + .02 * br, .3, .3); [foot(p, s) for s in 'lr']; return p
def hang(u):
    """the perch is the plane y = HY; she hangs by her feet under it, cloak shut, and wakes to look once"""
    p = Pose(SK); br = np.sin(TAU * u * 3); sw = np.sin(TAU * u); G = (rz(np.pi), np.array([0, HY, 0])); p.R['root'], p.T['root'] = G; wk = pulse(u, .50, .56, .80, .88)
    p.T['pelvis'] = np.array([0, .022, 0]); p.R['pelvis'] = rz(.05 * sw) @ rx(.04 * np.sin(TAU * u + .8)); p.rot('chest', rz(.02 * sw), rx(.02 * br)); tuck(p)
    wings(p, fold(1.04 - .03 * wk, .02 + .004 * br, 1.0 + .012 * br)); p.rot('neck', rx(.06 + .06 * wk), ry(.22 * pulse(u, .56, .60, .66, .70) - .22 * pulse(u, .68, .72, .76, .80))); p.rot('head', rz(.04 * sw), ry(.25 * pulse(u, .56, .60, .66, .70) - .25 * pulse(u, .68, .72, .76, .80))); ears(p, .10 - .06 * wk + .02 * sw, None, .5 * pulse(u, .28, .292, .30, .33) + .4 * pulse(u, .60, .61, .62, .65), .5 * pulse(u, .47, .482, .49, .52))
    lids(p, 1 - wk * (1 - pulse(u, .66, .672, .678, .70))); [foot(p, s, G=G) for s in 'lr']; return p
a, b = 0, .09                                                   # sits down until she is on her feet, and not a hair under the ground
for _ in range(12):
    DROP = (a + b) / 2; l = min(low(sit(.0)), low(sleep(.75)), low(sit(1 / 4))); a, b = (DROP, b) if l > -.0005 else (a, DROP)
DROP = a; ST.clear(); print('sit drop', DROP)
clips, T, R = {}, {}, {}
for n, fn, k, t in (('idle', idle, 46, 7.2), ('walk', hop, HOP['n'], 2 * HOP['reach'] * H / HOP['duty'] / HOP['v']), ('run', fly, FLY['n'], FLY['T']), ('glide', glide, 10, 3.2), ('sit', sit, 30, 6.), ('lie', sleep, 12, 4.4), ('hang', hang, 36, 8.)):
    ST.clear(); clips[n] = wrap(fn, k); T[n] = t; R[n] = max(ST) if ST else None
path = os.path.join(HERE, '../noctyx-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F'])), height_m=H, hang_perch_m=round(HY * H, 3))
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
json.dump(M, open(os.path.join(HERE, '../noctyx-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
