"""BETA M244 s1b: VULNAROK on the FIRST BIPED RIG (plans/biped.py in rig-2026-11-24/tools), her four gold self-echoes rebuilt as
rigged copies (echoes.py) that play her clip a beat behind her, each from her own place. The worked example of the biped plan:
landmarks from sculpt_awaken.py's rok entry -> skeleton(); skin capsules + gates for the mesh; Plan(...).clips(); echoes; write; metrics.
    uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python rig_biped.py <in.glb> <out-rigged.glb> <metrics.json>
M244 sheet 2: AWAKEN=kor rigs VULNARKOR (Vulnarc's Champion) on the same plan: no echoes, her lightning ('aura') rides her chest."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.dont_write_bytecode = True
BF = os.environ.get('AWAKEN', 'rok'); assert BF in ('rok', 'kor', 'oreth'), BF
sys.argv = [sys.argv[0], BF, *sys.argv[1:]]
import numpy as np, rigcore as K
sys.path.insert(0, HERE); import sculpt_awaken as SV, echoes as E
from plans import biped as B
IN, OUT, MET = [os.path.abspath(x) for x in sys.argv[2:5]]
def upper_bolts(part, y0):
    """M244 s2 (prod check: Vulnarkor's sit -41 mm, Vulnarcelle's lie -70 mm): keep only the bolts (aura pieces) whose rest centre is
    above y0, so none of them swings into the ground when her chest / head drops in the sit or the lie"""
    from scipy.sparse import coo_matrix; from scipy.sparse.csgraph import connected_components
    V, F = part['POSITION'], part['F']; E = np.r_[F[:, [0, 1]], F[:, [1, 2]]]
    _, cc = connected_components(coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(len(V),) * 2))
    keep = np.array([V[cc == c, 1].mean() > y0 for c in range(cc.max() + 1)])[cc]; idx = np.cumsum(keep) - 1
    fk = keep[F].all(1); out = {k: (v[keep] if hasattr(v, '__len__') and len(v) == len(V) else v) for k, v in part.items() if k != 'F'}
    out['F'] = idx[F[fk]]; print('bolts kept', int((np.bincount(cc[keep]) > 0).sum()), 'of', cc.max() + 1); return out

G = SV.G; HO = np.array(G['HO']); A, Lg = G['arm'], G['leg']; H = .70
TP = [tuple(SV.L['tail'][i]) for i in (0, 2, 4, 6, 8)]
SK = B.skeleton(dict(pelvis=G['pelvis'], spine=(0, .78, -.045), chest=(0, .93, -.01), neck=(0, 1.0, .02), head=tuple(np.array((0, .53, .22)) + HO),
                     ear=tuple(np.array((.135, .68, .22)) + HO), arm=A[:3], leg=Lg, tail=TP))
nb = list(SK); J = {b: np.array(j) for b, (_, j) in SK.items()}
live = K.Glb(IN).meshes(); m = live['body']; V0 = m['POSITION'].astype(float)
# ── gates: which vertices each capsule may take ──
ax = lambda V: np.abs(V[:, 0])
tail = lambda V: (V[:, 2] < -.20) & (V[:, 1] < .70) | (V[:, 2] < -.34)
arm = lambda V: (ax(V) > .168) & (V[:, 1] > .40) & (V[:, 1] < 1.07) & ~tail(V) & ~((V[:, 1] < .74) & (ax(V) < .205) & (V[:, 2] < .02))
leg = lambda V: (V[:, 1] < .70) & ~tail(V) & ~arm(V)
head = lambda V: (V[:, 1] > 1.04) & (V[:, 2] > -.06)
if SV.PROP.get(BF):   # v2 PROP re-fit: the wide stance + big gauntlets overlap in x, and the pauldrons rise past 1.07: a vertex is arm when it is
    # nearer the arm chain than the thigh chain (up to the pauldron top), the head keeps to the middle (the pauldrons stay off the head bone)
    def _segd(V, pts):
        M = np.c_[ax(V), V[:, 1], V[:, 2]]; d = np.full(len(V), 9.)
        for p0, p1 in zip(pts[:-1], pts[1:]):
            p0, p1 = np.array(p0), np.array(p1); ab = p1 - p0; t = np.clip(((M - p0) @ ab) / (ab @ ab), 0, 1); d = np.minimum(d, np.linalg.norm(M - p0 - t[:, None] * ab, axis=1))
        return d
    PTOP = 1.07 + .12 * (SV.PQ('shoulder') - 1) / .45
    arm = lambda V: (ax(V) > .168) & (V[:, 1] > .40) & (V[:, 1] < PTOP) & ~tail(V) & (_segd(V, A) < _segd(V, Lg[:3]))
    leg = lambda V: (V[:, 1] < .70) & ~tail(V) & ~arm(V)
    head = lambda V: (V[:, 1] > 1.04) & (V[:, 2] > -.06) & (ax(V) < .19)
trunk = lambda V: ~tail(V) & ~arm(V) & (V[:, 1] > .48)
CAPS = [('pelvis', (0, .52, -.06), (0, .70, -.06), .15, trunk), ('spine', (0, .70, -.05), (0, .85, -.03), .15, trunk), ('chest', (0, .85, -.02), (0, 1.0, 0), .17, trunk),
        ('neck', J['neck'], J['head'], .11, lambda V: (V[:, 1] > .96) & ~arm(V)), ('head', tuple(np.array((0, .57, .2)) + HO), tuple(np.array((0, .6, .3)) + HO), .2, head)]
for s, x in B.SIDES:
    X = lambda p, x=x: np.array((x * p[0], p[1], p[2])); side = lambda V, x=x: V[:, 0] * x > .01
    CAPS += [('ear_' + s, tuple(np.array((x * .142, .72, .212)) + HO), tuple(np.array((x * SV.S.EAR_T[0], SV.S.EAR_T[1], SV.S.EAR_T[2])) + HO), .11, lambda V, x=x: (V[:, 1] > .66 + HO[1]) & (V[:, 0] * x > .03)),
             (f'arm_{s}_up', X(A[0]) * (.6, 1, 1) + X(A[1]) * (.4, 0, 0) + (0, 0, 0), X(A[1]), .085, lambda V, s=side: arm(V) & s(V)), (f'arm_{s}_lo', X(A[1]), X(A[2]), .075, lambda V, s=side: arm(V) & s(V)),
             (f'hand_{s}', X(A[2]), X(A[3]) + (0, -.07, .03), .065, lambda V, s=side: arm(V) & s(V)),
             (f'leg_{s}_up', X(Lg[0]), X(Lg[1]), .11, lambda V, s=side: leg(V) & s(V)), (f'leg_{s}_lo', X(Lg[1]), X(Lg[2]), .075, lambda V, s=side: leg(V) & s(V)),
             (f'leg_{s}_mt', X(Lg[2]), X(Lg[3]) + (0, .02, 0), .055, lambda V, s=side: leg(V) & s(V)), (f'leg_{s}_paw', X(Lg[3]) + (0, -.01, -.02), X(Lg[3]) + (0, -.02, .10), .06, lambda V, s=side: leg(V) & s(V))]
CAPS += [(f'tail{i + 1}', TP[i], TP[i + 1], .14, tail) for i in range(4)]
nm = [c[0] for c in CAPS]
RIG = [(nm.index(f'leg_{s}_paw'), (lambda V, x=x: (V[:, 1] < .055) & (V[:, 0] * x > 0) & ~tail(V))) for s, x in B.SIDES]
w = K.skin_weights(V0, m['F'], CAPS, 7, RIG); W = np.zeros((len(V0), len(nb)))
for i, n in enumerate(nm): W[:, nb.index(n)] += w[:, i]
W = K.four(W)
if SV.EARTH: W = SV.rigid_extras(V0, m['F'], W)   # sheet 3: Orethar's crystals ride rigid
bw = lambda names: W[:, [nb.index(b) for b in names]].sum(1)
TB = bw(['tail1', 'tail2', 'tail3', 'tail4']) > .5
MASKS = dict(tail=TB, rump=bw(['pelvis']) > .5, belly=bw(['pelvis', 'spine', 'chest']) > .5, free=~TB & (bw(['leg_l_mt', 'leg_l_paw', 'leg_r_mt', 'leg_r_paw']) < .3))
low = lambda p, M: K.skin(V0[M], W[M], SK, p)[:, 1].min()
plan = B.Plan(SK, low=low, masks=MASKS)
C, T, ST, FEET, SOLVED = plan.clips(H); print('solved', SOLVED, 'reach', ST)
if SV.PROP.get(BF):   # v2: the plan solves the sit / lie at the breath's middle; with PROP's heavy thighs the breath's low (feet re-planted) dipped
    for c in ('sit', 'lie'):   # her crotch 15 mm under: lift each rest clip by its own measured deficit (every frame, the whole mesh)
        lo = min(K.skin(V0, W, SK, p)[:, 1].min() for p in C[c])
        if lo < .001:
            for p in C[c]: p.T['root'] = p.T['root'] + np.array([0, .001 - lo, 0])
            SOLVED[c]['v2_lift'] = round(float(.001 - lo), 4)
# ── the four echoes: where the sculpt stood them, each playing her clip a beat behind (left and right a beat apart) ──
SPECS = [dict(off=(-.50, 0, -.46), s=.80, delay=.10), dict(off=(.50, 0, -.46), s=.80, delay=.16), dict(off=(-.90, 0, -.80), s=.70, delay=.22), dict(off=(.90, 0, -.80), s=.70, delay=.28)]
if BF == 'rok':
    SK2, aura = E.build(SK, V0, m['F'], W, nb, SPECS); C2 = E.clips(SK, SK2, C, SPECS)
else:   # Vulnarkor: her crackling bolts ride her chest (sheet 3: Orethar's heart-gem too, whole)
    SK2, C2 = SK, C; aura = dict(live['aura'], W=np.zeros((len(live['aura']['POSITION']), len(nb)))); aura['W'][:, nb.index('chest')] = 1
    if BF == 'kor': aura = upper_bolts(aura, .86)
parts = {'body': dict(m, W=E.pad(W, nb, SK2))}
e = np.zeros((len(live['eyes']['POSITION']), len(SK2))); e[:, nb.index('head')] = 1; parts['eyes'] = dict(live['eyes'], W=e); parts['aura'] = aura
K.write(OUT, parts, SK2, C2, {c: (len(v) - 1) / T[c] for c, v in C2.items()})
# ── metrics: read the FILE back (three's way) ──
P = K.Player(OUT); pos = P.m['body']['POSITION']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']
Mt = dict(bones=len(nb), bones_with_echoes=len(SK2), glb_bytes=os.path.getsize(OUT), solved=SOLVED, legs=[b for b in nb if b.startswith('leg_')], arms=[b for b in nb if b.startswith(('arm_', 'hand_'))])
def bone_at(M, b): return (M[P.names.index(b)] @ np.r_[J[b] if b in J else np.array(SK2[b][1]), 1])[:3]
for c in C2:
    N = 60; d = dict(dur_s=round(T[c], 3)); lo, hi, ln = 9, 0, 0; fl, fr, eo = [], [], []
    for k in range(N):
        M = P.globals(c, T[c] * k / N); b = P.verts('body', M); ey = P.verts('eyes', M); lo = min(lo, b[:, 1].min()); hi += max(b[:, 1].max(), ey[:, 1].max()) / N; ln += (b[:, 2].max() - b[:, 2].min()) / N
        fl.append(bone_at(M, 'leg_l_paw')); fr.append(bone_at(M, 'leg_r_paw')); eo.append(bone_at(M, 'e0_head' if 'e0_head' in SK2 else 'head'))
    fl, fr, eo = np.array(fl), np.array(fr), np.array(eo)
    d |= dict(lowest_m=round(lo * H, 4), height_m=round(hi * H, 3), length_m=round(ln * H, 3), lead_l_minus_r_z=[round(float(x), 3) for x in (fl[:, 2] - fr[:, 2])[::10]],
              feet_alternate=bool((fl[:, 2] - fr[:, 2]).max() > .05 and (fl[:, 2] - fr[:, 2]).min() < -.05), echo0_head_travel=round(float(np.linalg.norm(eo - eo.mean(0), axis=1).max()), 3))
    if c in ST: d['leg_reach_ratio_max'] = round(float(ST[c]), 2)
    Mt[c] = d
json.dump(Mt, open(MET, 'w'), indent=1); print(json.dumps(Mt))
