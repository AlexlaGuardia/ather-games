"""M244 sheet 12: CROAKORE's four AWAKENED forms (Oregrak / Croakorelle / Croakoris / Croakormyr), OWNER PREVIEW.
    python sculpt_croakorew.py <oregrak|croakorelle|croakoris|croakormyr> <out.glb> [tris]
Canon: CANON/world/spirits-species.md 'Croakore (Earth): **Oregrak** (Champion, pure) . Croakorelle . Croakoris . Croakormyr'. Art LOCKED athernyx
assets/stage3/037-040 (PRIVATE, read for shape + colour, never copied here). Each starts from the LIVE Croakore (m202-croakling-line
tools/sculpt_croakore.py, imported, never edited: the toad, the heaviest of the line, warts, moss on crown + shoulders, ochre coat on a golden
belly, slit-pupilled orange eyes, the amber teardrop lure) and re-shapes her by name:
  oregrak      CHAMPION (pure Earth): bigger and broader, ROCK SHOULDER ARMOUR (two stacked stone plates on each shoulder + a stone cuff on each
               forearm, in her body), heavy closed fists; her motif = glowing CRACKS in the ground round her (aura, on the root)
  croakorelle  VIRTUOSO: she SINGS: her throat-sac blown round into a great glowing AMBER CRYSTAL ball in front of her chest (aura, skinned to
               her throat, so it swells on the croak); small amber crystals rising from the ground round her (aura, root); a greener coat
  croakoris    ACE (a leaping burrower): lean, long legs and big feet, arms flung wide with the fingers spread; her motif = the burrow she
               springs from: a ring of earth clods + a spray of earth streaks bursting up behind her (aura, root)
  croakormyr   ENIGMA: hushed: rounder and still, a pale gold coat with little moss, big dark eyes; her motif = an AMBER CRYSTAL CRUST over
               her back (aura, crystal points on the skin from crown to rump)
Every lure = a glowing bulb, never a fish. Parts: body, eyes (unlit, as the live form), AURA (unlit, the motif)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-croakling-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['CROAKOREW_FORM']
assert FORM in ('oregrak', 'croakorelle', 'croakoris', 'croakormyr'), FORM
import sculpt_croakore as F0
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = F0.S
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)

def lift(dy, dz=0.):
    """move the head, eyes, smile, throat and lure up (dy) / forward (dz) together"""
    d = V3(0, dy, dz); S.HC = S.HC + d; S.EBC = S.EBC + d; S.L0, S.L1, S.L2, S.ORB = S.L0 + d, S.L1 + d, S.L2 + d, S.ORB + d; S.SMILE_Y += dy
    return d
def rbox(M, c, half, r, rz=0., ry=0.):
    """a rounded box at c (half extents), rolled rz round z then turned ry round y (the right side; M = |x|)"""
    cz, sz, cy, sy = np.cos(rz), np.sin(rz), np.cos(ry), np.sin(ry)
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]); Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); R = Ry @ Rz
    q = np.abs((M - np.asarray(c, float)) @ R) - np.asarray(half, float)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(q.max(-1), 0) - r
ARMOUR = None
D = V3(0, 0, 0)
if FORM == 'oregrak':
    # the Champion: broader, taller chest, the head riding a little higher, heavy fists
    S.TC, S.TR = V3(0, .32, -.03), V3(.47, .32, .33)
    D = lift(.06, .03); S.HR = V3(.41, .18, .29)
    S.ARM = ((.300, .400, .190), (.335, .075, .330)); S.HAND = V3(.350, .045, .355)
    S.FINGERS = [(a * .8, L * .55) for a, L in S.FINGERS]                      # curled short: a fist
    S.HAUNCH, S.HAUNCHR = V3(.400, .210, -.090), V3(.205, .185, .245); S.SHIN = ((.450, .120, -.180), (.500, .072, .060)); S.FOOT = V3(.515, .030, .120); C.retip(S)
    BEL = ((0, .26, .09), (.42, .24, .31))
    _arms0 = S.arms
    def ARMOUR(M):
        a, b = V3(*S.ARM[0]), V3(*S.ARM[1])
        d = rbox(M, V3(.375, .560, .030), (.150, .038, .170), .026, rz=-.50)            # the big upper shoulder plate, riding up beside her head
        d = np.minimum(d, rbox(M, V3(.485, .430, .045), (.095, .034, .155), .024, rz=-1.10))   # the lower plate, stepped out and down over the arm
        p0, p1 = a + (b - a) * .52, a + (b - a) * .74
        return np.minimum(d, cone(M, p0, p1, .108, .100))                          # a stone cuff on the forearm
    def arms(M):
        a, b = V3(*S.ARM[0]), V3(*S.ARM[1]); d = su(_arms0(M), cone(M, a, b, .102, .074), .03)
        d = su(d, ell(M, S.HAND, (.088, .060, .085)), .03)                        # the fist
        return su(d, ARMOUR(M), .010)
    S.arms = arms
    S.throat = lambda M: ell(M, V3(0, .390, .245) + D, (.28, .088, .135))
    S.BOUNDS = (V3(-.82, -.033, -.48), V3(.82, .98, .62))
elif FORM == 'croakorelle':
    S.TC, S.TR = V3(0, .30, -.03), V3(.43, .30, .31)
    D = lift(.04, .0); BEL = ((0, .24, .08), (.39, .22, .28))
    S.ARM = ((.255, .370, .190), (.300, .070, .330)); S.HAND = V3(.315, .030, .355); C.retip(S)
    S.throat = lambda M: ell(M, V3(0, .390, .235) + D, (.27, .090, .135))
    S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#a8a24a', '#e8cf5c', '#c8b456')); S.HEADC = S.SKIN   # an olive coat (the locked art's greener toad)
    S.BOUNDS = (V3(-.74, -.033, -.46), V3(.74, .92, .60))
elif FORM == 'croakoris':
    # the leaping burrower: leaner, long legs and big feet, arms flung wide and forward, fingers spread
    S.TC, S.TR = V3(0, .30, -.02), V3(.37, .27, .28)
    D = lift(.04, .04); S.HR = V3(.35, .165, .27)
    S.ARM = ((.250, .380, .190), (.430, .090, .360)); S.HAND = V3(.450, .040, .390)
    S.FINGERS = [(a * 1.35, L * 1.35) for a, L in S.FINGERS]
    S.HAUNCH, S.HAUNCHR = V3(.330, .230, -.090), V3(.175, .190, .250); S.SHIN = ((.400, .125, -.220), (.465, .068, .070)); S.FOOT = V3(.480, .030, .160)
    S.TOES = [(a * 1.05, L * 1.45) for a, L in S.TOES]; C.retip(S)
    BEL = ((0, .24, .08), (.33, .21, .26))
    S.throat = lambda M: ell(M, V3(0, .395, .230) + D, (.24, .085, .13))
    S.BOUNDS = (V3(-.78, -.033, -.48), V3(.78, .94, .66))
else:
    # CROAKORMYR, hushed: rounder, calm, pale gold, big dark eyes
    S.TC, S.TR = V3(0, .29, -.02), V3(.43, .29, .32)
    D = lift(.03, .0); S.HR = V3(.37, .18, .28); S.RE = .088; S.KE = S.RE / .066
    BEL = ((0, .24, .09), (.38, .22, .29))
    S.throat = lambda M: ell(M, V3(0, .390, .235) + D, (.26, .088, .135))
    S.SKIN, S.BELLY, S.PAD = map(S.C8, ('#d2b04e', '#f2dc84', '#e0c066')); S.HEADC = S.SKIN
    src = S._eyes_src   # the live Croakore's eye colours (her slit toad eye) -> big round dark eyes
    for x, y in (("(150, 96, 30)", "(176, 140, 60)"), ("(226, 120, 40)", "(46, 34, 24)"), ("(26, 16, 10)", "(12, 9, 7)"), ("ry=0.42)", "ry=1.0)")):
        assert x in src, x; src = src.replace(x, y)
    S._eyes_src = src; exec(compile(src, 'croak_eyes', 'exec'), S.__dict__)
    S.BOUNDS = (V3(-.74, -.033, -.46), V3(.74, .92, .60))
def torso(M):
    d = su(ell(M, S.TC, S.TR), ell(M, *BEL), .06); return ss(d, M[..., 1] - .045, .03)
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, V3(0, .455, .16) + D, (S.HR[0] - .03, .110, .225)), .05)
    d = su(d, ell(M, S.EBC, (.104, .094, .100) if FORM != 'croakormyr' else (.116, .108, .108)), .05)
    if FORM == 'croakormyr': return d                                              # hushed: no heavy brow
    return su(d, ell(M, S.EBC + V3(0, .040, -.010), (.112, .040, .090)), .03)
# her warts re-seeded on HER surface (the live form's are seeded on the live shape)
F0.WB = np.zeros((0, 3))
S.torso, S.head = torso, head
WB = C.surf_pts(S, 70 if FORM != 'croakormyr' else 46, 27, lambda P: (P[:, 2] < .20) & (P[:, 1] > .12) & (np.abs(P[:, 0]) > .02)); F0.WB = np.c_[np.abs(WB[:, 0]), WB[:, 1:]]
S.torso = lambda M: su(torso(M), F0.warts(M), .022)
S.head = lambda M: su(head(M), F0.warts(M), .022)
STONE, STONE_D = S.C8('#8f8a80'), S.C8('#6f6a62')
_cls = S.classes
def classes(V):
    out = _cls(V); X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]; M = np.c_[X, Y, Z]
    if FORM == 'croakormyr': out[2] = np.minimum(out[2], np.where(Y > .70, out[2], -.05))   # hushed: moss only on the crown
    if ARMOUR is not None:   # the stone plates + cuffs, laid last so they win over moss
        a = ARMOUR(M); oth = np.minimum(np.minimum(S.torso(M), S.head(M)), np.minimum(_arms0(M), S.hind(M)))
        out.append(np.clip(np.minimum(.004 - a, oth - a + .002), -.05, .05))
    return out
S.classes = classes
S.PAL = list(S.PAL) + ([STONE] if ARMOUR is not None else [])

# ── the motif (aura): unlit parts ──
def slab(Q, wd, col, y0=.0015, y1=.0055):
    """a flat crack / streak lying on the ground along Q (x, z), as a thin closed slab"""
    Q = np.asarray(Q, float); n = len(Q); t = np.gradient(Q, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True); s = np.c_[-t[:, 1], t[:, 0]]
    w = np.asarray(wd, float) * np.ones(n); P = []
    for y in (y0, y1):
        for sgn in (1, -1): P += [V3(Q[i, 0] + sgn * w[i] * s[i, 0], y, Q[i, 1] + sgn * w[i] * s[i, 1]) for i in range(n)]
    P = np.array(P); b0, b1, t0, t1 = 0, n, 2 * n, 3 * n; Fc = []
    for i in range(n - 1):
        Fc += [(t0 + i, t1 + i, t0 + i + 1), (t0 + i + 1, t1 + i, t1 + i + 1)]                  # top (up)
        Fc += [(b0 + i, b0 + i + 1, t0 + i), (t0 + i, b0 + i + 1, t0 + i + 1)]                  # outer side
        Fc += [(b1 + i, t1 + i, b1 + i + 1), (t1 + i, t1 + i + 1, b1 + i + 1)]                  # inner side
    return P, np.array(Fc), col
def facet(P, Fc, col):
    """flat-shaded: every face its own three verts"""
    P = np.asarray(P, float)[np.asarray(Fc).ravel()]; return P, np.arange(len(P)).reshape(-1, 3), col
def crystal(base, axis, r, L, col, k=6, tip=.35, rot=0., floor=None):
    """a hexagonal crystal point: a prism of length L*(1-tip) capped by a pyramid, standing on base along axis"""
    ax = nz(axis); u = nz(np.cross(ax, V3(0, 0, 1) if abs(ax[2]) < .9 else V3(1, 0, 0))); w = np.cross(ax, u); a = rot + np.arange(k) / k * 2 * np.pi
    ring = lambda c, rr: [c + rr * (np.cos(t) * u + np.sin(t) * w) for t in a]
    P = [base - ax * .01] + ring(base - ax * .01, r) + ring(base + ax * L * (1 - tip), r) + [base + ax * L]; Fc = []
    for i in range(k):
        j = (i + 1) % k; Fc += [(0, 1 + j, 1 + i), (1 + i, 1 + j, 1 + k + j), (1 + i, 1 + k + j, 1 + k + i), (1 + k + i, 1 + k + j, 2 * k + 1)]
    P = np.array(P)
    if floor is not None: P[:, 1] += max(0., floor - P[:, 1].min())   # standing on the ground: nothing under it
    return facet(P, Fc, col)
def icosphere(c, r, col, sub=1, squash=(1, 1, 1)):
    t = (1 + 5 ** .5) / 2; V = [nz(v) for v in [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]]
    Fc = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    for _ in range(sub):
        mid = {}; out = []
        def m(a, b):
            k = (min(a, b), max(a, b))
            if k not in mid: V.append(nz((V[a] + V[b]) / 2)); mid[k] = len(V) - 1
            return mid[k]
        for a, b, cc in Fc: p, q, s = m(a, b), m(b, cc), m(cc, a); out += [(a, p, s), (b, q, p), (cc, s, q), (p, q, s)]
        Fc = out
    return facet(np.asarray(c, float) + np.array(V) * r * np.asarray(squash, float), Fc, col)
AMBER, AMBER_HI, AMBER_D, EARTH, EARTH_HI, CRACK = (255, 176, 64), (255, 214, 120), (226, 140, 44), (186, 138, 66), (222, 178, 96), (255, 168, 52)
AURA_LURE = ()
AURA_ROOT = {'oregrak': (CRACK,), 'croakorelle': (AMBER_HI, AMBER_D), 'croakoris': (EARTH, EARTH_HI), 'croakormyr': ()}[FORM]
def aura_parts():
    out = []; rng = np.random.default_rng(37)
    if FORM == 'oregrak':   # cracks in the ground: jagged lines branching out round her (front + sides), tapering
        for ang in (-2.3, -1.65, -1.0, -.45, .15, .75, 1.35, 2.0, 2.6):
            r0, r1 = .50 + .06 * rng.random(), .86 + .14 * rng.random(); n = 9; rr = np.linspace(r0, r1, n); jit = np.cumsum(rng.normal(0, .07, n)); jit -= jit[0]
            Q = np.c_[np.sin(ang + jit * .25) * rr, np.cos(ang + jit * .25) * rr + .10]
            out.append(slab(Q, np.linspace(.026, .006, n), CRACK))
            k = 3 + rng.integers(3); b = Q[k]; ba = ang + (.55 if rng.random() > .5 else -.55); L = .10 + .08 * rng.random()   # a short branch
            out.append(slab(np.array([b, b + L * .5 * np.r_[np.sin(ba), np.cos(ba)] + rng.normal(0, .01, 2), b + L * np.r_[np.sin(ba), np.cos(ba)]]), np.array([.014, .009, .004]), CRACK))
    elif FORM == 'croakorelle':   # the amber crystal ball where her throat-sac is, and crystals rising from the ground round her
        th = V3(0, .345, .520) + D * V3(0, .6, 1)
        out.append(icosphere(th, .205, AMBER, 2, (1, .96, .92)))
        for c, n_, s in ((V3(.60, 0, .32), 4, 1.4), (V3(-.64, 0, .10), 3, 1.1), (V3(.44, 0, .74), 2, .85), (V3(-.36, 0, .76), 3, 1.0)):
            for i in range(n_):
                tilt = V3(rng.normal(0, .35), 1, rng.normal(0, .35)); off = V3(rng.normal(0, .045), 0, rng.normal(0, .045)) if i else V3(0, 0, 0)
                out.append(crystal(c + off, tilt, (.028 if i == 0 else .018) * s, (.20 if i == 0 else .11 + .05 * rng.random()) * s, AMBER_HI if i % 2 else AMBER_D, floor=.0015))
    elif FORM == 'croakoris':   # the burrow: a ring of clods round where she sprang from + a spray of earth bursting up behind her
        hole = V3(0, 0, -.42)
        for i in range(16):
            a = i / 16 * 2 * np.pi + rng.normal(0, .1); rr = .30 + .04 * rng.random()
            rc = .035 + .02 * rng.random(); out.append(icosphere(hole + V3(np.cos(a) * rr * 1.2, rc * .8 * .86 + .0015, np.sin(a) * rr * .8), rc, EARTH if i % 3 else EARTH_HI, 0, (1.2, .8, 1)))
        for i in range(9):   # streaks: tapering tubes arcing up and out of the burrow
            a = -1.3 + 2.6 * i / 8 + rng.normal(0, .08); dirn = V3(np.sin(a) * .9, 0, -np.cos(a) * .6); h = .42 + .22 * rng.random(); t = np.linspace(0, 1, 9)[:, None]
            Q = hole + V3(0, .026, 0) + dirn * (.22 + .40 * t) + V3(0, 1, 0) * (h * np.sin(t * np.pi * .62))
            P, Fc, col = tube(Q, .022, .004, EARTH_HI if i % 2 else EARTH, 5); out.append(facet(P, Fc, col))
        for i in range(10):   # flung clods
            a = rng.uniform(-1.4, 1.4); out.append(icosphere(hole + V3(np.sin(a) * .5, .25 + .35 * rng.random(), -np.cos(a) * .35 - .1), .022 + .012 * rng.random(), EARTH, 0))
    else:                    # an amber crystal crust over her back: points standing out of her skin from crown to rump
        P = C.surf_pts(S, 260, 40, lambda P: (P[:, 2] < -.02 + .25 * (P[:, 1] - .30)) & (P[:, 1] > .16) & (np.abs(P[:, 0]) < .30 + .1 * (P[:, 1] < .5)))
        P = P[np.argsort(P[:, 1])]; keep = []
        for p in P:
            if all(np.linalg.norm(p - q) > .062 for q in keep): keep.append(p)
        for i, p in enumerate(keep):
            n = S.grad(p[None], 3e-3)[0]; up = nz(n + V3(0, .55, -.35)); L = .12 + .13 * np.clip(1 - abs(p[0]) / .32, 0, 1) + .04 * rng.random()
            out.append(crystal(p - n * .015, up, .034 + .010 * rng.random(), L, AMBER if i % 3 else AMBER_HI, 6, .45, rng.random()))
        print('crust crystals', len(keep))
    return out
def tube(Q, r0, r1, col, sides=6):
    Q = np.asarray(Q, float); n = len(Q); t = np.gradient(Q, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True); P, Fc = [], []
    a0 = nz(np.cross(t[0], V3(0, 1, 0) if abs(t[0][1]) < .9 else V3(1, 0, 0)))
    for i in range(n):
        u = nz(np.cross(np.cross(t[i], a0), t[i])); w = np.cross(t[i], u); r = r0 + (r1 - r0) * i / max(1, n - 1)
        for j in range(sides): a = 2 * np.pi * j / sides; P.append(Q[i] + r * (np.cos(a) * u + np.sin(a) * w))
    for i in range(n - 1):
        for j in range(sides):
            a, b, c, d = i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + j, (i + 1) * sides + (j + 1) % sides; Fc += [(a, c, b), (b, c, d)]
    P.append(Q[-1]); e = len(P) - 1; Fc += [(e - sides + j, e, e - sides + (j + 1) % sides) for j in range(sides)]   # a closed tip
    return np.array(P), np.array(Fc), col
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = S.join(aura_parts()); parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF), 'verts', len(aV)); return _glb(path, parts)
S.glb = glb_with_aura
_dec = S.decimate
def decimate(V, Fc, n):
    """the base's decimation, run again on its own result while it lands far over the target (warts + armour carry tiny tunnels)"""
    t = _dec(V, Fc, n)
    for _ in range(3):
        if t is None or len(t.faces) < n * 1.15: break
        import trimesh, fast_simplification as fs; t2 = None
        for agg in (1, 2, 3, 4, 5, 6, 7):
            v, f = fs.simplify(np.asarray(t.vertices, np.float32), np.asarray(t.faces, np.int32), target_count=n, agg=agg); q = trimesh.Trimesh(v, f, process=False); q.merge_vertices(); trimesh.repair.fix_winding(q)
            if q.is_watertight and q.is_winding_consistent and q.body_count == 1 and q.euler_number <= 2: t2 = q; break
        if t2 is None: break
        t = t2
    return t
S.decimate = decimate
if __name__ == '__main__': C.build(S, sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6000)
