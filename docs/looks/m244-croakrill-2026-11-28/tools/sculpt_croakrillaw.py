"""M244 sheet 12: CROAKRILL's three sitting AWAKENED forms (Croakrillok / Croakrillvex / Croakrilleth), OWNER PREVIEW.
    python sculpt_croakrillaw.py <ok|vex|eth> <out.glb> [tris]        (Rillesse stands up: sculpt_rillesse.py)
Canon: CANON/world/spirits-species.md 'Croakrill (Water): Croakrillok . **Rillesse** (Virtuoso, pure) . Croakrillvex . Croakrilleth'.
Art LOCKED athernyx assets/stage3/041-044 (PRIVATE, read for shape + colour, never copied here). Each starts from the LIVE Croakrill
(m202-croakling-line tools/sculpt_croakrill.py, imported, never edited: the droplet water body, the soft layered gill fronds, long webbed
toes, teal back over aqua flanks with ripple lines + dark spots, pale lime belly, the cyan bulb lure) and re-shapes her by name:
  ok   CHAMPION: bigger, heavier, fiercer: a broad chest + belly, wide-set arms, the head pushed up and forward, her mouth OPEN and TOOTHY
       (a painted maw + tongue, two rows of small white teeth on the eyes part), and her motif = a JET OF WATER spat out of it (aura)
  vex  ACE: a swimmer at speed: lean and long, low head, long legs on big webbed feet, a small fin on her back (sculpt), more spots, a
       deeper blue-teal; her motif = a wake of water streaming back off her sides (aura)
  eth  ENIGMA: rounder and calm, fewer spots; her motif = a SMALL RAIN CLOUD hanging over her, raining (aura, on the root: it keeps
       its height while she hops)
Every lure = a glowing bulb, never a fish. Parts: body, eyes (unlit, as the live form; Croakrillok's teeth ride here), AURA (unlit, the motif)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-croakling-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['CROAKRILLAW_FORM']
import sculpt_croakrill as F0
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = F0.S
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
def rx_(a): c, s = np.cos(a), np.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

def lift(dy, dz=0.):
    """move the head, eyes, smile, lure AND her gill fronds up (dy) / forward (dz) together"""
    d = V3(0, dy, dz); S.HC = S.HC + d; S.EBC = S.EBC + d; S.L0, S.L1, S.L2, S.ORB = S.L0 + d, S.L1 + d, S.L2 + d, S.ORB + d; S.SMILE_Y += dy
    F0.RIB = [(P + d, T, Wd, N, w, t) for P, T, Wd, N, w, t in F0.RIB]
    return d
if FORM == 'ok':
    # the CHAMPION: bigger and fiercer: a broad heavy chest and belly, arms set wide, the head shoved up + forward over an open toothy mouth
    S.TC, S.TR = V3(0, .35, -.04), V3(.39, .35, .29)
    D = lift(.06, .05); S.HR = V3(.37, .20, .29)
    S.ARM = ((.300, .430, .200), (.335, .070, .330)); S.HAND = V3(.350, .030, .360)
    S.HAUNCH, S.HAUNCHR = V3(.370, .225, -.105), V3(.190, .180, .235); S.SHIN = ((.430, .120, -.185), (.470, .072, .060)); S.FOOT = V3(.480, .030, .135)
    S.FINGERS = [(a * 1.1, L * 1.05) for a, L in S.FINGERS]; S.TOES = [(a, L * 1.05) for a, L in S.TOES]; C.retip(S)
    BEL = ((0, .29, .11), (.35, .28, .32)); HUMP = ((0, .56, -.12), (.25, .19, .22))
    S.BOUNDS = (V3(-.80, -.033, -.66), V3(.80, 1.02, .70)); NSP = 26
elif FORM == 'vex':
    # the ACE: a swimmer at speed: lean and long, the head low and forward, long legs on big webbed feet, a small fin on her back
    S.TC, S.TR = V3(0, .29, -.07), V3(.27, .27, .31)
    D = lift(-.02, .07); S.HR = V3(.31, .17, .27)
    S.ARM = ((.215, .390, .200), (.250, .070, .360)); S.HAND = V3(.262, .030, .392)
    S.HAUNCH, S.HAUNCHR = V3(.300, .220, -.140), V3(.150, .170, .235); S.SHIN = ((.380, .115, -.230), (.440, .068, .060)); S.FOOT = V3(.455, .030, .165)
    S.FINGERS = [(a * 1.1, L * 1.25) for a, L in S.FINGERS]; S.TOES = [(a * 1.12, L * 1.30) for a, L in S.TOES]; C.retip(S)
    BEL = ((0, .23, .07), (.26, .19, .27)); HUMP = ((0, .48, -.16), (.19, .16, .24))
    S.SKIN, S.PAD = S.C8('#3cb4b4'), S.C8('#86d8d0'); S.HEADC = S.SKIN; F0.DEEP = S.C8('#1f7c94'); F0.SPOT = S.C8('#17566a')
    S.BOUNDS = (V3(-.72, -.033, -.72), V3(.72, .98, .72)); NSP = 64
else:
    # the ENIGMA: rounder and calm under her rain cloud, fewer spots
    S.TC, S.TR = V3(0, .31, -.03), V3(.34, .31, .27)
    D = lift(.02, .0); S.HR = V3(.33, .185, .27)
    S.ARM = ((.230, .410, .190), (.245, .070, .320)); S.HAND = V3(.256, .030, .350)
    BEL = ((0, .25, .09), (.32, .23, .28)); HUMP = ((0, .52, -.12), (.21, .17, .21))
    S.BOUNDS = (V3(-.66, -.033, -.62), V3(.66, .97, .60)); NSP = 12
F0.PAL_DEEP = F0.DEEP
def torso(M):
    d = su(ell(M, S.TC, S.TR), ell(M, *BEL), .07); d = su(d, ell(M, *HUMP), .10); return ss(d, M[..., 1] - .045, .03)
S.torso = torso
if FORM == 'vex':
    FIN_C = V3(0, .60, -.31); FIN_R = rx_(.75)
    def fin(M): return ell(M, FIN_C, (.014, .115, .150), FIN_R)
else:
    fin = None
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, V3(0, .515, .16) + D, (S.HR[0] - .02, .110, .215)), .05); d = su(d, ell(M, S.EBC, (.124, .118, .118)), .05)
    d = su(d, F0.fronds(M), .018)
    if fin is not None: d = su(d, fin(M), .025)
    return d
S.head = head
S.throat = lambda M: ell(M, V3(0, .445, .235) + D, (.215 * (1.15 if FORM == 'ok' else 1), .085, .125))
S.PAL = [S.BELLY, S.PAD, F0.DEEP, F0.RIPPLE, F0.SPOT, F0.FROND, F0.FTIP]
F0.SP = C.surf_pts(S, NSP, 8, lambda P: (P[:, 1] > .16) & (P[:, 2] < .14) & (P[:, 1] < .66 + D[1]))
MAW, TONGUE, TOOTH = S.C8('#4a1a2a'), S.C8('#e07a86'), (250, 248, 236)
_cls = F0.classes
def classes(V):
    out = _cls(V); X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]
    if FORM == 'ok':   # the open maw + tongue, under the smile on the front of her face
        sy = S.SMILE_Y + .020 * (X / .25) ** 2; front = (Z > S.HC[2] + .10) & (Y > S.HC[1] - .25)
        out.append(np.where(front, np.clip(np.minimum.reduce([sy - .006 - Y, Y - (sy - .120 * np.clip(1 - (X / .27) ** 2, 0, 1)), .27 - X]), -.05, .05), -.05))
        out.append(np.where(front, np.clip(.03 * (1 - (X / .12) ** 2 - ((Y - (S.SMILE_Y - .095)) / .035) ** 2), -.05, .05), -.05))
    if FORM == 'vex':  # her fin: the pale frond colour
        out[6] = np.maximum(out[6], np.where(fin(np.c_[X, Y, Z]) < .004, .05, -.05))
    return out
S.classes = classes
if FORM == 'ok': S.PAL = S.PAL + [MAW, TONGUE]

# ── the teeth (Croakrillok): two rows of small white cones round the open maw, on the eyes part (unlit, riding the head) ──
def tooth(p, n, down, ln, w):
    t1 = nz(np.cross(n, down)); b = [p + t1 * w - down * .002, p - t1 * w - down * .002, p + n * w * .9 - down * .002, p - n * .006]
    P = np.array(b + [p + down * ln + n * .004]); Fc = np.array([(0, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 4), (1, 2, 4), (0, 2, 1), (0, 3, 1)])
    return P, Fc, TOOTH
def teeth():
    out = []
    for row, sgn, n_ in ((0, -1, 9), (1, 1, 7)):
        for x in np.linspace(-1, 1, n_):
            a = x * (.95 if row == 0 else .80); X = np.sin(a)
            y = S.SMILE_Y + .020 * x * x - (.010 if row == 0 else .118 * np.clip(1 - (abs(X) * .30 / .27) ** 2, 0, 1) - .004)
            p = S.ray(V3(0, y, S.HC[2] - .05), V3(np.sin(a), 0, np.cos(a)), .6)[0]; n, *_ = S.frame(p)
            out.append(tooth(p + n * .002, n, V3(0, sgn, 0), .040 if abs(x) < .8 else .028, .012))
    return out
if FORM == 'ok': S.EXTRA = teeth

# ── the motif (aura): unlit parts ──
def tube(Q, r0, r1, col, sides=6):
    Q = np.asarray(Q, float); n = len(Q); t = np.gradient(Q, axis=0); t /= np.linalg.norm(t, axis=1, keepdims=True); P, Fc = [], []
    a0 = nz(np.cross(t[0], V3(0, 1, 0) if abs(t[0][1]) < .9 else V3(1, 0, 0)))
    for i in range(n):
        u = nz(np.cross(np.cross(t[i], a0), t[i])); w = np.cross(t[i], u); r = r0 + (r1 - r0) * i / max(1, n - 1)
        for j in range(sides): a = 2 * np.pi * j / sides; P.append(Q[i] + r * (np.cos(a) * u + np.sin(a) * w))
    for i in range(n - 1):
        for j in range(sides):
            a, b, c, d = i * sides + j, i * sides + (j + 1) % sides, (i + 1) * sides + j, (i + 1) * sides + (j + 1) % sides; Fc += [(a, c, b), (b, c, d)]
    P = np.array(P); P = np.vstack([P, Q[0], Q[-1]]); k0, k1 = len(P) - 2, len(P) - 1; L = (n - 1) * sides
    Fc += [(k0, j, (j + 1) % sides) for j in range(sides)] + [(k1, L + (j + 1) % sides, L + j) for j in range(sides)]
    return P, np.array(Fc), col
def ball(c, r, col, nu=7, nv=10):
    u_, v_ = np.meshgrid(np.linspace(0, np.pi, nu), np.arange(nv) / nv * 2 * np.pi, indexing='ij'); Sd = np.c_[(np.sin(u_) * np.cos(v_)).ravel(), np.cos(u_).ravel(), (np.sin(u_) * np.sin(v_)).ravel()]
    P = np.asarray(c, float) + Sd * np.asarray(r, float); Fb = [(i * nv + j, (i + 1) * nv + (j + 1) % nv, i * nv + (j + 1) % nv) for i in range(nu - 1) for j in range(nv)] + [(i * nv + j, (i + 1) * nv + j, (i + 1) * nv + (j + 1) % nv) for i in range(nu - 1) for j in range(nv)]
    return P, np.array(Fb), col
def drop(c, r, col, up=V3(0, 1, 0)):
    """a raindrop: round at the bottom, a point at the top (along up)"""
    P, Fb, _ = ball(V3(0, 0, 0), (r, r, r), col, 6, 8); P[:, 1] = np.where(P[:, 1] > 0, P[:, 1] * 2.6, P[:, 1])
    u = nz(up); a = np.cross(V3(0, 1, 0), u); s = np.linalg.norm(a)
    if s > 1e-6:
        a /= s; th = np.arccos(np.clip(u[1], -1, 1)); K_ = np.array([[0, -a[2], a[1]], [a[2], 0, -a[0]], [-a[1], a[0], 0]]); R = np.eye(3) + np.sin(th) * K_ + (1 - np.cos(th)) * K_ @ K_; P = P @ R.T
    return P + c, Fb, col
JET, JET_HI, FOAM, WAKE, CLOUD, CLOUD_LO, RAIN = (150, 228, 246), (226, 252, 255), (250, 255, 255), (196, 240, 250), (240, 244, 250), (196, 206, 224), (120, 196, 246)
AURA_LURE = ()
AURA_HIPS = (WAKE, FOAM) if FORM == 'vex' else ()     # Croakrillvex's wake + bubbles ride her hips as one piece (rig_croakrillaw.py)
AURA_ROOT = (CLOUD, CLOUD_LO, RAIN) if FORM == 'eth' else ()     # the cloud + its rain keep their height while she hops; the rest is skinned to the nearest body vertex
def aura_parts():
    out = []; rng = np.random.default_rng(41)
    if FORM == 'ok':     # a JET OF WATER out of her open mouth: a widening braided stream, flaring and breaking into spray at its end
        m0 = V3(0, S.SMILE_Y - .060, 0); m0 = S.ray(m0 + V3(0, 0, S.HC[2]), V3(0, 0, 1), .6)[0] + V3(0, 0, -.015)
        for k, (ph, r0, r1, col) in enumerate(((0, .022, .070, JET), (2.1, .018, .055, JET_HI), (4.2, .016, .050, JET))):
            t = np.linspace(0, 1, 16); Q = np.c_[.025 * np.sin(6 * t + ph) * t, .10 * t + .035 * np.sin(5 * t + ph) * t, .62 * t] + m0
            out.append(tube(Q, r0, r1, col, 7))
        end = m0 + V3(0, .10, .62)
        for i in range(16):
            u = nz(V3(rng.normal(0, .7), rng.normal(.15, .6), rng.uniform(.2, 1.)))
            out.append(drop(end + u * rng.uniform(.06, .17), rng.uniform(.010, .020), FOAM if i % 3 else JET, up=-u))
        for i in range(8):    # droplets thrown off along the stream
            s = rng.uniform(.25, .85); p = m0 + V3(0, .10 * s, .62 * s) + V3(rng.choice([-1, 1]) * rng.uniform(.07, .13), rng.uniform(-.03, .08), 0)
            out.append(drop(p, rng.uniform(.008, .014), JET_HI, up=V3(0, 1, -.6)))
    elif FORM == 'vex':  # the wake: thin streams of water peeling back off her sides and back, curling out behind her
        for s in (1, -1):
            for (x0, y0, z0, L, wob) in ((.25, .42, .10, .50, .03), (.33, .27, -.12, .46, .04)):
                t = np.linspace(0, 1, 18); Q = np.c_[s * (x0 + .10 * t ** 1.4 + wob * np.sin(6 * t) * t), y0 + .03 * np.sin(5 * t + x0 * 9) * t + .03 * t, z0 - L * t]
                out.append(tube(Q, .028, .006, WAKE, 7))
        for i in range(10):   # bubbles left behind
            p = V3(rng.uniform(-.40, .40), rng.uniform(.20, .55), rng.uniform(-.75, -.45)); r = rng.uniform(.012, .026); out.append(ball(p, (r, r, r), FOAM, 5, 8))
    else:                # a small rain cloud over her (above her lure), raining onto her head
        c0 = V3(-.06, 1.42 + D[1], .05)
        for (dx, dy, dz, r) in ((0, 0, 0, .15), (-.17, -.03, .02, .115), (.16, -.04, -.01, .12), (-.06, .07, -.02, .12), (.08, .06, .04, .11), (-.28, -.07, 0, .08), (.27, -.07, .02, .08), (0, -.06, .10, .10)):
            out.append(ball(c0 + V3(dx, dy, dz), (r * 1.15, r * .85, r), CLOUD, 7, 12))
        out.append(ball(c0 + V3(0, -.08, .02), (.33, .055, .14), CLOUD_LO, 6, 14))    # its flat grey underside
        for i in range(16):
            p = c0 + V3(rng.uniform(-.30, .30), -.16 - rng.uniform(0, .36), rng.uniform(-.10, .18))
            out.append(drop(p, rng.uniform(.010, .015), RAIN))
    return out
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = S.join(aura_parts()); parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF), 'verts', len(aV)); return _glb(path, parts)
S.glb = glb_with_aura
if __name__ == '__main__': C.build(S, sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else dict(ok=5400, vex=4900, eth=6000)[FORM])
