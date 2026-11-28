"""M244 sheet 9: the GROUND BIPED rig for Luminix's four awakened forms: python rig_lumix.py <form> -> ../<form>-rigged.glb + ../<form>-metrics.json
Sheet 7's rig_lumore.py (Luminore's break-out: two-bone LEGS + ARMS on the egg's ground rig, the HIPS carry her height solved every frame so
her lowest point sits on the ground, the ROOT never moves) pointed at sculpt_lumix.py, plus one change from sheet 7's doubts: what lies on
the ground (the broken shell / the wave) rides a GROUND bone (child of the root at y = 0) that folds to 0.02 while she walks or runs, so it
is not dragged along with her: it lies where she hatched in idle / sit / lie. Colours mapped to 'root' (Lumixis's splash) stay in every clip.
20 bones: root, ground, hips, abd, chest, neck, head, lids, lids_r, arm / farm + leg / shin a side, + one m_<bone> per motif carrier."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, HERE)
FORM = sys.argv[1]; os.environ['LUMIX_FORM'] = FORM
import sculpt_lumix as F; S = F.S
import lum_common as C, rigcore as K
from rigcore import Pose, rx, ry, rz
from scipy.spatial import cKDTree
UNIT = .30 / .8725; TAU = 2 * np.pi; sm = K.smooth
DIAL = dict(lumixok=2.1, marisse=1.95, lumixis=2.0, lumixeth=1.95)[FORM]   # taller than Luminore's (1.75-1.8): she read small by the keeper
D = os.path.join(HERE, '..'); GLB_IN, GLB_OUT, MET_OUT = (os.path.join(D, f'{FORM}{x}') for x in ('.glb', '-rigged.glb', '-metrics.json'))
live = K.Glb(GLB_IN).meshes(); m = live['body']; V = m['POSITION'].astype(float); A = np.c_[np.abs(V[:, 0]), V[:, 1:]]
eP = live['eyes']['POSITION'].astype(float); lP = live['lamp']['POSITION'].astype(float); aP = live['aura']['POSITION'].astype(float)
LONG = float(np.ptp(np.concatenate([V[:, 2], lP[:, 2]]))); Y0 = float(V[:, 1].min()); UP = np.array([0, -Y0, 0])   # her feet on the ground
EL, ENL = S.eye_normal(); DH = S.HC - C.HC0; HC = np.array(S.HC)
SK = {'root': (None, (0, 0, 0)), 'hips': ('root', (0, .10, .02)), 'abd': ('hips', tuple(S.AC)), 'chest': ('hips', (0, .47, .05)),
      'neck': ('chest', tuple(DH * .5 + (0, .55, .09))), 'head': ('neck', tuple(HC - (0, .02, .02))), 'lids': ('head', tuple(EL)), 'lids_r': ('head', tuple(EL * (-1, 1, 1)))}
for s, x in (('l', 1), ('r', -1)):
    X = np.array((x, 1, 1)); SK['arm_' + s] = ('chest', tuple(S.SHO * X)); SK['farm_' + s] = ('arm_' + s, tuple(S.ELB * X))
    SK['leg_' + s] = ('hips', tuple(S.HIP * X)); SK['shin_' + s] = ('leg_' + s, tuple(S.KNEE * X))
SK['ground'] = ('root', (0, 0, 0))   # what lies on the ground (folds away while she walks / runs)
MB = sorted(set(S.AURA_BONE.values()) - {'root'})
for b in MB: SK['m_' + b] = (b, SK[b][1])   # her motif rides its own child bone, so the lie can fold it away (scale)
SK = {b: (p, tuple(np.array(j) + (UP if p else 0))) for b, (p, j) in SK.items()}   # the root stays AT the ground (y = 0)
nb = list(SK); ix = nb.index; V0 = V + UP; U = lambda *v: np.array(v, float) + UP
# ── regions: which field term each vertex is nearest (mirrored), arms split at the elbow, legs at the knee ──
AB, HD, TX, AR, LG = S.abdomen(A), S.head(A), S.thorax(A), S.arms(A), S.legs(A); mn = np.min([AB, HD, TX, AR, LG], 0); isp = lambda d: d <= mn + 1e-9
def past(P0, P1, Q):   # projection parameter of Q along P0 -> P1 (mirrored x)
    d = P1 - P0; return ((Q - P0) @ d) / (d @ d)
arm = isp(AR) & (A[:, 1] < S.SHO[1] + .10); leg = isp(LG) & ~arm & (A[:, 1] < S.HIP[1] + .06)
fore = arm & (past(S.SHO, S.ELB, A) > .85); shin = leg & (past(S.HIP, S.KNEE, A) > .85)
hed = isp(HD) & ~arm & (V[:, 1] > HC[1] - .12); abd = isp(AB) & ~arm & ~leg & ~hed; thx = ~(arm | leg | hed | abd)
g_ = lambda k: (lambda v: k)
B = [('abd', U(*(S.AC + S.AX * .20)), U(*(S.AC - S.AX * .22)), .30, g_(abd)), ('hips', U(0, .02, .02), U(0, .16, .02), .20, g_(abd | (leg & ~shin))),
     ('chest', U(0, .44, .03), U(0, .52, .07), .20, g_(thx | (arm & ~fore))), ('neck', U(*(DH * .5 + (0, .54, .09))), U(*(DH * .5 + (0, .57, .12))), .14, g_(thx | hed)),
     ('head', U(*(HC - (0, .02, .02))), U(*(HC + (0, .08, .02))), .25, g_(hed))]
for s, x in (('l', 1), ('r', -1)):
    X = np.array((x, 1, 1)); side = V[:, 0] * x > 0
    B += [('arm_' + s, U(*(S.SHO * X)), U(*(S.ELB * X)), .08, g_(arm & side)), ('farm_' + s, U(*(S.ELB * X)), U(*(S.HND * X * 1.05)), .09, g_(fore & side)),
          ('leg_' + s, U(*(S.HIP * X)), U(*(S.KNEE * X)), .10, g_(leg & side)), ('shin_' + s, U(*(S.KNEE * X)), U(*(S.TOE * X)), .10, g_(shin & side))]
w = K.skin_weights(V0, m['F'], B, 6); W = np.zeros((len(V0), len(nb)))
for i, b in enumerate(B): W[:, ix(b[0])] += w[:, i]
W = K.four(W)
eC = live['eyes']['COLOR_0'][:, :3].astype(int); lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
isc = lambda *cs: np.min([np.abs(eC - lin(c)).max(1) for c in cs], 0) <= 1
lid = isc(tuple(S.HEADC), S.SEAMLIN) & (np.linalg.norm(np.c_[np.abs(eP[:, 0]), eP[:, 1:]] - EL, axis=1) < .085)   # the WHOLE lid cap (the egg's y gate moved only its top: a crescent)
e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1
for s, sg in (('lids', 1), ('lids_r', -1)): k = lid & (eP[:, 0] * sg > 0); e[k] = 0; e[k, ix(s)] = 1
dk = isc(*S.DECO); e[dk] = W[cKDTree(V).query(eP[dk])[1]]; print('lid verts', int(lid.sum()), 'deco verts', int(dk.sum()))
la = np.zeros((len(lP), len(nb))); la[:, ix('abd')] = 1
aC = live['aura']['COLOR_0'][:, :3].astype(int); aw = np.zeros((len(aP), len(nb))); aw[:, ix(S.AURA_DEFAULT)] = 1; aw[:len(lP)] = la   # the lamp copy first
for col, bn in S.AURA_BONE.items():
    k = np.abs(aC - lin(col)).max(1) <= 1; aw[k] = 0; aw[k, ix(bn if bn == 'root' else 'm_' + bn)] = 1; print('aura', bn, int(k.sum()))
print('aura on the ground (ground bone)', int((aw[:, ix('ground')] > .5).sum()), '(root)', int((aw[:, ix('root')] > .5).sum()))
parts = {'body': dict(m, POSITION=V0.astype(np.float32), W=W), 'eyes': dict(live['eyes'], POSITION=(eP + UP).astype(np.float32), W=K.four(e)),
         'lamp': dict(live['lamp'], POSITION=(lP + UP).astype(np.float32), W=la), 'aura': dict(live['aura'], POSITION=(aP + UP).astype(np.float32), W=aw)}
PV = {p: (parts[p]['POSITION'].astype(float), parts[p]['W']) for p in parts}
GROUNDED = (aw[:, ix('root')] + aw[:, ix('ground')]) > .5
# ── motion ──
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
blink = lambda u, *cs: max(pulse(u, c, c + .024, c + .026, c + .050) for c in cs)
SHUT = getattr(S, 'LID_SHUT', False)
def lids(p, k):
    k = 1. if SHUT else k; p.T['lids'] = ENL * S.LID * k; p.T['lids_r'] = ENL * (-1, 1, 1) * S.LID * k
def ground(p):
    """the HIPS carry her: her lowest point (all but the shell on the root) put on the ground, every frame"""
    for b in MB: p.S.setdefault('m_' + b, 1.00002)
    p.S.setdefault('ground', 1.00002)   # every clip carries a scale track for the motif bones (none stays folded after the lie)
    for _ in range(3):
        X = {q: K.skin(PV[q][0], PV[q][1], SK, p) for q in PV}
        lo = min(X['body'][:, 1].min(), X['eyes'][:, 1].min(), X['lamp'][:, 1].min(), X['aura'][~GROUNDED, 1].min() if (~GROUNDED).any() else 9.)
        if abs(lo) < 2e-4: break
        p.T['hips'] = p.T['hips'] + (0, -lo, 0)
    return p
def limbs(p, ll, lr, al, ar, kl=0., kr=0., el=0., er=0.):
    """leg swing (rad, + = foot back), knee bend, arm swing (+ = hand back), elbow bend (- = forearm forward)"""
    p.R['leg_l'] = rx(ll); p.R['leg_r'] = rx(lr); p.R['shin_l'] = rx(kl); p.R['shin_r'] = rx(kr)
    p.R['arm_l'] = p.R['arm_l'] @ rx(al); p.R['arm_r'] = p.R['arm_r'] @ rx(ar); p.R['farm_l'] = rx(el); p.R['farm_r'] = rx(er)
LEGL = float(S.HIP[1] - S.TOE[1] + .04)
GAIT = dict(walk=dict(T=.64, a=.34, k=.55, arm=.30, lean=.05, rock=.06), run=dict(T=.44, a=.58, k=1.0, arm=.65, lean=.20, rock=.04))
for g in GAIT.values(): g['s'] = LEGL * np.sin(g['a']); g['v'] = round(4 * g['s'] * UNIT / g['T'], 4)   # body covers 4 x the foot's half sweep a cycle
FX = dict(lumixok=dict(arm_out=.12, head=-.05), marisse=dict(arm_out=.0, head=-.06), lumixis=dict(arm_out=0., head=.0), lumixeth=dict(arm_out=.05, head=.04))[FORM]
def base(p):
    p.rot('head', rx(FX['head']))
    if FX['arm_out']: p.R['arm_l'] = rz(FX['arm_out']); p.R['arm_r'] = rz(-FX['arm_out'])
def idle(u):
    p = Pose(SK); t = TAU * u; base(p); p.T['chest'] = np.array([0, .006 * np.sin(2 * t), 0]); p.rot('abd', rx(.02 * np.sin(2 * t - .8)))
    lk = pulse(u, .10, .16, .30, .36) - pulse(u, .55, .61, .76, .82)
    if FORM == 'lumixok':     # a wide angry stance, fists flexing, chest heaving, glaring round
        p.R['hips'] = rz(.03 * np.sin(t)); p.rot('neck', ry(.12 * lk)); f = .10 * np.sin(2 * t) ** 2
        limbs(p, -.05, -.05, -.10 - f, -.10 - f, .05, .05, -.35 - f, -.35 - f); p.R['leg_l'] = p.R['leg_l'] @ rz(.10); p.R['leg_r'] = p.R['leg_r'] @ rz(-.10)
    elif FORM == 'marisse':   # her flippers out, one waving, a happy sway and a little bounce
        r = .18 * np.sin(2 * t); p.R['arm_l'] = rz(.10 + r); p.R['arm_r'] = rz(-.05 + .04 * np.sin(t)); p.R['hips'] = rz(.05 * np.sin(t)); p.rot('head', rz(.07 * np.sin(t)))
        limbs(p, 0, 0, 0, 0, .02, .02, 0, 0); p.T['chest'] = p.T['chest'] + (0, .008 * abs(np.sin(2 * t)), 0)
    elif FORM == 'lumixis':   # ready to bolt: leaned in, bouncing on her toes, looking ahead
        p.R['hips'] = rx(.10); p.rot('head', rx(-.10), ry(.10 * lk)); b = .03 * np.sin(2 * t)
        limbs(p, -.18 + b, .14 - b, .25, -.25, .30, .10, -.6, -.6)
    else:                     # drifting: a slow sway as if in a current, flippers paddling softly
        p.R['hips'] = rz(.04 * np.sin(t)) @ rx(.02 * np.sin(2 * t)); p.rot('head', rz(-.05 * np.sin(t))); a = .08 * np.sin(2 * t)
        limbs(p, 0, 0, a, -a, 0, 0, -.10, -.10)
    lids(p, blink(u, .07, .47, .90)); return ground(p)
def gait(u, g):
    p = Pose(SK); t = TAU * u; base(p); sn, cs = np.sin(t), np.cos(t)
    ll, lr = -g['a'] * sn, g['a'] * sn                                           # left leg forward on the first half
    kl, kr = g['k'] * max(0., cs) ** 1.5, g['k'] * max(0., -cs) ** 1.5           # the knee bends while that foot swings forward
    p.R['hips'] = rx(g['lean']) @ rz(g['rock'] * sn) @ ry(.06 * sn); p.rot('head', rx(-.6 * g['lean']), rz(-.5 * g['rock'] * sn))
    el = -.25 - .5 * g['lean']
    limbs(p, ll, lr, -g['arm'] * lr / g['a'], -g['arm'] * ll / g['a'], kl, kr, el, el)
    if FORM == 'marisse': p.R['arm_l'] = rz(.10) @ p.R['arm_l']; p.R['arm_r'] = rz(-.10) @ p.R['arm_r']
    p.S['ground'] = .02   # she walks away from the shell / wave: it is not dragged along
    lids(p, 0); p = ground(p); p.T['hips'] = p.T['hips'] + (0, .0015, 0); return p   # a hair up: between the keys the gait dips ~1-2 mm
walk = lambda u: gait(u, GAIT['walk'])
run = lambda u: gait(u, GAIT['run'])
def sit(u):
    p = Pose(SK); t = TAU * u; base(p); p.R['hips'] = rx(-.12 + .012 * np.sin(2 * t)); p.T['chest'] = np.array([0, .006 * np.sin(2 * t), 0])
    lk = pulse(u, .55, .62, .78, .85); p.rot('head', ry(.16 * lk))
    limbs(p, -1.35, -1.35, -.15, -.15, .25, .25, -.40, -.40); p.R['leg_l'] = p.R['leg_l'] @ rz(.15); p.R['leg_r'] = p.R['leg_r'] @ rz(-.15)
    if FORM == 'lumixeth': p.S.update({'m_' + b: .45 for b in MB})   # seated, her tendrils draw up (full length they would hold her off the ground)
    lids(p, blink(u, .35, .92)); return ground(p)
LIE_SIDE = dict(lumixok=1, marisse=-1, lumixis=-1, lumixeth=1)[FORM]   # which side she lies on
LIE_FRONT = False
def sleep(u):
    p = Pose(SK); t = TAU * u; p.S.update({'m_' + b: .02 for b in MB});   # asleep, her motif folds away
    p.R['hips'] = (rx(1.40) if LIE_FRONT else rz(LIE_SIDE * 1.40)) @ rx(.05 * np.sin(t) - .10); p.T['chest'] = np.array([0, .005 * np.sin(t), 0])
    p.rot('head', rx(.20 + .02 * np.sin(t))); limbs(p, -.55, -.35, -.30, -.10, .70, .60, -.80, -.60); lids(p, 1); return ground(p)
clips, T = {}, {}
for c, fn, k, t in (('idle', idle, 120, 2.6), ('walk', walk, 36, GAIT['walk']['T']), ('run', run, 30, GAIT['run']['T']), ('sit', sit, 60, 3.0), ('lie', sleep, 44, 4.4)): clips[c] = wrap(fn, k); T[c] = t
K.write(GLB_OUT, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
P = K.Player(GLB_OUT); F_ = P.m['body']['F']
M = dict(form=FORM, ground=True, biped=True, dial=DIAL, bones=len(nb), glb_bytes=os.path.getsize(GLB_OUT), tris=dict(body=len(F_), eyes=len(P.m['eyes']['F']), lamp=len(P.m['lamp']['F']), aura=len(P.m['aura']['F'])),
         unit_m=round(UNIT, 4), glb_long=round(LONG, 4))
E = K.edges(F_); pos = P.m['body']['POSITION']; l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); okE = l0 > .006
lo3, hi3 = np.full(3, 9.), np.full(3, -9.); alow = 9.; ahigh = -9.
for c in clips:
    N = 120; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; al = [np.vstack([x] + [P.verts(q, g) for q in ('eyes', 'lamp', 'aura')]) for x, g in zip(fr, gl)]
    d = dict(dur_s=round(T[c], 3), lowest_glb=round(min(x[:, 1].min() for x in al), 4), body_lowest_glb=round(min(x[:, 1].min() for x in fr), 4), max_lowest_glb=round(max(x[:, 1].min() for x in al), 4),
             top_glb=round(max(x[:, 1].max() for x in al), 3))
    s = [np.linalg.norm(x[E[okE, 0]] - x[E[okE, 1]], axis=1) / l0[okE] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    if c in GAIT: d['plays_1to1_at_mps'] = GAIT[c]['v']; d['stride_glb'] = round(4 * GAIT[c]['s'], 3)
    M[c] = d
    for X in al[::2]: lo3 = np.minimum(lo3, X.min(0)); hi3 = np.maximum(hi3, X.max(0))
    alow = min(alow, d['lowest_glb']); ahigh = max(ahigh, d['max_lowest_glb'])
M['body_mean_top'] = round(float(np.mean([np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 120))[:, 1]) for k in range(120)])), 3)
M['all_lowest_with_aura_glb'] = round(float(alow), 4); M['all_max_lowest_glb'] = round(float(ahigh), 4)
ctr = (lo3 + hi3) / 2; M['cull'] = dict(c=[round(float(x), 2) for x in ctr], r=round(float(np.linalg.norm(hi3 - ctr)) + .12, 2), min=[round(float(x) - .12, 2) for x in lo3], max=[round(float(x) + .12, 2) for x in hi3])
json.dump(M, open(MET_OUT, 'w'), indent=1); [print(k, v) for k, v in M.items() if k in ('glb_long', 'body_mean_top', 'all_lowest_with_aura_glb', 'all_max_lowest_glb', 'cull', 'walk', 'run', 'lie', 'sit', 'idle')]
