"""BETA M244 sheet 1: the four awakened Vulnara forms' own skeletons, off rig_vulnara.py (the M132 quadruped plan, same 24 bones,
same clips), every joint placed from sculpt_awaken.py's landmarks for that form; her 'aura' part (echoes / spirals / halo) rides
the root (Vulnarok's + Vulnavex's echoes stand where they are) or the head (Vulnalys's spirals, Vulnamyr's halo).
    uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python rig_awaken.py <form> <in.glb> <out-rigged.glb> <metrics.json>
The sit height is SOLVED per form (rump just down) as well as the brush lift.
M244 sheet 2 (Vulnarc's): celle / arcvex / ceth here (kor = rig_biped.py). Arcvex's two ice-white copies run as Vulnavex's do;
Vulnarceth's cloud + discs ride their own 'cloud' bone under the root that cancels the root's motion, so the cloud stays on the ground."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
import numpy as np, rigcore as K
sys.path.insert(0, HERE); import sculpt_awaken as SV
FORM = SV.FORM; ARGS = sys.argv[2:]; IN, OUT, MET = [os.path.abspath(x) for x in ARGS[:3]]
G = SV.G; HO = np.array(G['HO']); vh = lambda p: tuple(float(c) for c in SV.fwd(np.array(p) + HO))   # Vulnara's head space -> world (the grown head, M244 s1c)
f_, h_ = G['f'], G['h']; T0 = np.array(SV.L['tail'][0]); v = lambda *a: tuple(float(x) for x in np.array(a[0]) + (np.array(a[1]) if len(a) > 1 else 0))
FZ = .10 if FORM == 'rok' else .02; TZ = dict(rok=-.27, lys=-.31, vex=-.33, myr=-.25, celle=-.31, arcvex=-.33, ceth=-.25, raya=-.31, noris=-.33, norun=-.25)[FORM]
shellfree = lambda V, m=.012: np.ones(len(V), bool)        # no carapace: every vertex is free
from plans import quadruped as Q
from rigcore import Pose
PV, CH = np.array(G['pelvis']) + (0, 0, .02), np.array(G['chest']) + (0, .01, -.04)
H = .70; SK = {'root': (None, (0, 0, 0)), 'pelvis': ('root', v(PV)), 'spine': ('pelvis', v((PV + CH) / 2)), 'chest': ('spine', v(CH)), 'neck': ('chest', v(G['neck'][0], (0, .02, 0))), 'head': ('neck', vh((0, .53, .22)))}
for s, x in (('l', 1), ('r', -1)):
    X = lambda p, y=None: (x * p[0], p[1] if y is None else y, p[2])
    SK |= {'ear_' + s: ('head', vh((x * .135, .68, .22))), 'f%s_up' % s: ('chest', X(f_[0])), 'f%s_lo' % s: ('f%s_up' % s, X(f_[1])), 'f%s_paw' % s: ('f%s_lo' % s, X(f_[2], .050)),
           'h%s_up' % s: ('pelvis', X(h_[0])), 'h%s_lo' % s: ('h%s_up' % s, X(h_[1])), 'h%s_paw' % s: ('h%s_lo' % s, X(h_[3], .050))}
TP = [tuple(SV.L['tail'][i]) for i in (0, 2, 4, 6, 8)]
for i in range(4): SK['tail%d' % (i + 1)] = ('tail%d' % i if i else 'pelvis', TP[i])
# M244 s1c (Alex 11-27): Vulnamyr's EIGHT tails, each its own chain of three bones (tail_<k>_1..3, off the pelvis) on its own lofted
# piece; tail1-4 stay as an unweighted centre line (spirit-fx reads b_tail2 / b_tail4). Each tail sways on its own beat.
TJ = (0, 8, 16)                                                    # joints at these points of the tail's dense centre line (25 points)
if FORM == 'myr':
    for k, c in enumerate(SV.TCK):
        for i, j in enumerate(TJ): SK['tail_%d_%d' % (k, i + 1)] = ('tail_%d_%d' % (k, i) if i else 'pelvis', tuple(float(x) for x in c[j, :3]))
def upper_bolts(part, y0):
    """M244 s2 (prod check: Vulnarkor's sit -41 mm, Vulnarcelle's lie -70 mm): keep only the bolts (aura pieces) whose rest centre is
    above y0, so none of them swings into the ground when her chest / head drops in the sit or the lie"""
    from scipy.sparse import coo_matrix; from scipy.sparse.csgraph import connected_components
    V, F = part['POSITION'], part['F']; E = np.r_[F[:, [0, 1]], F[:, [1, 2]]]
    _, cc = connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(V),) * 2))
    keep = np.array([V[cc == c, 1].mean() > y0 for c in range(cc.max() + 1)])[cc]; idx = np.cumsum(keep) - 1
    fk = keep[F].all(1); out = {k: (v[keep] if hasattr(v, '__len__') and len(v) == len(V) else v) for k, v in part.items() if k != 'F'}
    out['F'] = idx[F[fk]]; print('bolts kept', int((np.bincount(cc[keep]) > 0).sum()), 'of', cc.max() + 1); return out
def TAILV(V): return (SV.tail(V) < .010) & (np.abs(SV.field(V)) > .002)   # myr: a vertex of one of the lofted tail pieces (not the body's)
J = lambda b: SK[b][1]; tailgeo = lambda V: (V[:, 2] < TZ - .6 * np.clip(T0[1] - .15 - V[:, 1], 0, .5)) & shellfree(V) & ((np.abs(V[:, 0]) < .075) | (V[:, 1] > T0[1] - .09) | (V[:, 2] < TZ - .085)); body = lambda V: ~tail(V) & ((V[:, 1] < CH[1] + .14) | ~shellfree(V)); hd = lambda V: (V[:, 1] > G['neck'][0][1] - .03) & (V[:, 2] > .10 + HO[2] * .5) & shellfree(V)
jp = lambda b: np.array(J(b))
B = [('pelvis', v(jp('pelvis'), (0, 0, -.05)), v(jp('pelvis') + (jp('spine') - jp('pelvis')) * .5), .12, body), ('spine', J('spine'), v(jp('spine') + (jp('chest') - jp('spine')) * .5), .11, body), ('chest', v(jp('chest'), (0, -.01, .01)), v(jp('chest') + (jp('neck') - jp('chest')) * .8), .12, body), ('neck', v(jp('neck'), (0, -.01, .01)), v(jp('neck') + (jp('head') - jp('neck')) * .7), .11, lambda V: (V[:, 2] > 0) & shellfree(V)), ('head', vh((0, .57, .2)), vh((0, .6, .3)), .2 * SV.HK, hd)]
for s, x in (('l', 1), ('r', -1)):
    side = lambda V, x=x: V[:, 0] * x > .006; fore = lambda V, x=x: (V[:, 0] * x > .006) & (V[:, 2] > FZ) & (V[:, 1] < f_[0][1] + .02) & shellfree(V); hind = lambda V, x=x: (V[:, 0] * x > .006) & (V[:, 2] < FZ - .02) & ~tail(V) & (V[:, 1] < h_[0][1] + .055) & shellfree(V)
    Xs = lambda p, d=(0, 0, 0), x=x: (x * (p[0] + d[0]), p[1] + d[1], p[2] + d[2]); fu = np.array(f_[0]) + (np.array(f_[1]) - np.array(f_[0])) * .4; hu = np.array(h_[0]) + (np.array(h_[1]) - np.array(h_[0])) * .2
    B += [('ear_' + s, vh((x * .142, .72, .212)), vh((x * SV.S.EAR_T[0], SV.S.EAR_T[1], SV.S.EAR_T[2])), .11 * SV.HK, lambda V, x=x: (V[:, 1] > vh((0, .66, 0))[1]) & (V[:, 0] * x > .03) & (V[:, 2] > .10 + HO[2]) & shellfree(V)),
          ('f%s_up' % s, Xs(fu), J('f%s_lo' % s), .070 * G['fr'][0] / .066, fore), ('f%s_lo' % s, J('f%s_lo' % s), J('f%s_paw' % s), .056 * G['fr'][1] / .040, fore), ('f%s_paw' % s, Xs(f_[2], (0, -.018, 0)), Xs(f_[2], (0, -.028, .07)), .058 * G['paw'], fore),
          ('h%s_up' % s, Xs(hu), J('h%s_lo' % s), .085 * G['hr'][0] / .080, hind), ('h%s_lo' % s, J('h%s_lo' % s), Xs(h_[2], (0, -.015, .01)), .058, hind), ('h%s_paw' % s, Xs(h_[3], (0, -.012, 0)), Xs(h_[3], (0, -.022, .08)), .058, hind)]
tail = TAILV if FORM == 'myr' else tailgeo
B += [('tail%d' % (i + 1), TP[i], TP[i + 1], .13, tail) for i in range(4)] if FORM != 'myr' else []
nb = list(SK); nm = [b[0] for b in B]
RIG = [(nm.index(a + s + '_paw'), (lambda V, x=x, a=a: (V[:, 1] < .06) & (V[:, 0] * x > 0) & ((V[:, 2] > FZ) == (a == 'f')))) for a in 'fh' for s, x in (('l', 1), ('r', -1))]
TAU = 2 * np.pi; sm = K.smooth
D = dict(pitch=0, neck=.5, tail=['tail1', 'tail2', 'tail3', 'tail4'], idletail=[0, 0, 0, 0], idlelift=[0, 0, 0, 0], drop={}, stance={p + s: (x * w, z) for s, x in (('l', 1), ('r', -1)) for p, w, z in (('f', f_[2][0], f_[2][2]), ('h', h_[3][0], h_[3][2] + .012))})
LIFT0 = .006 if FORM in ('arcvex', 'noris') else 0.   # sheet 2: Arcvex + her scaled copies grazed the ground 1.5-4 mm in the walk / run
WALK = dict(v=.55, duty=.625, reach=.14, lift=.05, toe=.5, phase=dict(hl=0, fl=.75, hr=.5, fr=.25), beats=2, bob0=.4, bob=.007, dy=-.034 + LIFT0, n=24, over=.25)
if FORM in ('arcvex', 'noris'): WALK['plant'] = .004   # sheet 2: her stance soles sat 1.7 mm under in the walk
# the gallop: a low chest and a spine that opens and closes buy the reach, short contacts buy the air. Stride 1.21 m
RUN = dict(plant=.006 if FORM in ('arcvex', 'noris') else .002,   # sheet 2: Arcvex's copies grazed 1.5 mm in the run (prod check)
            v=2.8, duty=.2, reach=.173, lift=.085, toe=.8, phase=dict(hl=0, hr=.925, fl=.5, fr=.425), beats=1, n=40, over=.06)
live = K.Glb(IN).meshes(); parts = {}; m = live['body']; V0 = m['POSITION'].astype(float)
w = K.skin_weights(V0, m['F'], B, 7, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
if FORM == 'myr':   # each tail vertex rides its own tail's chain by how far along it lies (blend at the joints, the root into the pelvis)
    from scipy.sparse import coo_matrix; from scipy.sparse.csgraph import connected_components   # a tail = one lofted PIECE (its mesh component)
    _, wv = np.unique(np.round(V0, 5), axis=0, return_inverse=True); wv = wv.ravel(); Ew = K.edges(wv[m['F']])
    _, comp = connected_components(coo_matrix((np.ones(len(Ew)), (Ew[:, 0], Ew[:, 1])), shape=(wv.max() + 1,) * 2)); comp = comp[wv]
    TV = TAILV(V0); near = np.argmin(np.stack([SV.tail_k(V0, k) for k in range(8)], 1), 1); big = np.bincount(comp).argmax()
    CK = {c: int(np.bincount(near[(comp == c) & TV], minlength=8).argmax()) for c in np.unique(comp[TV]) if c != big}
    TV = np.isin(comp, list(CK)); X = V0[TV]; kk = np.array([CK[c] for c in comp[TV]]); assert sorted(set(CK.values())) == list(range(8)), CK; TIDX = np.zeros(len(V0)); TK = np.full(len(V0), -1)
    W[TV] = 0
    for r, (x, k) in zip(np.flatnonzero(TV), zip(X, kk)):
        c = SV.TCK[k]; j = float(np.argmin(np.linalg.norm(c[:, :3] - x, axis=1))); TIDX[r], TK[r] = j, k
        b = ['pelvis'] + ['tail_%d_%d' % (k, i) for i in (1, 2, 3)]; at = [-2, 1.5, 8, 16]   # each bone's weight peaks past its joint
        for i in range(4):
            lo_, hi_ = (at[i - 1] if i else -9), (at[i + 1] if i < 3 else 99); wv = np.interp(j, [lo_, at[i], hi_], [0, 1, 1 if i == 3 else 0])
            W[r, nb.index(b[i])] += max(wv, 0)
        W[r] /= W[r].sum()
W = K.four(W)
if SV.EARTH: W = SV.rigid_extras(V0, m['F'], W)   # sheet 3: crystals / stones / trunk / blooms ride rigid
parts['body'] = dict(m, W=W); e = np.zeros((len(live['eyes']['POSITION']), len(nb))); e[:, nb.index('head')] = 1; parts['eyes'] = dict(live['eyes'], W=e)
if FORM == 'ceth': SK['cloud'] = ('root', (0, 0, 0)); nb = list(SK); W = np.c_[W, np.zeros(len(W))]; parts['body'] = dict(m, W=W); parts['eyes'] = dict(live['eyes'], W=np.c_[e, np.zeros(len(e))])
if 'aura' in live and FORM not in ('vex', 'arcvex', 'noris'): a = np.zeros((len(live['aura']['POSITION']), len(nb))); a[:, nb.index('head' if FORM in ('lys', 'myr', 'celle', 'raya') else 'cloud' if FORM == 'ceth' else 'spine' if FORM == 'norun' else 'root')] = 1; parts['aura'] = dict(live['aura'], W=a)
if FORM == 'celle': parts['aura'] = upper_bolts(parts['aura'], SV.MC[1] - .02)
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
        if u < g['duty'] - 1e-9: st.append(setleg(p, f, g['reach'] * (1 - 2 * u / g['duty']), g.get('plant', 0))); continue
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
        p.T['root'] = np.array([0, -.059 + LIFT0 + .012 * air, .012 * -cl])   # 3 mm higher than rig_v2: drawn 1.4x, her paws grazed the ground; p.R['pelvis'] = rx(.02 + .07 * rock + .09 * cl)
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
    st = [setleg(p, f, -.035, 0) for f in ('fl', 'fr')] + [setleg(p, f, .165, 0, x=SITX * (1 if f == 'hl' else -1), bend=(.35 if f == 'hl' else -.35, .9, .7)) for f in ('hl', 'hr')]
    sw = .05 * np.sin(TAU * u); side = (.30 + sw * .2, .26 + sw * .6, .22 + sw, .10 + sw) if FORM != 'myr' else (sw * .2, sw * .3, sw * .3, sw * .3)   # M244 s1b: Myr's fan stays behind her, not swung round
    tail(p, [SITT[0], SITT[1], SITT[2], SITT[3] + .04 * np.sin(TAU * u * 2)], 0, 0, side); return max(st)
def liepose(br):
    p = Pose(SK); p.T['root'] = np.array([0, LIEY + .002 * br, 0]); p.R['pelvis'] = rx(.0); p.rot('spine', rx(-.06)); p.rot('chest', rx(-.05)); p.rot('neck', rx(.06)); p.rot('head', rx(.04)); return p
def liepost(p, u):
    st = [setleg(p, f, .205, 0, x=.112 * s, bend=(s * .9, .5, -.6)) for f, s in (('fl', 1), ('fr', -1))] + [setleg(p, f, .14, 0, x=.172 * s, bend=(s * .7, .9, .4)) for f, s in (('hl', 1), ('hr', -1))]
    sw = .04 * np.sin(TAU * u); tail(p, [LIET, -.10, -.30, -.28 + .03 * np.sin(TAU * u * 2)], 0, 0, (.40 + sw * .2, .55 + sw * .5, .55 + sw, .45 + sw)); return max(st)
POST = dict(sit=sitpost, lie=liepost)
# numbers the ground decides: solved, not guessed (rump / belly / brush just touch)
def solve(f, a, b):
    for _ in range(22):
        c = (a + b) / 2; a, b = (a, c) if f(c) > 0 else (c, b)
    return b
SITX = .185 if FORM == 'lys' else .17 if FORM in ('celle', 'raya') else .150; SITA = .88; SITY = -.03; SITT = [0, -.12, -.05, 0]; LIEY = -.2; LIET = 0
RUMP = W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5
def _sy(v): global SITY; SITY = v; p = sitpose(0); sitpost(p, 0); return low(p, RUMP) - .006
SITY = solve(_sy, -.45, .25)
if FORM in ('myr', 'lys', 'celle', 'ceth', 'raya', 'norun'):   # M244 s1b (+ s1c the dire-wolf Lys): her haunch (hr_up) sat 28 mm under the ground once the fan cleared: nothing but the paws may be lower
    NOPAW = (W[:, [nb.index(b) for b in nb if b.endswith('_paw')]].sum(1) < .3) & (W[:, [nb.index(b) for b in nb if b.startswith('tail')]].sum(1) < .5)   # s1c: tails clear on their own
    def _sy2(v): global SITY; SITY = v; p = sitpose(0); sitpost(p, 0); return low(p, NOPAW) - .002
    s0 = SITY; SITY = max(s0, solve(_sy2, -.45, .25))
FANM = W[:, [nb.index(b) for b in D['tail']]].sum(1) > (.02 if FORM == 'myr' else .5)   # M244 s1b: every vertex the fan moves, not only the tail-heavy ones (Myr sat 317 mm into the ground)
def _st(v): global SITT; SITT = [v, -.12, -.05, 0]; return min(low((lambda p: (sitpost(p, u), p)[1])(sitpose(0)), FANM) for u in (0, .25, .5, .75)) - .010
if FORM != 'myr': _st(solve(_st, -.3, 2.6))   # myr: the fan's clearance is not monotone in the lift: take the best
BODY = W[:, [nb.index(b) for b in ('pelvis', 'spine', 'chest')]].sum(1) > .6
def _ly(v): global LIEY; LIEY = v; p = liepose(-1); liepost(p, 0); return low(p, BODY) - .008
LIEY = solve(_ly, -.50, 0)
def _lt(v): global LIET; LIET = v; return min(low((lambda p: (liepost(p, u), p)[1])(liepose(-1)), TB) for u in (.25, .75)) - .010
_lt(solve(_lt, -.6, 1.6)) if FORM != 'myr' else None; p = sitpose(0); sitpost(p, 0); print('rump', low(p, W[:, [nb.index('pelvis'), nb.index('spine')]].sum(1) > .5)); print('solved', SITY, SITT, LIEY, LIET)
clips, T, st = {}, {}, {}
for n, g, fn in (('walk', WALK, walk), ('run', RUN, run)): T[n] = 2 * g['reach'] * H / g['duty'] / g['v']; clips[n], st[n] = fn(g)
clips['idle'] = Q.idle(SK, D, 48); T['idle'] = 4.8; clips['sit'], st['sit'] = rest('sit', 48, sitpose); T['sit'] = 5.; clips['lie'], st['lie'] = rest('lie', 48, liepose); T['lie'] = 5.6
SK0 = SK
if FORM == 'myr':   # M244 s1c: the eight tails' own motion over every clip, then each clip's lift SOLVED off the mesh
    TVM = TK >= 0; HEADV = W[:, nb.index('head')] > .5; TIPV = TVM & (TIDX >= 23)
    CYC = dict(idle=(2, 3, 4), walk=(1, 1, 1), run=(1, 1, 1), sit=(2, 3, 4), lie=(2, 3, 2))
    TARGET = dict(idle=0., walk=0., run=-.15, sit=None, lie=None)   # None: the lowest lift that clears (tails laid low behind her)
    def tails(p, c, f, lift):
        for k in range(8):
            cy = CYC[c][k % 3]; ph = k * 2.39; amp = .10 + .035 * (k % 3); sway = lambda i: amp * (.5 + .35 * i) * np.sin(TAU * (cy * f) + ph - i * .8)
            for i in range(3): p.rot('tail_%d_%d' % (k, i + 1), rx((lift if i == 0 else 0) + .035 * np.sin(TAU * (cy * f) + ph * 1.7 - i * .6)), K.ry(sway(i)))
    def fits(c, lift, frames):
        n = len(frames) - 1; lows, ok = [], True
        for i in range(0, n, max(1, n // 12)):
            p = Pose(SK); p.R = {b: frames[i].R[b].copy() for b in SK}; p.T = {b: frames[i].T[b].copy() for b in SK}; tails(p, c, i / n, lift)
            X = K.skin(V0[TVM], W[TVM], SK, p); lows.append(X[:, 1].min())
            if c == 'sit':
                tip = K.skin(V0[TIPV], W[TIPV], SK, p); top = K.skin(V0[HEADV], W[HEADV], SK, p)[:, 1].max()
                ok &= bool(tip[:, 1].max() <= top - .02) and bool(tip[:, 2].max() <= p.glob('pelvis')[1][2])   # below her head, behind her rump
        return min(lows), ok
    LIFT = {}
    for c in clips:
        grid = np.linspace(-.8, 1.8, 53); res = [(g, *fits(c, g, clips[c])) for g in grid]; good = [g for g, lo_, ok in res if lo_ >= .012 and ok]
        LIFT[c] = (min(good, key=lambda g: abs(g - TARGET[c])) if TARGET[c] is not None else min(good)) if good else max(res, key=lambda r: r[1])[0]
        n = len(clips[c]) - 1
        for i, p in enumerate(clips[c]): tails(p, c, (i % n) / n, LIFT[c])
    print('tail lifts', {c: round(float(v), 3) for c, v in LIFT.items()})
if FORM == 'ceth':   # sheet 2: the cloud bone undoes the root's motion every frame (the root drops her into the lie)
    for c in clips:
        for p in clips[c]: p.T['cloud'] = -np.asarray(p.T['root'], float)
if FORM in ('vex', 'arcvex', 'noris'):   # M244 s1b (Alex 11-27): her two gold copies RUN: each plays her run a beat behind, left where she just ran (drifting back
    import echoes as E   # at her own run speed, 4 glb/s), and shrinks away (the fade; the glow material is opaque); hidden when she is not running
    def trail(k):
        def mv(c, u):
            if c != 'run': return 0., 0.
            q = (u + k * .5) % 1; return -.20 - (RUN['v'] / H) * T['run'] * q, sm(0, .08, q) * (1 - q) ** .8
        return mv
    SPECS = [dict(off=(-.16, 0, 0), s=.92, delay=.12, move=trail(0)), dict(off=(-.30, 0, 0), s=.84, delay=.30, move=trail(1))]
    if FORM in ('arcvex', 'noris'): SPECS = [dict(sp, off=(sp['off'][0], .008, 0)) for sp in SPECS]   # sheet 2: her copies 8 mm up (grazed 1.5-4 mm in the run)
    SK2, aura = E.build(SK, V0, m['F'], W, nb, SPECS, **(dict(color=(205, 238, 255)) if FORM == 'arcvex' else dict(color=(246, 220, 140)) if FORM == 'noris' else {}))
    for k in ('body', 'eyes'): parts[k] = dict(parts[k], W=E.pad(parts[k]['W'], nb, SK2))
    parts['aura'] = aura; clips = E.clips(SK, SK2, clips, SPECS); SK = SK2
path = OUT; K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
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
json.dump(M, open(MET, 'w'), indent=1); print(json.dumps(M))
