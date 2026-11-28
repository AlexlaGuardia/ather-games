"""M244 sheet 13: TIDEOWL's four AWAKENED forms (Tidowrok / Tidelle / Tidowsk / Tidowmyr), OWNER PREVIEW.
    TIDOWAW_FORM=<tidowrok|tidelle|tidowsk|tidowmyr> python sculpt_tidowaw.py <out.glb> [tris]
Canon: CANON/world/spirits-species.md 'Named, the Athowl line' ('Tideowl (Water): Tidowrok · Tidelle (Virtuoso, pure) · Tidowsk · Tidowmyr');
art LOCKED athernyx assets/stage3/073-076 (PRIVATE, read for shape + colour, never copied here). Built like sheets 8 + 10 (m244-mystowl /
m244-voltowl tools): each starts from the LIVE Tideowl (docs/looks/m202-athowl-redo-2026-11-27/tools/sculpt_tideowl.py, imported, never edited:
her sleek forward-leaning teardrop, long overlapping tail feathers, pale heart face, teal eyes, scaled wing feathers, the round WATER GEM on her
crown, grey legs + pale talons) and re-shapes her BY NAME. EVERY form keeps her water gem (her own decal; Tidelle + Tidowmyr also a glowing one).
Sheet 8's spread-wing cut (CWing) + sheet 10's pale wing-root strip fix are reused. The four grow ear tufts (all four locked arts have them).
Parts: body, eyes (unlit: eyes, lids, claws, gem), AURA = her motif (the look's glow part; each colour rides one bone, AURA_BONE;
'near' = skinned like the nearest body vertex; 'root' = rides the root, level under / round her whatever her body does)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-athowl-redo-2026-11-27/tools'))
FORM = os.environ['TIDOWAW_FORM']
import owl_common as C
import sculpt_tideowl as L
from owl_common import Wing, cone, ell, su, ss, V3, C8, yrot
from sculpt_v2 import normals
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
L.FORM = FORM; L.AURA = []; L.AURA_BONE = {}
base_head, base_classes, base_decals = L.head, L.classes, L.decals
RNG = np.random.default_rng(73)
FLOOR = .085     # no aura under this (glb): the perch / sleep drop the root ~.06 and the hop dips it .03, and nothing may go under the ground
FOAM, FOAM_HI, WAVE = (226, 250, 252), (246, 255, 255), (120, 214, 232)

# ── aura builders ──
def tube(Q, r0, r1, col, n=6):
    Q = np.asarray(Q, float); m = len(Q); T = np.gradient(Q, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True); rr = np.linspace(r0, r1, m) if np.ndim(r0) == 0 else np.asarray(r0); P = []
    for i in range(m):
        a = nz(np.cross(T[i], V3(0, 1, 0) if abs(T[i][1]) < .9 else V3(1, 0, 0))); b = np.cross(T[i], a)
        P += [Q[i] + rr[i] * (np.cos(q) * a + np.sin(q) * b) for q in np.arange(n) / n * 2 * np.pi]
    P = np.array(P + [Q[0], Q[-1]]); F = [f for i in range(m - 1) for j in range(n) for f in ((i * n + j, (i + 1) * n + j, (i + 1) * n + (j + 1) % n), (i * n + j, (i + 1) * n + (j + 1) % n, i * n + (j + 1) % n))]
    F += [(m * n, j, (j + 1) % n) for j in range(n)] + [(m * n + 1, (m - 1) * n + (j + 1) % n, (m - 1) * n + j) for j in range(n)]
    F = np.array(F); c = P[:m * n].reshape(m, n, 3).mean(1)
    if (np.cross(P[F[0][1]] - P[F[0][0]], P[F[0][2]] - P[F[0][0]]) @ (P[F[0][0]] - c[0])) < 0: F = F[:, ::-1]
    return P, F, col
def ribbon(Q, w, col, up=(0, 1, 0)):
    """a flat glowing ribbon along a path (both faces), width w (scalar or per point)"""
    Q = np.asarray(Q, float); m = len(Q); T = np.gradient(Q, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True); ww = np.full(m, w) if np.ndim(w) == 0 else np.asarray(w)
    S = np.cross(T, V3(*up)); S /= np.maximum(np.linalg.norm(S, axis=1, keepdims=True), 1e-9); P = np.vstack([Q + S * ww[:, None] / 2, Q - S * ww[:, None] / 2])
    F = np.array([f for i in range(m - 1) for f in ((i, m + i, m + i + 1), (i, m + i + 1, i + 1))]); return [(P, F, col), (P.copy(), F[:, ::-1], col)]
def sphere(c, r, col, nu=12, nv=8):
    r = np.broadcast_to(np.asarray(r, float), (3,)); P = [V3(0, -1, 0)]
    for j in range(1, nv):
        ph = -np.pi / 2 + np.pi * j / nv; P += [V3(np.cos(ph) * np.cos(t), np.sin(ph), np.cos(ph) * np.sin(t)) for t in np.arange(nu) / nu * 2 * np.pi]
    P.append(V3(0, 1, 0)); P = np.array(P); top = len(P) - 1; F = [(0, 1 + (i + 1) % nu, 1 + i) for i in range(nu)]
    for j in range(nv - 2):
        a, b = 1 + j * nu, 1 + (j + 1) * nu; F += [f for i in range(nu) for f in ((a + i, a + (i + 1) % nu, b + (i + 1) % nu), (a + i, b + (i + 1) % nu, b + i))]
    a = 1 + (nv - 2) * nu; F += [(a + i, a + (i + 1) % nu, top) for i in range(nu)]; F = np.array(F)
    if (np.cross(P[F[0][1]] - P[F[0][0]], P[F[0][2]] - P[F[0][0]]) @ P[F[0]].mean(0)) < 0: F = F[:, ::-1]
    return V3(*c) + P * r, F, col
def drop(tip, r, ln, col):
    """a falling water drop: a round belly with a point up (tip = the point)"""
    tip = V3(*tip); P, F, _ = sphere(tip - V3(0, ln, 0), r, col, 10, 7); P = P.copy(); up = P[:, 1] > tip[1] - ln
    P[up, 1] = tip[1] - ln + (P[up, 1] - (tip[1] - ln)) / r * ln; k = np.clip(1 - (P[up, 1] - (tip[1] - ln)) / ln, 0, 1) ** .8
    P[up, 0] = tip[0] + (P[up, 0] - tip[0]) * k; P[up, 2] = tip[2] + (P[up, 2] - tip[2]) * k; return P, F, col
def disc(c, r0, r1, col, n=64):
    """a flat ring (annulus) lying level, both faces"""
    t = np.arange(n) / n * 2 * np.pi; P = np.vstack([V3(*c) + np.c_[r * np.cos(t), 0 * t, r * np.sin(t)] for r in (r0, r1)])
    F = np.array([f for k in range(n) for f in ((k, n + (k + 1) % n, (k + 1) % n), (k, n + k, n + (k + 1) % n))]); return [(P, F, col), (P.copy(), F[:, ::-1], col)]
def torus_flat(c, R, r, col, nu=64, nv=6):
    u, v = np.meshgrid(np.arange(nu) / nu * 2 * np.pi, np.arange(nv) / nv * 2 * np.pi, indexing='ij'); u, v = u.ravel(), v.ravel()
    P = V3(*c) + np.c_[(R + r * np.cos(v)) * np.cos(u), r * np.sin(v), (R + r * np.cos(v)) * np.sin(u)]
    F = np.array([f for i in range(nu) for j in range(nv) for a, b, cc, d in [(i * nv + j, i * nv + (j + 1) % nv, ((i + 1) % nu) * nv + j, ((i + 1) % nu) * nv + (j + 1) % nv)] for f in ((a, cc, d), (a, d, b))])
    f0 = F[0]; out = P[f0[0]] - (V3(*c) + R * V3(np.cos(u[f0[0]]), 0, np.sin(u[f0[0]])))
    return P, (F if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ out > 0 else F[:, ::-1]), col
def crest(base, along, up, back, R, cols, nth=22):
    """a breaking WAVE: a sheet curling up off a line of base points and over toward 'back', its curl radius R per base point (both faces)"""
    ns = len(base); th = np.linspace(0, 1.45 * np.pi, nth); P = []
    for i in range(ns):
        r = R[i] * (1 - .32 * th / np.pi); P += [base[i] + r[k] * (np.sin(th[k]) * up + (1 - np.cos(th[k])) * back) for k in range(nth)]
    P = np.array(P); F = np.array([f for i in range(ns - 1) for k in range(nth - 1) for a, b, c_, d in [(i * nth + k, (i + 1) * nth + k, (i + 1) * nth + k + 1, i * nth + k + 1)] for f in ((a, b, c_), (a, c_, d))])
    return [(P, F, cols[0]), (P + up * .004, F[:, ::-1], cols[1])]
class CWing(Wing):
    """sheet 8: a SPREAD wing passes beside her head: the blade is cut back a clear gap from it (fused, the head's turn tore the wing)"""
    def blade(s, M, grow=0): return np.maximum(Wing.blade(s, M, grow), .040 - L.head(M) - grow)
L.CWing = CWing
L.HEADX = .30                   # rig_tidowaw: past this |x| nothing is head (Tideowl's head is .245 wide)
def classes(V, o):
    out = base_classes(V, o)
    if isinstance(L.WING, CWing):
        # sheet 10's PALE STRIP fix: no feather-row crescent / pale lip within .06 of the spread blade (Tideowl: classes 0 + 1 are the plumage pair)
        x, y, z = V.T; M = np.c_[np.abs(x), y, z]; near = L.WING.blade(M) < .06
        out[0] = np.where(near, -.05, out[0]); out[1] = np.where(near, -.05, out[1])
    return out
L.classes = classes
def add_aura(parts, bone):
    for P, F, col in parts:
        lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
        clash = [c for c, b in L.AURA_BONE.items() if b != bone and np.abs(lin(c) - lin(col)).max() <= 2]
        assert not clash, f'aura colour {col} ({bone}) is within 2 of {clash} ({L.AURA_BONE[clash[0]]}) in the stored colour: the rig picks the bone BY COLOUR'
        L.AURA.append((P, F, col)); L.AURA_BONE[tuple(col)] = bone
def spread(SH, TIP, ang, feath, cut, shoulder, up0, ymax, bounds, x0=.17, x1=.23, bow=.046, thick=(.052, .036)):
    L.WING = CWing(SH, TIP, ang, feath, bow=bow, thick=thick); L.WING_CUT = cut; L.SHOULDER = shoulder; L.WING_YMAX = ymax; L.BOUNDS = bounds
    L.LM = dict(L.LM, up0=up0, wing_x0=x0, wing_x1=x1)
def rxm(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
TUFT = ((.125, .835, .06), (.215, .995, -.005))
def tufted(head_fn, tuft=TUFT, r=(.056, .006), frown=False):
    """her head + a pair of pointed ear tufts (all four locked arts); frown = angled brow ridges over the eyes (Tidowrok)"""
    def head(M):
        d = su(head_fn(M), cone(M, tuft[0], tuft[1], *r), .03)
        if frown: d = su(d, cone(M, (.035, .788, .232), (.175, .832, .185), .022, .012), .02)
        return d
    L.LM = dict(L.LM, tuft=tuft, tuftmask=lambda A: (A[:, 0] > .12) & (A[:, 1] > .90))
    return head

# ── per form: silhouette + motif ──
if FORM == 'tidowrok':
    # CHAMPION: the heaviest; wings SPREAD WIDE and raised, a frowning brow, big dark talons; aura: a breaking WAVE cresting off each wing's
    # outer half, foam spray flying off the crests ('near': each crest rides its wing).
    L.DROP = ((0, .370, -.04), (.292, .292, .330), rxm(-.40))
    spread((.245, .530, -.020), (.930, .900, -.080), 1.45, [(.34, 0, .40, .175, 0), (.88, .070, .27, .060, 1), (.88, .005, .31, .066, 1), (.82, -.060, .32, .064, 1),
           (.72, -.120, .31, .058, 1), (.60, -.165, .27, .052, 1), (.48, -.195, .23, .046, 1), (.36, -.205, .18, .040, 1), (.64, .085, .25, .046, 1)],
           ((.21, .50, -.02), .075), ((.14, .50, -.02), (.25, .53, -.02), .060, .045), 1.05, 1.40, ((-1.02, -.03, -.72), (1.02, 1.16, .42)))
    L.head = tufted(base_head, frown=True)
    def decals(o, parts):
        base_decals(o, parts)
        for x, z in ((-.042, .125), (0, .145), (.042, .125)): o.claw(parts, (.097 + x * 1.1, .036, z + .018), (.097 + x * 1.25, .006, z + .056), .021, (54, 58, 66))   # big dark talons
    L.decals = decals
    def aura():
        out, foam = [], []
        for sg in (1, -1):
            WG = L.WING; u = np.linspace(.42, 1.18, 22); R = .28 * np.sin(np.pi * np.clip((u - .42) / .76, 0, 1)) ** .6 + .004
            base = np.array([(WG.SH + WG.WU * WG.WL * t + WG.WW * (.10 * max(0, 1 - t) + .02)) * V3(sg, 1, 1) + V3(0, .045, -.01) for t in u])
            out += crest(base, None, V3(0, 1, 0), nz(V3(sg * .9, 0, -.6)), R, (WAVE, FOAM))
            for k in range(14):                                                                         # foam flying off the crest
                t = RNG.uniform(.62, 1.12); c = (WG.SH + WG.WU * WG.WL * t) * V3(sg, 1, 1) + V3(sg * RNG.uniform(.10, .34), RNG.uniform(.28, .52), RNG.uniform(-.30, -.05))
                foam.append(sphere(c, RNG.uniform(.010, .022), FOAM_HI, 8, 5))
        add_aura(out + foam, 'near')
    L.aura = aura

elif FORM == 'tidelle':
    # VIRTUOSO (pure Water): she STANDS IN A POOL, upright, wings raised high and open, water dripping off her wings; a big glowing water gem
    # on her crown. Aura: the pool round her feet + its ripples (root), drops on threads under her wings ('near'), the gem (head).
    L.DROP = ((0, .385, -.01), (.262, .300, .280), rxm(-.12))
    spread((.255, .505, -.030), (.780, 1.090, -.080), 1.40, [(.34, 0, .40, .150, 0), (.86, .060, .26, .052, 1), (.86, .000, .29, .058, 1), (.80, -.060, .30, .058, 1),
           (.70, -.112, .29, .052, 1), (.58, -.148, .25, .046, 1), (.46, -.166, .21, .040, 1), (.62, .072, .23, .042, 1)],
           ((.21, .49, -.03), .072), ((.14, .49, -.02), (.255, .505, -.03), .058, .042), 1.20, 1.50, ((-.88, -.03, -.72), (.88, 1.34, .42)))   # (the shoulder set out + lower than Voltowaya's: her raised blade ran up beside the head, the head cut severed it)
    L.head = tufted(base_head, r=(.050, .005))
    def aura():
        pool = disc((0, FLOOR, .02), .22, .62, (150, 222, 238)) + [torus_flat((0, FLOOR + .004, .02), R, .007, (214, 248, 252)) for R in (.30, .43, .56)]
        for a in np.radians(np.arange(0, 360, 30) + 12):                                              # the splash where she stands
            b = V3(.20 * np.cos(a), FLOOR, .02 + .20 * np.sin(a)); pool.append(tube(np.array([b, b + V3(.05 * np.cos(a), .07, .05 * np.sin(a)), b + V3(.09 * np.cos(a), .10, .09 * np.sin(a))]), .010, .003, (236, 252, 255), 5))
        add_aura(pool, 'root')
        dr = []
        for sg in (1, -1):
            WG = L.WING
            for t, ln in ((.30, .20), (.48, .30), (.66, .16), (.82, .26), (.98, .12)):              # drops hanging on threads off her trailing edge
                p = (WG.SH + WG.WU * WG.WL * t - WG.WW * .12) * V3(sg, 1, 1) + V3(0, -.02, -.02); q = p - V3(0, ln, 0)
                dr.append(tube(np.array([p, (p + q) / 2, q]), .0035, .0025, (196, 240, 252), 4)); dr.append(drop(q, .020, .040, (140, 222, 248)))
        add_aura(dr, 'near')
        gem = [sphere((0, .905, .150), .050, (198, 246, 255), 16, 10), sphere((-.016, .922, .190), .014, (250, 255, 255), 8, 5)]
        add_aura(gem, 'head')
    L.aura = aura

elif FORM == 'tidowsk':
    # ACE: the diver. A compact ROUND body, small head, short raked tufts, wings out and swept back (the dive), a shorter tail; aura: the SPEAR
    # of water she dives inside: water streaming up round her in a tall point over her head, its splash crown + ripple on the ground (root).
    L.DROP = ((0, .360, -.03), (.272, .262, .272), rxm(-.22))
    spread((.235, .525, -.030), (.660, .900, -.560), 1.25, [(.34, 0, .40, .125, 0), (.90, .040, .32, .044, 1), (.84, -.010, .34, .046, 1), (.76, -.058, .32, .044, 1),
           (.64, -.096, .28, .040, 1), (.52, -.120, .22, .036, 1)],
           ((.20, .50, -.02), .068), ((.13, .50, -.02), (.235, .52, -.03), .054, .041), .95, 1.30, ((-.82, -.03, -.80), (.82, 1.12, .40)), bow=.040, thick=(.046, .032))
    L.head = tufted(base_head, tuft=((.130, .835, .05), (.235, .955, -.06)), r=(.052, .005))
    def trunk(P, M):
        b = ell(M, *L.DROP); b = su(b, ell(M, (0, .50, .01), (.20, .13, .20)), .08)
        for x, ln in ((0, 0), (.060, -.01), (.110, -.03)): b = su(b, cone(M, (x * .5, .25, -.22), (x, .17 + ln * .5, -.42 + ln), .066, .026), .04)   # a shorter tail
        return su(b, L.feet(M), .03)
    L.trunk = trunk
    L.LM = dict(L.LM, tail1=(0, .23, -.22), tail2=(0, .19, -.32), tailtip=(0, .17, -.43), tailmask=lambda V: (V[:, 2] < -.23) & (V[:, 1] < .32))
    def aura():
        sp = []; tip = V3(0, 1.78, -.16); n = 60
        for k in range(8):                                                                           # streams of water winding up to the point
            t = np.linspace(0, 1, n); th = 2 * np.pi * (k / 8 + .55 * t); r = .46 * (1 - t) ** 1.15 + .004
            Q = np.c_[r * np.cos(th), FLOOR + t * (tip[1] - FLOOR), -.16 + r * np.sin(th) * .9]
            sp += ribbon(Q, .060 * (1 - t) + .008, (186, 240, 252) if k % 2 else (212, 248, 255), up=(0, 1, 0))
        sp.append(tube(np.array([V3(0, 1.30, -.16), tip]), .016, .002, (232, 252, 255), 6))
        for a in np.radians(np.arange(0, 360, 24) + 7):                                               # the splash crown at her feet
            b = V3(.40 * np.cos(a), FLOOR, -.16 + .36 * np.sin(a)); sp.append(tube(np.array([b, b + V3(.07 * np.cos(a), .10, .07 * np.sin(a)), b + V3(.12 * np.cos(a), .14, .12 * np.sin(a))]), .013, .003, (236, 252, 254), 5))
        sp += [torus_flat((0, FLOOR, -.16), R, .008, (210, 246, 252)) for R in (.44, .58)]
        add_aura(sp, 'root')
    L.aura = aura

elif FORM == 'tidowmyr':
    # ENIGMA: half of her a VEIL OF MIST. A pale, almost white owl, wings spread broad and level (teal), a light glowing in her breast and her
    # water gem glowing; aura: mist veils drifting off her lower body and trailing back off her tail (pelvis, tail), the breast light (chest),
    # the gem (head).
    L.DROP = ((0, .375, -.03), (.272, .282, .300), rxm(-.30))
    spread((.245, .530, -.020), (.960, .570, -.060), 1.50, [(.40, -.02, .46, .200, 0), (.86, .080, .22, .070, 0), (.80, .150, .26, .068, 1), (.68, .190, .26, .064, 1),
           (.56, .210, .24, .060, 1), (.44, .210, .20, .055, 1), (.92, .010, .14, .070, 0)],
           ((.21, .50, -.02), .075), ((.14, .50, -.02), (.25, .52, -.02), .060, .045), .55, 1.0, ((-1.06, -.03, -.72), (1.06, 1.06, .42)), bow=.040, thick=(.052, .036))
    L.head = tufted(base_head, r=(.054, .006))
    L.COAT = (C8('#8fd2d8'), C8('#eefbfb')); L.COAT_KEY = C8('#eefbfb'); L.PAL = [C8('#7cc4cc'), C8('#f6fdfd'), C8('#2f9eac'), C8('#f6fdfd'), L.BEAK, L.BEAK, L.TOE]
    def aura():
        mist = []
        for k, a in enumerate(np.radians(np.arange(-165, 180, 22.5))):   # veils drifting down off her lower half
            t = np.linspace(0, 1, 24); b = V3(.24 * np.sin(a), .30, -.04 + .26 * np.cos(a)); out_ = nz(V3(np.sin(a), 0, np.cos(a) - .6))
            Q = b + np.c_[0 * t, -.105 * t, 0 * t]   # (to .19: the pelvis drops ~.05 in the sit / sleep and a deeper veil went under the ground) + out_[None] * (.10 * t ** 1.3)[:, None] + np.c_[.025 * np.sin(7 * t + k), 0 * t, .025 * np.cos(5 * t + k)]
            mist += ribbon(Q, .13 + .10 * t, (226, 246, 248) if k % 2 else (212, 240, 244), up=(0, 0, 1) if abs(np.cos(a)) > .7 else (1, 0, 0))
        add_aura(mist, 'pelvis')
        trail = []
        for k, x in enumerate((-.12, -.05, .02, .09, .15)):                                          # the tail dissolving back into mist
            t = np.linspace(0, 1, 26); Q = np.c_[x + .04 * np.sin(6 * t + k), .17 - .03 * t + .02 * np.sin(5 * t + 2 * k), -.40 - .34 * t]
            trail += ribbon(Q, .09 + .10 * t, (236, 250, 250) if k % 2 else (220, 244, 246), up=(0, 1, 0))
        add_aura(trail, 'tail2')
        add_aura([sphere((0, .405, .232), (.062, .062, .030), (255, 250, 224), 14, 8), sphere((0, .405, .244), (.028, .028, .016), (255, 255, 246), 10, 6)], 'chest')
        add_aura([sphere((0, .884, .158), .030, (204, 248, 255), 14, 8)], 'head')
    L.aura = aura

# ── the aura part: built after the body (decals lay on her field), written with body + eyes ──
_glb = C.glb
def glb_with_aura(path, parts):
    L.aura(); V, Fs, Cc, o = [], [], [], 0
    L.AURA[:] = [(np.c_[P[:, 0], np.maximum(P[:, 1], FLOOR - .02), P[:, 2]], f, col) for P, f, col in L.AURA]   # the safety under the floor rule
    for P, f, col in L.AURA: V.append(P); Fs.append(f + o); Cc.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    V, Fs, Cc = np.vstack(V), np.vstack(Fs), np.vstack(Cc); print('aura tris', len(Fs), 'verts', len(V))
    # sheet 10's PALE STRIP fix: on the coat at the spread blade root + shoulder the normal shade is turned over (the up-facing top painted darker)
    VV, FF, CC, NN = parts['body']; CC = CC.copy(); M = np.c_[np.abs(VV[:, 0]), VV[:, 1:]]; pal = np.array(L.PAL)
    coat = ~(np.abs(CC[:, None, :3].astype(int) - pal[None]).max(2) == 0).any(1); near = coat & (L.WING.blade(M) < .05) & (M[:, 0] > .14) & (L.WING.loc(M)[0] < .40)
    sh = np.clip(.42 - .30 * NN[:, 1], .05, 1)[near, None]
    CC[near, :3] = np.round(L.COAT[0] * (1 - sh) + L.COAT[1] * sh)
    L.STRIP_FIX = int(near.sum()); print('wing-root coat re-shaded', L.STRIP_FIX); parts = dict(parts, body=(VV, FF, CC, NN))
    return _glb(path, dict(parts, aura=(V, Fs, Cc, normals(V, Fs))))
C.glb = glb_with_aura
_init = C.Owl.__init__
def init(s, F): _init(s, F); L._owl = s
C.Owl.__init__ = init
sys.modules['sculpt_tidowaw'] = L          # rig_owl.py imports 'sculpt_' + form: it gets the re-shaped Tideowl module

if __name__ == '__main__':
    C.Owl(L).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6000)
