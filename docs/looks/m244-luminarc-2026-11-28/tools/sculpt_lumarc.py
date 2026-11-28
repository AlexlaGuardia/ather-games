"""M244 sheet 6: LUMINARC's four AWAKENED forms (Luminthar / Lumicelle / Arcet / Lumiceth), OWNER PREVIEW.
    python sculpt_lumarc.py <luminthar|lumicelle|arcet|lumiceth> <out.glb>
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' (Alex 11-28); art LOCKED-AFK athernyx assets/stage3/021-024 (PRIVATE, read
for shape + colour, never copied here). Built exactly like sheet 5 (m244-luminel-2026-11-28/tools/sculpt_lumaw.py): each starts from the LIVE
Luminarc (docs/looks/m202-luminara-line-2026-11-27/tools/sculpt_luminarc.py, imported, never edited: her icy palette, angular crowned head,
branched lightning ANTLERS, ice collar, body bolts) and re-shapes her by name: a new SILHOUETTE and her motif carried boldly.
Glow = her own body (no lantern, no sigil, no coins, no lure). Parts: body, eyes (unlit: crystals, bolts, antlers, wings), lamp, AURA = her
lamp again + her motif (the look's glow part; per-colour bone in S.AURA_BONE, the rest on S.AURA_DEFAULT; rig_lumarc.py)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-luminara-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['LUMAW_FORM']
import lum_common as C
import sculpt_luminarc as L
from lum_common import cone, ell, su, V3
from sculpt_v2 import glb, normals, cut
S = L.S; S.FORM = FORM; S.AURA_BONE = {}; S.AURA_DEFAULT = 'abd'; S.aura_parts = lambda: []; S.cloak = None; S.ghosts = None
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
base_deco = S.deco

# ── extra builders (sheet 5's) ──
def torus(c, n, R, r, col, nu=64, nv=8):
    n = nz(n); t1 = nz(np.cross(n, V3(1, 0, 0) if abs(n[0]) < .9 else V3(0, 1, 0))); t2 = np.cross(n, t1)
    u, v = np.meshgrid(np.arange(nu) / nu * 2 * np.pi, np.arange(nv) / nv * 2 * np.pi, indexing='ij'); u, v = u.ravel(), v.ravel()
    ring = np.cos(u)[:, None] * t1 + np.sin(u)[:, None] * t2; P = c + ring * (R + r * np.cos(v))[:, None] + n * (r * np.sin(v))[:, None]
    F = np.array([f for i in range(nu) for j in range(nv) for a, b, cc, d in [(i * nv + j, i * nv + (j + 1) % nv, ((i + 1) % nu) * nv + j, ((i + 1) % nu) * nv + (j + 1) % nv)] for f in ((a, cc, d), (a, d, b))])
    f0 = F[0]; out = P[f0[0]] - (c + ring[f0[0]] * R)
    return P, (F if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ out > 0 else F[:, ::-1]), col
def bolt3(a, b, n, amp, seed, up=V3(0, 0, 1)):
    """a free 3D jagged bolt from a to b (not cast on her: it stands in the air)"""
    rng = np.random.default_rng(seed); a, b = np.asarray(a, float), np.asarray(b, float); t = np.linspace(0, 1, n + 1); Q = np.outer(1 - t, a) + np.outer(t, b)
    d = nz(b - a); s1 = nz(np.cross(d, up if abs(d @ up) < .9 else V3(1, 0, 0))); s2 = np.cross(d, s1)
    off = amp * rng.uniform(-1, 1, (n + 1, 2)); off[0] = off[-1] = 0
    return Q + off[:, :1] * s1 + off[:, 1:] * s2
def jagwing(name, sx, nveins=4, wd=.0048, seed=3):
    """the base wing slab + rim, but the veins are LIGHTNING: kinked bolts out from the root that fork (VEIN colour: they ride the wing bones)"""
    R0, d, c, n, L_, W = S.WINGS[name]; O = S.wing_outline(L_, W); k = len(O); th = .0045; parts = []
    P2 = lambda st, off=0.: R0 + st[..., :1] * d + st[..., 1:] * c + off * n
    top, bot = P2(O, th), P2(O, -th); ct, cb = R0 + d * L_ * .5 + n * th, R0 + d * L_ * .5 - n * th
    P = np.vstack([top, bot, [ct], [cb]]); F = [(2 * k, i, (i + 1) % k) for i in range(k)] + [(2 * k + 1, k + (i + 1) % k, k + i) for i in range(k)]
    F += [f for i in range(k) for j in [(i + 1) % k] for f in ((i, k + i, k + j), (i, k + j, j))]; F = np.array(F)
    if np.cross(P[F[0][1]] - P[F[0][0]], P[F[0][2]] - P[F[0][0]]) @ n < 0: F = F[:, ::-1]
    parts.append((P, F, S.MEMB))
    def band(Q, col, w):
        Q = np.asarray(Q, float); T = np.gradient(Q, axis=0); B = np.c_[-T[:, 1], T[:, 0]]; B /= np.linalg.norm(B, axis=1, keepdims=True); m_ = len(Q)
        w = np.broadcast_to(np.asarray(w, float), (m_,))[:, None]
        for side in (1, -1):
            X = np.vstack([P2(Q + B * w, side * (th + .0012)), P2(Q - B * w, side * (th + .0012))]); Fv = np.array([f for i in range(m_ - 1) for f in ((i, m_ + i, m_ + i + 1), (i, m_ + i + 1, i + 1))])
            if np.cross(X[Fv[0][1]] - X[Fv[0][0]], X[Fv[0][2]] - X[Fv[0][0]]) @ (n * side) < 0: Fv = Fv[:, ::-1]
            parts.append((X, Fv, col))
    band(np.vstack([O, O[:1]]) * .985, S.RIM, .0050)
    rng = np.random.default_rng(seed + (name == 'h'))
    inside = lambda s, t: abs(t) < W * np.sin(np.pi * np.clip(s / L_, 0, 1)) ** .6 * .80
    for f in np.linspace(-.6, .6, nveins):
        s = np.linspace(.02, .90, 10) * L_; t = f * W * np.sin(np.pi * s / L_ * .92) * .75; t[2:-1] += rng.uniform(-1, 1, 7) * W * .10
        band(np.c_[s, t], S.VEIN, np.linspace(wd * 1.4, wd * .6, 10))
        j = int(rng.integers(3, 6)); s0, t0 = s[j], t[j]; s1 = s0 + L_ * .22; t1 = t0 + np.sign(f + 1e-3) * W * .32           # a fork off each bolt
        if inside(s1, t1): band(np.c_[np.linspace(s0, s1, 4), np.linspace(t0, t1, 4) + np.r_[0, W * .05, -W * .05, 0]], S.VEIN, wd * .7)
    if sx < 0: parts = [(X * V3(-1, 1, 1), Fx[:, ::-1], col) for X, Fx, col in parts]
    return parts
LEGS6 = [((.13, .40, .05), (.30, .26, .16), (.42, .02, .20)), ((.16, .36, -.04), (.38, .22, -.02), (.52, -.06, -.04)), ((.13, .32, -.12), (.32, .16, -.24), (.40, -.10, -.34))]

if FORM == 'luminthar':
    # CHAMPION: fierce, broad, armoured in ice; a wide SEGMENTED shield of an abdomen drawn to a point, SIX spurred legs splayed, and the
    # motif: BIG wings (half again Luminarc's span) veined with LIGHTNING, and live forks of lightning crackling down beneath her.
    S.TRIS = 11000; S.AC, S.AR_ = V3(0, .24, -.06), V3(.300, .270, .300); C.axis(S, (0, .92, .40)); TIP = S.AC - S.AX * .36
    S.TXR = V3(.190, .155, .160); S.BOUNDS = (V3(-.62, -.16, -.42), V3(.62, 1.02, .50))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); return su(d, cone(M, S.AC - S.AX * .14, TIP, .20, .03), .08)
    S.abdomen = abdomen
    def legs(M):
        d = None
        for a, b, c in LEGS6:
            e = su(cone(M, a, b, .042, .034), cone(M, b, c, .034, .013), .02); d = e if d is None else np.minimum(d, e)
        return d
    S.legs = legs
    ICE, ICE_D, FACE, LIMB, SEAMC, SEG = map(S.C8, ('#a9c6ea', '#86a6d6', '#dce9f8', '#7f9ccc', '#d8e8fa', '#6f8fc4'))
    base_cls = S.classes
    def classes(V):
        k = base_cls(V); M, ab, hd, tx, ar, lg = C.regions(S, V); q = S.aq(M)
        seg = np.where((ab < np.minimum(hd, tx) - .004) & (np.minimum(ar, lg) > ab), np.clip(.010 - np.abs(np.sin(q[:, 2] * 24 + .6)) * .03, -.05, .05), -.05)   # segment seams
        return k + [seg]
    S.classes = classes; S.PAL = [ICE_D, SEAMC, FACE, LIMB, SEG]
    S.MEMB, S.VEIN, S.RIM = (222, 236, 250), (250, 253, 255), (140, 176, 222)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.40, .5, .24), .88, .40), 'h': (S.WROOT['h'], *S.wdir(-.26, .5, .40), .62, .28)}
    S.wing = lambda name, sx: jagwing(name, sx, 4, .0060)
    S.LAMP_R = .22; S.LAMP_U = V3(0, -.20, 1.); S.LAMP_COLS = ((190, 232, 255), (222, 244, 255), (246, 252, 255))
    SPIKE = (150, 186, 236); S.DECO = S.DECO + [SPIKE]
    def deco():
        parts = base_deco()
        for sx in (1, -1):
            for (a, b, c) in LEGS6: parts.append(C.crystal(V3(sx * b[0], b[1], b[2]), V3(sx * .5, .9, 0), .020, .07, SPIKE, 4, .02))   # a spur on every knee
            sh = C.onsurf(S, S.AC, [(sx * .19, .52, -.02)])[0]; parts.append(C.crystal(sh, V3(sx * .8, .6, -.1), .045, .14, SPIKE, 5, .03))   # ice pauldrons
        return parts
    S.deco = deco
    FORK, FORK2 = (214, 240, 255), (246, 252, 255)
    def aura_parts():
        out = []
        for i, (a, b) in enumerate((((.10, .02, .08), (.22, -.44, .14)), ((-.12, .00, .06), (-.30, -.40, .10)), ((.30, -.04, -.10), (.72, -.34, -.12)),
                                    ((-.32, -.06, -.12), (-.74, -.30, -.06)), ((0, -.08, -.30), (.06, -.44, -.42)), ((.44, -.02, .14), (.82, -.22, .30)), ((-.44, -.04, .12), (-.80, -.24, .26)))):
            Q = bolt3(a, b, 7, .045, 11 + i); out.append(C.tube(Q, .016, .004, FORK if i % 2 else FORK2, 5))
            m = Q[3]; Q2 = bolt3(m, m + nz(np.asarray(b) - a + V3(np.sign(a[0] + 1e-3) * .4, .1, 0)) * .22, 4, .03, 30 + i); out.append(C.tube(Q2, .008, .002, FORK, 5))
        return out
    S.aura_parts = aura_parts; S.AURA_DEFAULT = 'hips'

elif FORM == 'lumicelle':
    # VIRTUOSO: the performer. Slender, upright, standing on long dancer's legs, a little curled tail, wings at her back, and the motif: a
    # big RING OF GLOWING ORBS round her whole body (ten orbs strung on a thin ring of light).
    S.TRIS = 9500; S.AC, S.AR_ = V3(0, .25, -.06), V3(.205, .200, .270); C.axis(S, (0, .95, .30)); TIP = S.AC - S.AX * .34
    S.BOUNDS = (V3(-.34, -.20, -.62), V3(.34, 1.02, .46))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); d = su(d, cone(M, S.AC - S.AX * .12, TIP, .15, .03), .08)
        return su(d, cone(M, S.AC + V3(0, -.10, -.16), V3(0, -.04, -.50), .07, .012), .05)                 # a little tail swept back
    S.abdomen = abdomen
    def legs(M):
        return su(cone(M, S.LEG[0], (.13, .16, .07), .032, .024), cone(M, (.13, .16, .07), (.12, -.12, .10), .024, .016), .015)   # long dancer's legs
    S.legs = legs
    S.MEMB, S.VEIN, S.RIM = (226, 240, 252), (250, 253, 255), (160, 192, 230)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.38, .5, .40), .56, .22), 'h': (S.WROOT['h'], *S.wdir(-.24, .5, .52), .42, .17)}
    S.LAMP_R = .18; S.LAMP_U = V3(0, -.10, 1.); S.LAMP_COLS = ((190, 232, 255), (222, 244, 255), (246, 252, 255))
    RING, ORB, ORBHI = (214, 238, 255), (176, 222, 255), (240, 250, 255)
    def aura_parts():
        c = V3(0, .40, -.06); n = nz(V3(0, .12, 1)); out = [torus(c, n, .74, .010, RING, 96, 6)]
        t1 = nz(np.cross(n, V3(0, 0, 1) if abs(n[2]) < .9 else V3(1, 0, 0))); t1 = V3(1, 0, 0); t2 = np.cross(n, t1)
        for i in range(10):
            a = i / 10 * 2 * np.pi + np.pi / 10; p = c + .74 * (np.cos(a) * t1 + np.sin(a) * t2)
            out.append(S.ball(p, V3(.105, .105, .105), ORB, 10, 16)); out.append(S.ball(p + n * .045, V3(.050, .050, .050), ORBHI, 8, 12))   # orb + its bright heart
        return out
    S.aura_parts = aura_parts; S.AURA_DEFAULT = 'hips'

elif FORM == 'arcet':
    # ACE (pure): the afterimage. A compact round racer leaning forward, swept-back wings, an ice diamond on the brow and the chest, a swept
    # tail, and the motif: TWO WHOLE COPIES OF HERSELF streaming behind her (smaller, paler, glowing), so she reads as speed standing still.
    S.TRIS = 9500; S.AC, S.AR_ = V3(0, .27, -.10), V3(.230, .220, .300); C.axis(S, (0, .74, .67)); TIP = S.AC - S.AX * .40
    S.BOUNDS = (V3(-.34, -.10, -.66), V3(.34, 1.02, .46))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); d = su(d, cone(M, S.AC - S.AX * .14, TIP, .16, .02), .08)
        return su(d, cone(M, S.AC + V3(0, -.02, -.22), V3(0, .06, -.56), .06, .010), .05)                    # a swept tail fin
    S.abdomen = abdomen
    S.MEMB, S.VEIN, S.RIM = (226, 238, 250), (250, 253, 255), (150, 184, 228)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.50, .5, .62), .58, .20), 'h': (S.WROOT['h'], *S.wdir(.05, .5, .80), .44, .15)}
    S.LAMP_R = .19; S.LAMP_U = V3(0, -.15, 1.); S.LAMP_COLS = ((190, 232, 255), (222, 244, 255), (246, 252, 255))
    GEM, GEMHI = (150, 196, 246), (228, 244, 255); S.DECO = S.DECO + [GEM, GEMHI]
    def deco():
        parts = base_deco()
        p = S.ray(S.HC, nz(V3(0, .55, .83))[None], .5)[0]; n = S.grad(p[None], 3e-3)[0]
        parts += [C.crystal(p - n * .01, n, .045, .07, GEM, 4, .02, tw=.785), C.crystal(p + n * .01, n, .016, .03, GEMHI, 4, .01, tw=.785)]   # brow diamond
        q = C.onsurf(S, S.AC, [(0, .48, .20)])[0]; m = S.grad(q[None], 3e-3)[0]; parts.append(C.crystal(q - m * .01, m, .040, .06, GEM, 4, .02, tw=.785))   # chest diamond
        return parts
    S.deco = deco
    G1, G2 = (176, 214, 250), (206, 232, 255)
    def ghosts(VV, FF, eye):
        """two whole copies of her (body decimated + wings + antlers), smaller and paler, streaming behind (they ride the hover bone: they hold
        still in the air behind her through every clip, the way an afterimage hangs)"""
        import fast_simplification as fs; bV, bF = fs.simplify(np.asarray(VV, np.float32), np.asarray(FF, np.int32), target_count=2000, agg=4); bV = bV.astype(float)
        keep = [p for p in eye if tuple(int(x) for x in p[2]) in {tuple(S.MEMB), tuple(S.VEIN), tuple(S.RIM), tuple(S.STALK)}]
        wV, wF, _ = S.join([(P, F, (0, 0, 0)) for P, F, _ in keep]); out = []
        for s, off, col in ((.80, V3(-.30, -.05, -1.00), G1), (.62, V3(-.62, -.10, -1.85), G2)):
            o = V3(0, .40, 0)
            for P, F in ((bV, bF), (wV, wF)):
                X = o + (P - o) * s + off; N = normals(X, F); sh = .78 + .22 * np.clip(.5 + .5 * N[:, 1], 0, 1)
                out.append((X, F, np.c_[np.round(255 * (np.minimum(255, np.outer(sh, col)) / 255.) ** 2.2), np.full(len(X), 255)]))   # linear, like join's
        return out
    S.ghosts = ghosts; S.AURA_DEFAULT = 'hover'

elif FORM == 'lumiceth':
    # ENIGMA: the stern one. Squat and still, her wings drawn round her as a CLOAK of ice-blue that falls past her feet in a jagged hem (the
    # wings themselves small and folded at her back), lightning running down the cloak's edges and down her glowing belly, a stern brow.
    S.TRIS = 9500; S.AC, S.AR_ = V3(0, .24, -.04), V3(.240, .230, .270); C.axis(S, (0, .96, .28)); TIP = S.AC - S.AX * .30
    S.BOUNDS = (V3(-.34, -.16, -.40), V3(.34, 1.02, .46))
    def abdomen(M):
        q = S.aq(M); d = ell(q, (0, 0, 0), S.AR_); return su(d, cone(M, S.AC - S.AX * .10, TIP, .18, .04), .08)
    S.abdomen = abdomen
    def legs(M): return su(cone(M, (.080, .20, .00), (.12, .02, .06), .030, .024), ell(M, (.125, .00, .08), (.035, .022, .040)), .012)   # short legs, feet out
    S.legs = legs
    S.MEMB, S.VEIN, S.RIM = (206, 224, 246), (246, 251, 255), (128, 160, 208)
    S.WINGS = {'f': (S.WROOT['f'], *S.wdir(.62, .2, .95), .44, .17), 'h': (S.WROOT['h'], *S.wdir(.30, .2, 1.10), .34, .13)}   # folded up + back
    S.LAMP_R = .21; S.LAMP_U = V3(0, -.05, 1.); S.LAMP_COLS = ((190, 232, 255), (222, 244, 255), (246, 252, 255))
    BROW = (52, 74, 128); S.DECO = S.DECO + [BROW]
    MOUTHL = (40, 52, 96); S.DECO = S.DECO + [MOUTHL]
    def deco():
        parts = [p for p in base_deco() if tuple(p[2]) not in (tuple(L.MOUTH), tuple(L.TONGUE))]             # no open happy mouth: a flat line
        m = S.ray(S.HC, nz(V3(0, -.42, 1))[None], .5)[0]; parts.append(C.tube(C.onsurf(S, S.HC, m + np.outer(np.linspace(-.035, .035, 5), V3(1, 0, 0))) + V3(0, 0, .004), .006, .006, MOUTHL, 5))
        for sx in (1, -1):                                                                                   # a stern brow: low inside, high out
            Q = C.onsurf(S, S.HC, np.c_[sx * np.linspace(.07, .24, 8), np.linspace(.700, .738, 8), np.full(8, .34)]); Q = Q + S.grad(Q, 3e-3) * .010
            parts.append(C.tube(Q, .014, .009, BROW, 6))
        return parts
    S.deco = deco
    CLO, CLI = (138, 172, 222), (112, 144, 198)
    def cloak():
        """her wings drawn round as a cloak: a shell from the shoulders past her feet, open at the front (wider at the hem), folds, a jagged hem.
        Two faces (outer + inner, 12 mm apart), so it reads from both sides. Returns (X, F, col) outer + inner + the param grid (for bolts)."""
        nv, nu = 26, 72; v = np.linspace(0, 1, nv); y = .64 - .90 * v; th0 = .30 + .34 * v                         # angle from the front
        P = np.zeros((nv, nu, 3)); TH = np.zeros((nv, nu))
        for i in range(nv):
            th = np.linspace(th0[i], 2 * np.pi - th0[i], nu); rx = (.140 + .260 * v[i] ** .75) * (1 + .05 * np.sin(9 * th) * v[i]); rz = (.130 + .230 * v[i] ** .75) * (1 + .05 * np.sin(9 * th) * v[i])
            yy = y[i] + (.07 * np.abs(np.sin(5 * th)) - .03) * (v[i] > .97); P[i] = np.c_[rx * np.sin(th), np.full(nu, yy), -.04 - .06 * v[i] + rz * np.cos(th)]; TH[i] = th
        idx = np.arange(nv * nu).reshape(nv, nu); F = np.array([f for i in range(nv - 1) for j in range(nu - 1) for f in ((idx[i, j], idx[i + 1, j], idx[i + 1, j + 1]), (idx[i, j], idx[i + 1, j + 1], idx[i, j + 1]))])
        X = P.reshape(-1, 3); ctr = np.c_[np.zeros(len(X)), X[:, 1], np.full(len(X), -.06)]
        if np.cross(X[F[0][1]] - X[F[0][0]], X[F[0][2]] - X[F[0][0]]) @ (X[F[0][0]] - ctr[F[0][0]]) < 0: F = F[:, ::-1]
        Nn = normals(X, F); Xi = X - Nn * .012
        return (X, F, CLO), (Xi, F[:, ::-1], CLI), P
    S.cloak = cloak
    BOLT_A, BOLT_B = (214, 240, 255), (246, 252, 255)
    def aura_parts():
        (X, F, _), _, P = cloak(); out = []; Nn = normals(X, F).reshape(P.shape)
        for k, j in enumerate((2, 8, -9, -3)):                                                               # down both front edges of the cloak
            Q = P[2:-2, j] + Nn[2:-2, j] * .010; rng = np.random.default_rng(50 + k); Q = Q + np.c_[rng.uniform(-.025, .025, len(Q)), np.zeros(len(Q)), rng.uniform(-.015, .015, len(Q))]
            out.append(C.tube(Q[::2], .011, .004, BOLT_A if k % 2 else BOLT_B, 5))
        for k, (a, b) in enumerate((((.04, .46, .22), (.10, .02, .16)), ((-.05, .44, .21), (-.09, .04, .15)))):  # down her glowing belly
            Q = C.jag(S, S.AC, V3(*a), V3(*b), 5, .03, 70 + k); Q = Q + S.grad(Q, 3e-3) * .012; out.append(C.tube(Q, .010, .004, BOLT_B, 5))
        return out
    S.aura_parts = aura_parts; S.AURA_DEFAULT = 'hips'
else:
    raise SystemExit('form?')

def finish(S_, V, F, path, eye):
    """lum_common.finish + the AURA part (her lamp again + her motif) + Lumiceth's cloak in the BODY + Arcet's copies in the aura"""
    V, F = S.refine(V, F, lambda V: (V[:, 2] > .26) & (V[:, 1] > .52), .024)
    lab = np.full(len(F), -1)
    for k in range(len(S.PAL)): V, F, lab, side = cut(V, F, lab, S.classes(V)[k]); lab = np.where(side, k, lab)
    N = S.grad(V, .006); cols = np.array([S.PAL[k] if k >= 0 else S.GOLD for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1); CC[:, :3] = CC[:, :3] * (.86 + .14 * sh[:, None])
    lP, lF, lC = C.lamp(S)
    gl = np.exp(-np.linalg.norm(VV - S.LAMP_AT, axis=1) ** 2 / .03); CC[:, :3] = np.minimum(255, CC[:, :3] * (1 + .22 * gl[:, None]) + 30 * gl[:, None])
    if S.cloak:
        for X, Fc, col in S.cloak()[:2]:
            Nc = normals(X, Fc); s2 = .82 + .18 * np.clip(.5 + .5 * Nc[:, 1], 0, 1); FF = np.vstack([FF, Fc + len(VV)]); VV = np.vstack([VV, X]); NN = np.vstack([NN, Nc])
            CC = np.vstack([CC, np.c_[np.outer(s2, col), np.full(len(X), 255)]])
    eV, eF, eC = S.join(eye); lCa = np.c_[lC, np.full(len(lC), 255)]
    mV, mF, mC = S.join(S.aura_parts()) if S.aura_parts() else (np.zeros((0, 3)), np.zeros((0, 3), int), np.zeros((0, 4)))
    aV = np.vstack([lP, mV]); aF = np.vstack([lF, mF + len(lP)]).astype(int); aC = np.vstack([lCa, mC])
    if S.ghosts:
        for X, Fg, Cg in S.ghosts(VV, FF, eye): aF = np.vstack([aF, Fg + len(aV)]); aV = np.vstack([aV, X]); aC = np.vstack([aC, Cg])
    glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)), lamp=(lP, lF, lCa, normals(lP, lF)), aura=(aV, aF, np.round(aC), normals(aV, aF))))
    print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'lamp tris', len(lF), 'aura tris', len(aF), 'verts', len(aV))
C.finish = finish
if __name__ == '__main__': C.build(S, sys.argv[2])
