"""M202 TIDEMERE CARRIES HER OWN WATER (Alex, Magii bcc8bb5, canon world/spirits-species.md: 'on land each glides on a thin sheet of water
that travels under it, leaving a wet trail that dries behind. In water they swim.'). Her own rig, replacing the base Shellmere's walking rig:
  python rig_tidemere.py  -> ../tidemere-rigged.glb + ../tidemere-metrics.json   (sculpt = m202-shellmere-line tools/sculpt_tidemere.py, unchanged)
14 bones: root, shell, neck, head, lids, tail and a FLIPPER + BLADE bone per flipper (flip0/blade0 fore, flip1/blade1 hind). NO leg, foot or
paw bones and no antennae (she has none). Her body RIDES HER WATER: in every clip the plastron sits CLEAR over her ground (the game draws the
sheet in that gap, spirit-water.ts) and no flipper vertex ever goes below FIN_FLOOR: the flippers stroke, they never step.
Clips under the game's names: idle (bobbing on her water, a slow scull, a look round, a blink), walk (a glide: both fore-flippers pull back
together, feathered forward on the recovery, the hind paddles kick in turn, a small surge on each pull), run (the same, quicker and wider),
sit (settles low onto her sheet, flippers spread flat on the water, head up), lie (asleep on her sheet: head drawn back, flippers tucked)."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
LINE = os.path.join(HERE, '../../m202-shellmere-line-2026-11-27')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), os.path.join(LINE, 'tools')): sys.path.insert(0, p)
import numpy as np, rigcore as K, sculpt_tidemere as F
from rigcore import Pose, rx, ry, rz
S = F.S; H = .464; TAU = 2 * np.pi; sm = K.smooth
CLEAR, CLEAR_SIT, FIN_FLOOR = .030, .016, .040          # glb units: plastron over the ground (the sheet's room); no flipper vertex below FIN_FLOOR
DH = S.HC - F.C.HC0
FORE, HIND = F.FORE, F.HIND
SK = {'root': (None, (0, 0, 0)), 'shell': ('root', (0, .30, -.05)), 'neck': ('shell', (0, .36, .22)), 'head': ('neck', tuple(DH + (0, .45, .42))),
      'lids': ('head', tuple(DH + (0, .50, .62))), 'tail': ('shell', (0, .23, -.43))}
FN = [(i, s) for i in range(2) for s in 'lr']; CH = (FORE, HIND)
for s, x in (('l', 1), ('r', -1)):
    X = np.array([x, 1, 1])
    for i in range(2): SK['flip%d_%s' % (i, s)] = ('shell', tuple(CH[i][0] * X)); SK['blade%d_%s' % (i, s)] = ('flip%d_%s' % (i, s), tuple(CH[i][1] * X))
J = lambda b: np.array(SK[b][1]); nb = list(SK); ix = nb.index
live = K.Glb(os.path.join(LINE, 'tidemere.glb')).meshes(); m = live['body']; V0 = m['POSITION'].astype(float); A0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]
SH, HD, NK, LG, TL = S.shell(A0), S.head(A0), S.neck(A0), S.legs(A0), S.tail(V0)
mn = np.min([SH, HD, NK, LG, TL], 0); isp = lambda d: d <= mn + 1e-9
fin = isp(LG) & (V0[:, 1] < .30); hed = isp(HD) & ~fin; nek = isp(NK) & ~fin & ~hed; tl = isp(TL) & ~fin; shl = ~(fin | hed | nek | tl)
g = lambda mask: (lambda V: mask)
B = [('shell', (0, .30, -.30), (0, .30, .20), .40, g(shl)), ('neck', (0, .36, .22), tuple(DH + (0, .44, .40)), .14, g(nek | hed)),
     ('head', tuple(DH + (0, .45, .45)), tuple(DH + (0, .50, .58)), .26, g(hed)), ('tail', J('tail'), (0, .15, -.70), .07, g(tl))]
FINV = {}
for s, x in (('l', 1), ('r', -1)):
    sd = V0[:, 0] * x > 0; X = np.array([x, 1, 1])
    for i in range(2):
        c = CH[i]; a, b, t = c[0] * X, c[1] * X, c[-1] * X; me = fin & sd & ((V0[:, 2] > -.05) if i == 0 else (V0[:, 2] <= -.05)); FINV[i, s] = me
        u = (V0 - a) @ (t - a) / np.sum((t - a) ** 2); bl = me & (u > .9 * np.linalg.norm(b - a) / np.linalg.norm(t - a))
        B += [('flip%d_%s' % (i, s), a, b, .10, g(me & ~bl)), ('blade%d_%s' % (i, s), b, t, .12, g(bl))]
nm = [b[0] for b in B]; w = K.skin_weights(V0, m['F'], B, 6); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, ix(n)] += w[:, i]
W = K.four(W); parts = {'body': dict(m, W=W)}
eP = live['eyes']['POSITION'].astype(float); eC = live['eyes']['COLOR_0'][:, :3].astype(int); isc = lambda *cs: np.min([np.abs(eC - np.round(255 * (np.array(c) / 255.) ** 2.2)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), (60, 92, 70)); from scipy.spatial import cKDTree
e = W[cKDTree(V0).query(eP)[1]].copy(); e[lid] = 0; e[lid, ix('lids')] = 1
parts['eyes'] = dict(live['eyes'], W=K.four(e)); print('lid verts', lid.sum(), 'fin verts', {k: int(v.sum()) for k, v in FINV.items()})
finW = W[:, [ix('flip%d_%s' % k) for k in FN] + [ix('blade%d_%s' % k) for k in FN]].sum(1) > .5; BODYV = ~finW
def low_body(p): return min(K.skin(V0[BODYV], W[BODYV], SK, p)[:, 1].min(), K.skin(eP, e, SK, p)[:, 1].min())
def low_fin(p, k=None):
    sel = FINV[k] if k else finW; return K.skin(V0[sel], W[sel], SK, p)[:, 1].min()
def lids(p, k): p.T['lids'] = np.array([0, 0, S.LID * k])
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .03, c + .035, c + .07) for c in cs)
def fin_pose(p, i, s, sweep, lift, feather, floor):
    """sweep (+ = the blade swept back), lift (+ = raised), feather (blade turned edge-on); then lifted further until no vertex of this
    flipper is under `floor`: a flipper strokes over her water, it never plants"""
    x = 1 if s == 'l' else -1; a = lift
    for _ in range(30):
        if i == 0: p.R['flip0_' + s] = ry(x * sweep) @ rz(x * a)
        else: p.R['flip1_' + s] = ry(-x * sweep) @ rx(a) @ rz(x * .25 * a)
        p.R['blade%d_%s' % (i, s)] = rx(feather) @ rz(x * .3 * a)
        if low_fin(p, (i, s)) >= floor: return
        a += .04
def settle(p, aim):
    """the plastron (not the flippers) rides `aim` over her ground"""
    p.T['shell'] = p.T['shell'] + np.array([0, aim - low_body(p), 0])     # the root bone stays ON her ground (the game measures from it)
def idle(u):
    """bobbing on her water, a slow scull of the fore-flippers, a long look round, a blink, a nod"""
    p = Pose(SK); bob = np.sin(TAU * u * 3); p.R['root'] = rz(.015 * np.sin(TAU * u * 2)) @ rx(.01 * bob)
    lk = pulse(u, .10, .20, .34, .44) - pulse(u, .50, .60, .70, .78); nd = pulse(u, .82, .87, .90, .95)
    p.rot('neck', ry(.16 * lk), rx(.10 * nd)); p.rot('head', ry(.28 * lk), rx(.16 * nd - .02 * bob), rz(.06 * lk)); lids(p, max(blink(u, .06, .47, .76), .55 * pulse(u, .84, .87, .90, .93)))
    p.rot('tail', ry(.15 * np.sin(TAU * u))); settle(p, CLEAR); p.T['shell'][1] += .006 * (1 + bob) / 2
    for i, s in FN: sc = np.sin(TAU * u * 6 + (0 if s == 'l' else .4) + i); fin_pose(p, i, s, .12 * sc, .14, .15 * sc, FIN_FLOOR)
    return p
def glide(u, amp, surge, hindamp):
    p = Pose(SK); a = TAU * u
    # fore: a pull (0 -> .55) both together, then a feathered recovery forward, raised
    pw = u < .55; q = u / .55 if pw else (u - .55) / .45; sw = (-amp + 2 * amp * sm(0, 1, q)) if pw else (amp - 2 * amp * sm(0, 1, q))
    lift = .14 + (0 if pw else .26 * np.sin(np.pi * q)); fe = (0 if pw else -.9 * np.sin(np.pi * q))
    p.T['root'] = np.array([0, 0, surge * np.sin(a - .6)]); p.R['root'] = rx(-.025 * np.sin(a))
    p.rot('neck', rx(.04 * np.sin(a + .8))); p.rot('head', rx(-.03 * np.sin(a + 1.2))); p.rot('tail', ry(.2 * np.sin(a - 1.2)))
    settle(p, CLEAR); p.T['shell'][1] += .004 * (1 + np.sin(2 * a)) / 2
    for s in 'lr': fin_pose(p, 0, s, sw, lift, fe, FIN_FLOOR)
    for s, o in (('l', 0), ('r', .5)): h = np.sin(TAU * (u - o)); fin_pose(p, 1, s, hindamp * h, .10 + .12 * max(0, h), .3 * h, FIN_FLOOR)
    return p
walk = lambda u: glide(u, .42, .012, .22)
run = lambda u: glide(u, .58, .022, .30)
def sit(u):
    """settles low onto her sheet: flippers spread flat on the water, head up, looking about"""
    p = Pose(SK); br = np.sin(TAU * u * 2); p.rot('shell', rx(.02))
    lk = pulse(u, .15, .25, .45, .55) - pulse(u, .60, .68, .82, .90); p.rot('neck', rx(-.18), ry(.15 * lk)); p.rot('head', rx(-.10 - .015 * br), ry(.25 * lk))
    lids(p, blink(u, .10, .58, .93)); p.rot('tail', ry(.1 * np.sin(TAU * u))); settle(p, CLEAR_SIT); p.T['shell'][1] += .002 * (1 + br) / 2
    for i, s in FN: fin_pose(p, i, s, (-.15, .10)[i], .22, .1, CLEAR_SIT + .008)
    return p
def lie(u):
    """asleep on her sheet: head drawn back into the rim with the chin down, flippers tucked back along the shell, lids shut"""
    p = Pose(SK); br = np.sin(TAU * u); p.rot('shell', rx(.02))
    p.T['neck'] = np.array([0, -.02, -.09]); p.rot('neck', rx(.30)); p.rot('head', rx(.12 + .01 * br), rz(.06)); lids(p, 1); p.rot('tail', ry(.4))
    settle(p, CLEAR_SIT); p.T['shell'][1] += .002 * (1 + br) / 2
    for i, s in FN: fin_pose(p, i, s, (.55, .35)[i], .20, .2, CLEAR_SIT + .008)
    return p
clips, T = {}, {}
CV = {'walk': .55 / .464, 'run': 1.9 / .464}                   # the base SHELLMERE_RIG clipV (glb units / s): one pull covers clipV x T
for n, fn, k, t in (('idle', idle, 48, 9.), ('walk', walk, 24, .60), ('run', run, 20, .30), ('sit', sit, 40, 7.), ('lie', lie, 20, 5.)):
    clips[n] = wrap(fn, k); T[n] = t
path = os.path.join(HERE, '../tidemere-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(path); pos = P.m['body']['POSITION']; Fc = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']
M = dict(bones=len(nb), bone_names=nb, glb_bytes=os.path.getsize(path), tris=dict(body=len(Fc), eyes=len(P.m['eyes']['F'])), height_m=H, clear=CLEAR, clear_sit=CLEAR_SIT, fin_floor=FIN_FLOOR)
E = K.edges(Fc); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
fj = [P.names.index(n) for n in P.names if 'flip' in n or 'blade' in n]; finP = (ww * np.isin(JJ, fj)).sum(1) > .5
for c in clips:
    N = 110; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g_) for g_ in gl]; ef = [P.verts('eyes', g_) for g_ in gl]
    d = dict(dur_s=round(T[c], 3), lowest_m=round(min(min(x[:, 1].min(), y[:, 1].min()) for x, y in zip(fr, ef)) * H, 4))
    d['body_low_min'], d['body_low_max'] = round(float(min(x[~finP, 1].min() for x in fr)), 4), round(float(max(x[~finP, 1].min() for x in fr)), 4)
    d['fin_low_min'] = round(float(min(x[finP, 1].min() for x in fr)), 4)
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    d['mean_top'] = round(float(np.mean([max(x[:, 1].max(), y[:, 1].max()) for x, y in zip(fr, ef)])), 3)
    if c in CV: d['stroke_m_at_base'] = round(CV[c] * T[c] * H, 3)
    d['span_m'], d['length_m'] = [round(float(max(f(x) for x in fr)) * H, 3) for f in (lambda x: np.ptp(x[:, 0]), lambda x: np.ptp(x[:, 2]))]; M[c] = d
tops = [np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 110))[:, 1]) for k in range(110)]; M['body_mean_top'] = round(float(np.mean(tops)), 3)
lens = [np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 110))[:, 2]) for k in range(0, 110, 10)]; M['glb_long'] = round(float(np.mean(lens)), 3)
json.dump(M, open(os.path.join(HERE, '../tidemere-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items() if k != 'bone_names']
