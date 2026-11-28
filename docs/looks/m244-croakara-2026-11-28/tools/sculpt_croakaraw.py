"""M244 sheet 11: CROAKARA's four AWAKENED forms (Croakgulp / Croakalys / Croakavis / Araeth), OWNER PREVIEW.
    python sculpt_croakaraw.py <gulp|avis|araeth> <out.glb>        (Croakalys stands up: sculpt_croakalys.py)
Canon: CANON/world/spirits-species.md 'Croakara (Mana): **Croakgulp** (Champion; the 99-meals form) . Croakalys . Croakavis . **Araeth**
(Enigma, pure)'. Art LOCKED athernyx assets/stage3/033-036 (PRIVATE, read for shape + colour, never copied here). Each starts from the LIVE
Croakara (m202-croakling-line tools/sculpt_croakara.py, imported, never edited: the base Croakling re-shaped wide and squat, huge lilac-ringed
eyes, the wide smile, the gold flowing marks = pattern only, the violet bud lure) and re-shapes her by name:
  gulp    CHAMPION (the 99-meals form): visibly HEAVIER, a huge round belly pushed forward, wider haunches, head riding high on it; her
          motif = the glowing gold swirl over her belly (aura, flame lines + a spiral, skinned to the belly)
  avis    ACE: leaner, longer legs and big feet, a racer's crouch; her motif = a GHOST COPY of her sat behind her (aura, pale, unlit)
  araeth  ENIGMA (pure Mana): rounder and calm, a plain round glowing globe for a lure (no bud points) with a brass cap, and hanging FROM it on
          fine chains a plain copper Simmer pot and two corked potion bottles (aura, on the lure tip bone)
Every lure = a glowing bulb, never a fish. Parts: body, eyes (unlit, as the live form), AURA (unlit, the motif; AURA_LURE colours ride lure3)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-croakling-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['CROAKARAW_FORM']
import sculpt_croakara as F0
import croak_common as C
from croak_common import cone, ell, su, ss, V3
S = F0.S
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)

def lift(dy, dz=0.):
    """move the head, eyes, smile, throat and lure up (dy) / forward (dz) together"""
    d = V3(0, dy, dz); S.HC = S.HC + d; S.EBC = S.EBC + d; S.L0, S.L1, S.L2, S.ORB = S.L0 + d, S.L1 + d, S.L2 + d, S.ORB + d; S.SMILE_Y += dy
    return d
GOLD = S.C8('#e8b830')
if FORM == 'gulp':
    # THE 99-MEALS FORM: a big heavy gourmand. Torso + belly far bigger than Croakara's, the head riding high on top
    S.TC, S.TR = V3(0, .34, -.03), V3(.50, .34, .34)
    D = lift(.10, .05); S.HR = V3(.42, .19, .29)
    S.ARM = ((.380, .400, .250), (.505, .075, .410)); S.HAND = V3(.525, .030, .440)
    S.HAUNCH, S.HAUNCHR = V3(.470, .210, -.110), V3(.215, .185, .255); S.SHIN = ((.520, .120, -.200), (.590, .072, .050)); S.FOOT = V3(.610, .030, .120)
    S.FINGERS = [(a, L * 1.10) for a, L in S.FINGERS]; S.TOES = [(a, L * 1.10) for a, L in S.TOES]; C.retip(S)
    BEL = ((0, .30, .13), (.38, .30, .37))
    def torso(M):
        d = su(ell(M, S.TC, S.TR), ell(M, *BEL), .08); return ss(d, M[..., 1] - .045, .03)
    S.throat = lambda M: ell(M, V3(0, .400, .225) + D, (.29, .095, .14))
    S.ORBR = S.ORBR * 1.15; S.BOUNDS = (V3(-.86, -.033, -.48), V3(.86, 1.02, .66))
elif FORM == 'avis':
    # the racer: leaner, longer legs and big feet, a forward crouch
    S.TC, S.TR = V3(0, .29, -.02), V3(.34, .26, .27)
    D = lift(.04, .05); S.HR = V3(.35, .17, .27); S.RE = .098; S.KE = S.RE / .066
    S.ARM = ((.225, .380, .200), (.265, .070, .350)); S.HAND = V3(.280, .030, .375)
    S.HAUNCH, S.HAUNCHR = V3(.320, .235, -.090), V3(.165, .185, .245); S.SHIN = ((.380, .130, -.210), (.440, .068, .080)); S.FOOT = V3(.455, .030, .170)
    S.FINGERS = [(a * 1.1, L * 1.25) for a, L in S.FINGERS]; S.TOES = [(a * 1.05, L * 1.45) for a, L in S.TOES]; C.retip(S)
    BEL = ((0, .24, .08), (.31, .20, .25))
    def torso(M):
        d = su(ell(M, S.TC, S.TR), ell(M, *BEL), .06); return ss(d, M[..., 1] - .045, .03)
    S.throat = lambda M: ell(M, V3(0, .400, .225) + D, (.23, .085, .13))
    S.BOUNDS = (V3(-.70, -.033, -.46), V3(.70, .96, .70))
else:
    # ARAETH: rounder, calm, a plain globe on her lure; slightly bluer violet (the locked art)
    S.TC, S.TR = V3(0, .29, -.01), V3(.40, .28, .30)
    D = lift(.04, .0); S.HR = V3(.37, .19, .28)
    BEL = ((0, .24, .09), (.36, .22, .28))
    def torso(M):
        d = su(ell(M, S.TC, S.TR), ell(M, *BEL), .06); return ss(d, M[..., 1] - .045, .03)
    S.throat = lambda M: ell(M, V3(0, .400, .225) + D, (.25, .090, .135))
    S.ORBR = V3(.105, .105, .105); S.ORB = S.ORB + V3(-.03, .0, 0)
    S.SKIN, S.PAD = S.C8('#7a74cc'), S.C8('#aaa6ea'); S.HEADC = S.SKIN
    S.BOUNDS = (V3(-.74, -.033, -.44), V3(.74, .94, .58))
S.torso = torso
def head(M):
    d = su(ell(M, S.HC, S.HR), ell(M, V3(0, .465, .15) + D, (S.HR[0] - .03, .115, .225)), .05); return su(d, ell(M, S.EBC, (.128, .120, .120)), .05)
S.head = head
S.PAL = [S.BELLY, S.PAD, GOLD]
_cls = S.classes
def classes(V):
    out = _cls(V); X, Y, Z = np.abs(V[:, 0]), V[:, 1], V[:, 2]
    c, r = BEL; qb = (X / (r[0] * .82)) ** 2 + ((Y - c[1] - .01) / (r[1] * .95)) ** 2 + ((Z - c[2] - r[2] * .45) / (r[2] * .9)) ** 2   # her pale belly, front and low
    core = S.torso(np.c_[X, Y, Z]); oth = np.minimum(S.arms(np.c_[X, Y, Z]), S.hind(np.c_[X, Y, Z]))
    out[0] = np.where(core < oth - .004, np.clip(np.minimum(.03 * (1 - qb), (S.SMILE_Y - .006) - Y), -.05, .05), np.minimum(out[0], -.0001))
    if FORM == 'araeth': out[2] = np.minimum(out[2], np.where(np.sin(5 * Y + 3 * X) > .55, out[2], -.05))   # pure: fewer marks
    return out
S.classes = classes

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
    return np.array(P), np.array(Fc), col
def lathe(c, prof, col, k=18):
    """a solid of revolution round +y at c: prof = [(r, y), ...] bottom to top (closed at both ends)"""
    prof = np.asarray(prof, float); a = np.arange(k) / k * 2 * np.pi; P = [c + V3(0, prof[0, 1], 0)]
    for r, y in prof: P += [c + V3(r * np.cos(t), y, r * np.sin(t)) for t in a]
    P.append(c + V3(0, prof[-1, 1], 0)); P = np.array(P); n = len(prof); top = len(P) - 1; Fc = [(0, 1 + (i + 1) % k, 1 + i) for i in range(k)]
    for j in range(n - 1):
        p, q = 1 + j * k, 1 + (j + 1) * k; Fc += [f for i in range(k) for f in ((p + i, p + (i + 1) % k, q + (i + 1) % k), (p + i, q + (i + 1) % k, q + i))]
    q = 1 + (n - 1) * k; Fc += [(top, q + i, q + (i + 1) % k) for i in range(k)]
    return P, np.array(Fc), col
COPPER, COPPER_HI, BRASS, GLASS, POT_IN, PINK, BLUE, CORK, CHAIN, SWIRL, GHOST = (184, 104, 52), (226, 150, 86), (214, 170, 80), (236, 236, 250), (92, 50, 24), (244, 120, 176), (126, 116, 236), (176, 128, 72), (168, 150, 120), (255, 214, 96), (214, 200, 246)
AURA_LURE = (COPPER, COPPER_HI, BRASS, GLASS, POT_IN, PINK, BLUE, CORK, CHAIN) if FORM == 'araeth' else ()
AURA_ROOT = (GHOST,) if FORM == 'avis' else ()          # the ghost sits behind her on the ground (root); the rest is skinned to the nearest body vertex
def aura_parts():
    out = []
    if FORM == 'gulp':   # the glowing gold swirl over her belly: rising flame lines and one spiral, laid on the skin
        c, r = BEL; z0 = 0.
        def onb(x, y): return S.ray(V3(x, y, z0), V3(0, 0, 1), 1.)[0]
        for x0 in (-.27, -.17, -.07, .05, .15, .25):
            ys = np.linspace(.10, .34 + .10 * (1 - abs(x0) / .3), 18); Q = np.array([onb(x0 + .035 * np.sin(9 * y + 3 * x0) * (y - .08) * 3, y) for y in ys])
            P, Fc, col = S.strip(Q, SWIRL, .0075, .0045); out.append((P, Fc, col))
        t = np.linspace(0, 3.4 * np.pi, 40); rr = .012 * t; Q = np.array([onb(-.13 + rr[i] * np.cos(t[i]), .30 + rr[i] * np.sin(t[i]) * 1.1) for i in range(len(t))])
        out.append(S.strip(Q, SWIRL, .007, .0045))
    elif FORM == 'avis':   # the ghost copy: her own surface again, coarse, pale, behind her and up to her right
        import trimesh
        from marching import surface
        lo, hi = S.BOUNDS; V, Fc = surface(S.field, lo, hi, .022); m = trimesh.Trimesh(V, Fc, process=False); k = max(m.split(only_watertight=False), key=lambda q: len(q.faces))
        import fast_simplification as fs; v, f = fs.simplify(np.asarray(k.vertices, np.float32), np.asarray(k.faces, np.int32), target_count=1400, agg=4)
        v = np.asarray(v, float) * .96 + V3(-.52, .03, -.80); out.append((v, np.asarray(f), GHOST))
    else:                  # Araeth: chains off the globe, a copper Simmer pot and two corked potion bottles hanging from it
        o = S.ORB; R = S.ORBR[1]; out.append(lathe(o + V3(0, R * .86, 0), [(.040, 0), (.044, .012), (.030, .030)], BRASS, 14))
        hook = o - V3(0, R * .92, 0)
        pot = hook + V3(-.06, -.34, .02); PS = 1.3; b1 = hook + V3(.035, -.15, .05); b2 = hook + V3(.09, -.19, -.01)
        for e in (pot + V3(0, .085 * PS, 0), b1 + V3(0, .075, 0), b2 + V3(0, .070, 0)):
            out.append(tube(np.linspace(hook, e, 8), .0045, .0045, CHAIN, 5))
        out.append(lathe(pot, [(r * PS, y * PS) for r, y in [(.0, -.075), (.055, -.072), (.085, -.040), (.092, .0), (.080, .040), (.062, .060), (.066, .072), (.070, .080)]], COPPER, 20))
        out.append(lathe(pot + V3(0, .080 * PS, 0), [(.064 * PS, -.002), (.064 * PS, .002)], POT_IN, 20))
        out.append(lathe(pot, [(.0, -.005), (.093 * PS, -.004), (.093 * PS, .006), (.0, .007)], COPPER_HI, 20))   # a bright band
        for b, liq in ((b1, PINK), (b2, BLUE)):
            out.append(lathe(b, [(.0, -.050), (.032, -.046), (.048, -.020), (.050, .0), (.042, .020), (.0145, .040)], liq, 14))
            out.append(lathe(b + V3(0, .040, 0), [(.0145, .0), (.0145, .022), (.019, .026)], GLASS, 10))
            out.append(lathe(b + V3(0, .066, 0), [(.0125, -.004), (.0135, .016), (.0, .018)], CORK, 10))
    return out
_glb = S.glb
def glb_with_aura(path, parts):
    aV, aF, aC = S.join(aura_parts()); parts = dict(parts, aura=(aV, aF, aC, S.normals(aV, aF))); print('aura tris', len(aF), 'verts', len(aV)); return _glb(path, parts)
S.glb = glb_with_aura
if FORM == 'araeth':   # her globe: plain round, no bud points (the eyes() source draws two calyx points: drop them)
    src = S._eyes_src; a = "    for a in (0, np.pi):"; assert a in src; src = src.replace(a, "    for a in ():"); S._eyes_src = src; exec(compile(src, 'croak_eyes', 'exec'), S.__dict__)
_dec = S.decimate
def decimate(V, Fc, n):
    """the base's decimation, run again on its own result while it lands far over the target (a big belly + arms carry tiny tunnels)"""
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
if __name__ == '__main__': C.build(S, sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else (7000 if FORM != 'gulp' else 7800))
