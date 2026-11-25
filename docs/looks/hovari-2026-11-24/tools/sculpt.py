"""Hovari base form: a signed-distance sculpt (numpy + scipy, no art asset), the Vulnyx v2 / Noctyx route.   python sculpt.py <out.glb> [tris]
-> one closed surface -> Blender collapse (dec.py) -> crisp colour lines -> glb nodes `body` (toon), `eyes` (unlit: eyes, lids, blush, claws)
and `shimmer` (the wing-blur petals, hidden inside the wings at rest). y 0..1, +z = face, +x = her left. Reference: base-forms.md section 10 +
hovari_v2_01.png (looked at, not traced; landmarks are its pixels / 790). Mid-hover stance, wings raised as the ref holds them."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
from marching import surface
from sculpt_v2 import cone, ell, su, cut, glb, normals, V3
TRIS = 1180; LID = .07; ZW = -.085; TH = .0105; C8 = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)]); zig = lambda u, n: np.abs(((u * n) % 1) - .5) * 2
# wing: arm + seven feathers (root, tip, half width), a thin sheet in the x-y plane
SH, WR = V3(.135, .590), V3(.375, .800)
FE = [((.375, .800), (.650, .955), .042), ((.365, .785), (.640, .808), .047), ((.340, .760), (.590, .664), .048), ((.305, .725), (.506, .546), .046), ((.270, .690), (.418, .462), .046), ((.230, .650), (.330, .420), .040), ((.190, .610), (.256, .425), .036)]
FE = [(a, (a[0] + (b[0] - a[0]) * 1.18, a[1] + (b[1] - a[1]) * 1.13), w * 1.10) for a, b, w in FE]
def cone2(q, a, b, ra, rb): a, b = V3(*a), V3(*b); e = b - a; t = np.clip(((q - a) @ e) / (e @ e), 0, 1); return np.linalg.norm(q - a - t[..., None] * e, axis=-1) - (ra + (rb - ra) * t)
def feather(q, f, g=0): a, b, w = V3(*f[0]), V3(*f[1]), f[2] + g; m = a + (b - a) * .62; return su(cone2(q, a, m, w * .8, w), cone2(q, m, b, w, .020), .012)
def feathers(q): return np.stack([feather(q, f) for f in FE], -1)
def fan(D):
    s = D[..., 0]
    for i in range(1, D.shape[-1]): s = su(s, D[..., i], .024)
    return s
def web(q): return np.minimum(cone2(q, (.10, .555), (.215, .610), .055, .085), cone2(q, (.215, .610), (.345, .760), .085, .045))
def wing(M):
    out = np.full(M.shape[:-1], 9.); m = (M[..., 0] > .03) & (M[..., 1] > .36) & (M[..., 1] < 1.03) & (np.abs(M[..., 2] - ZW) < .07)
    if not m.any(): return out
    p = M[m]; q = p[:, :2]; s = fan(feathers(q)); s = su(s, web(q), .02) - .0015; d = np.maximum(s, np.abs(p[:, 2] - ZW) - TH)
    a = su(cone(p, (*SH, ZW), (*WR, ZW), .036, .024), cone(p, (*WR, ZW), (.50, .888, ZW), .024, .008), .02)
    for u, v, r in (((.20, .66), (.235, .735), .026), ((.26, .71), (.292, .770), .022)): a = su(a, cone(p, (*u, ZW), (*v, ZW), r, .003), .01)      # ragged shoulder feathers
    out[m] = su(d, a, .012); return out
# tail: three broad feathers, a thin sheet down and back
TO = V3(0, .335, -.085); TD = V3(0, -.315, -.185); TD /= np.linalg.norm(TD); TN = V3(0, TD[2], -TD[1])
TF = [((.0, .0), (.0, .395), .062), ((.04, .0), (.135, .345), .054), ((.06, .02), (.205, .250), .040)]
def tq(M): q = M - TO; return np.stack([M[..., 0], q @ TD], -1), q @ TN
def tail(M):
    out = np.full(M.shape[:-1], 9.); m = (M[..., 1] < .40) & (M[..., 2] < .03) & (M[..., 0] < .27)
    if not m.any(): return out
    q, n = tq(M[m]); s = np.minimum.reduce([feather(q, f) for f in TF]); out[m] = su(np.maximum(s, np.abs(n + 1.2 * q[:, 0] ** 2) - .011), np.abs(q[:, 0]) * 0 + cone2(np.c_[q[:, 0], n], (0, 0), (0, .001), .03, .03) + np.maximum(0, q[:, 1] - .12) + np.maximum(0, -q[:, 1]), .02); return out
BK = [V3(0, .785, .130), V3(0, .797, .275), V3(0, .862, .665)]
def beak(M): return su(cone(M, BK[0], BK[1], .064, .0265), cone(M, BK[1], BK[2], .0265, .0075), .012)
HC = V3(0, .812, 0)
TUFT = [((.0, .93, -.07), (.0, .975, -.155), .05), ((.05, .91, -.09), (.065, .945, -.180), .045), ((.10, .86, -.10), (.130, .865, -.185), .045), ((.12, .78, -.09), (.165, .755, -.172), .045), ((.06, .80, -.14), (.07, .775, -.215), .045), ((.15, .76, .02), (.205, .715, -.005), .042), ((.14, .72, .03), (.188, .660, .010), .040), ((0, .96, .0), (0, 1.003, -.06), .04)]
def head(M):
    d = ell(M, HC, (.200, .186, .190))
    for a, b, r in TUFT: d = su(d, cone(M, a, b, r, .003), .025)
    d = su(d, ell(M, (.110, .835, .095), (.07, .05, .07)), .05)                                    # a soft brow over the eye
    return d
def trunk(M):
    b = ell(M, (0, .480, .016), (.206, .240, .194)); b = su(b, ell(M, (0, .610, .02), (.165, .15, .150)), .06); b = su(b, ell(M, (0, .340, -.045), (.125, .13, .115)), .08)
    for a, c, r in (((.10, .40, .02), (.135, .315, .0), .05), ((.06, .36, .05), (.075, .262, .045), .05), ((0, .36, .05), (0, .245, .03), .05)): b = su(b, cone(M, a, c, r, .004), .03)
    b = su(b, cone(M, (0, .31, -.075), (0, .215, -.140), .085, .03), .05)
    return su(b, cone(M, (.100, .575, -.045), (.150, .600, ZW), .075, .040), .04)                      # the wing's shoulder
def thigh(M): return cone(M, (.072, .300, .060), (.078, .225, .085), .045, .016)
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); b = su(trunk(M), head(M), .055); b = su(b, thigh(M), .02)
    b = su(b, tail(M), .02); b = su(b, wing(M), .016); return su(b, beak(M), .010)

EM, TE, BL, MI, DK, YG = map(C8, ('#35a583', '#22898c', '#266a9c', '#6fd0ac', '#17606e', '#a3e6ae')); RU, CO, RD = map(C8, ('#a3083c', '#dd3a58', '#8f1d4a'))
BKC, BKL = map(C8, ('#121012', '#2c1c1a')); COV, COV2 = C8('#1b7474'), C8('#2b978c'); RB = [C8(s) for s in ('#4fb493', '#7f83c6', '#d47fb4', '#e79a7c', '#d8c471', '#8fcf8c', '#d583a4', '#c9719c')]; TP = [C8(s) for s in ('#4b5c9c', '#a566b0', '#c9788f', '#a98fd0', '#b98ad0', '#a85f95', '#9a5890')]; TL = [C8(s) for s in ('#235f72', '#4a5285', '#8a5f94', '#c28aa8')]
onw = lambda V: (np.abs(V[:, 0]) > .175) & (np.abs(V[:, 2] - ZW) < .045) & (wing(np.c_[np.abs(V[:, 0]), V[:, 1:]]) < .008)
def ont(V): M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; return (tail(M) < .008) & (V[:, 1] < .285) & (trunk(M) > .010)
def onb(V): return (V[:, 2] > .13) & (beak(V) < .006)
def wp(V):
    q = np.c_[np.abs(V[:, 0]), V[:, 1]]; D = feathers(q); k = D.argmin(1); odd = D[:, 1::2].min(1) - D[:, 0::2].min(1); al = np.zeros(len(V))
    r = np.stack([np.linalg.norm(q - V3(*f[0]), axis=1) / np.linalg.norm(V3(*f[1]) - V3(*f[0])) for f in FE], 1); al = r[np.arange(len(V)), k]
    cov = web(q) - .006 + .010 * np.sin(np.arctan2(q[:, 1] - .60, q[:, 0] - .13) * 26); return k, odd, al, np.minimum(cov, cone2(q, SH, WR, .05, .035)), q
def bt(V): x, y, z = V.T; a = np.arctan2(x, z); return z / .19 * .9 + .55 * (y - .52) + .30 * (zig(a / 6.283 + .5 + .04 * np.sin(y * 20), 7) - .5) + .16 * np.sin(y * 26 + 3 * np.sin(a * 2))
def thr(V): x, y, z = V.T; A = np.abs(x); r = 1 - np.sqrt((A / .150) ** 2 + ((y - .635) / .115) ** 2); return np.where(z > .03, (r + .30 * (zig(np.arctan2(x, y - .63) / 6.283 + .5, 13) - .5) * (y < .66)) * .1, -.05)
def belly(V): x, y, z = V.T; A = np.abs(x); r = 1 - np.sqrt((A / .105) ** 2 + ((y - .43) / .125) ** 2); return np.where(z > .03, (r + .36 * (zig(np.arctan2(x, y - .43) / 6.283 + .5, 11) - .5)) * .1, -.05)
def fields(V):
    w, t, b = onw(V), ont(V), onb(V); bd = ~w & ~t & ~b; k, odd, al, cov, q = wp(V); x, y, z = V.T; o = []
    o.append(np.where(w, cov, -.05)); o.append(np.where(w, np.maximum(odd, -cov), .05))
    for c in (.46, .88): o.append(np.where(w, np.minimum((al - c) * .2, cov), -.05))
    u, _ = tq(np.c_[np.abs(x), y, z]); o.append(np.where(t, u[:, 1] - .215, -.05)); o.append(np.where(t, u[:, 1] - .300, -.05))
    f0, f1, f2 = (feather(u, f) for f in TF); o.append(np.where(t, f1 - np.minimum(f0, f2), .05))
    o.append(np.where(z > .10, .0075 - beak(V), -.05)); o.append(np.where(b, (y - .790 - .10 * (z - .2)), .05))
    o += [np.where(bd, thr(V), -.05), np.where(bd & (thr(V) > 0), .655 - y + .02 * zig(x + .5, 22), -.05), np.where(bd & (y < .60), belly(V), -.05)]
    o += [np.where(bd, (bt(V) - c) * .08, -.05) for c in (-.55, .42)]; return o
def shade(V, N):
    """colour of a point (a face's middle); every boundary it changes on is one of the cut lines"""
    w, t, b = onw(V), ont(V), onb(V); k, odd, al, cov, q = wp(V); x, y, z = V.T; g = bt(V); C = np.where((g > .42)[:, None], EM * .55 + MI * .45, np.where((g < -.55)[:, None], BL * .6 + DK * .4, TE * .55 + EM * .45))
    # the hue shift: three bands a toon shader draws as they stand (mint-emerald to the front, teal, blue to the back)
    crown = (y > .80)[:, None] & (g > .42)[:, None]; C = np.where(crown, MI * .7 + EM * .3, C); C = np.where(((belly(V) > 0) & (y < .6))[:, None], YG * .65 + MI * .35, C)
    C = np.where((thr(V) > 0)[:, None], np.where((.655 - y + .02 * zig(x + .5, 22) > 0)[:, None], CO, RU), C)
    u, _ = tq(np.c_[np.abs(x), y, z]); f0, f1, f2 = (feather(u, f) for f in TF); i = (u[:, 1] > .215).astype(int) + (u[:, 1] > .300); i = np.where(f1 < np.minimum(f0, f2), i + 1, i); C = np.where(t[:, None], np.array(TL)[np.clip(i, 0, 3)], C)
    C = np.where(w[:, None], np.where((cov < 0)[:, None], np.where((cov < -.022)[:, None], COV, COV2), np.where((al < .46)[:, None], np.where((odd < 0)[:, None], RB[0], RB[0] * .8 + C8('#1b7474') * .2), np.where((al > .88)[:, None], np.array(TP)[k], np.array(RB)[k + 1]))), C)
    return np.where(((z > .10) & (beak(V) < .0075))[:, None], np.where((y - .790 - .10 * (z - .2) > 0)[:, None], BKC, BKL), C)

YAW = np.radians(42); EY = .797; ER = V3(.0600, .0640)
def eyes():
    parts = []; R = np.array([[np.cos(YAW), 0, np.sin(YAW)], [0, 1, 0], [-np.sin(YAW), 0, np.cos(YAW)]])       # eye frame -> model: the eye looks out at YAW
    face = lambda Q: su(head(np.stack([np.abs(Q[..., 0]), Q[..., 1], Q[..., 2]], -1)), trunk(np.stack([np.abs(Q[..., 0]), Q[..., 1], Q[..., 2]], -1)), .055)
    ff = lambda Q: face(Q @ R.T)
    def lay(X, dz):
        z = np.full(len(X), .26)
        for _ in range(80): z -= np.clip(ff(np.c_[X, z]), -.02, .02) * .7
        P = np.c_[X, z]; e = 4e-3; g = np.stack([ff(P + np.eye(3)[i] * e) - ff(P - np.eye(3)[i] * e) for i in range(3)], -1); g /= np.linalg.norm(g, axis=1, keepdims=True); return P + g * dz, g
    def add(P, F, col, back=0):
        P = P @ R.T - V3(0, 0, back); parts.append((P, F, col)); parts.append((P * V3(-1, 1, 1), F[:, ::-1], col))
    def put(X, F, col, dz, back=0, skirt=0):
        P, g = lay(np.array(X), dz); F = np.array(F); nn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]); F = F[:, ::-1] if (nn * g[F[:, 0]]).sum() < 0 else F
        if skirt: n = skirt; m = len(P) - n; P = np.vstack([P, P[-n:] - g[-n:] * .018]); k = len(P) - n; S = [f for i in range(n) for f in ((m + i, k + i, k + (i + 1) % n), (m + i, k + (i + 1) % n, m + (i + 1) % n))]; F = np.vstack([F, np.array(S)])
        add(P, F, col, back)
    def patch(pts, col, dz, rings=1, back=0, skirt=False):
        pts = np.array(pts); c = pts.mean(0); n = len(pts); X = [c]
        for r in range(1, rings + 1): X += list(c + (pts - c) * r / rings)
        F = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for r in range(rings - 1):
            a, b = 1 + r * n, 1 + (r + 1) * n
            for i in range(n): j = (i + 1) % n; F += [(a + i, b + i, b + j), (a + i, b + j, a + j)]
        put(np.array(X), F, col, dz, back, n if skirt else 0)
    th = lambda n: np.arange(n) / n * 2 * np.pi
    def oval(kx, ky, dx=0, dy=0, n=16): a = th(n); return np.c_[dx + ER[0] * kx * np.cos(a), EY + dy + ER[1] * ky * np.sin(a)]
    patch(oval(1.0, 1.0), (14, 34, 40), .006, 2, skirt=True); patch(oval(.88, .89), (176, 214, 190), .0075, 2)
    patch(oval(.80, .82), (30, 96, 104), .009, 2); patch(oval(.58, .42, 0, -.025), (70, 196, 176), .0105, 1); patch(oval(.66, .66, 0, .009), (10, 14, 20), .012, 2)
    a = th(10); patch(np.c_[.006 + .016 * np.cos(a), EY + .030 + .017 * np.sin(a)], (255, 255, 255), .0138); a = th(7)
    patch(np.c_[-.018 + .006 * np.cos(a), EY - .030 + .006 * np.sin(a)], (190, 255, 236), .0138); patch(np.c_[.020 + .005 * np.cos(a), EY - .026 + .005 * np.sin(a)], (150, 240, 220), .0138)
    patch([(-.066, EY + .040), (-.045, EY + .066), (0, EY + .078), (.045, EY + .066), (.080, EY + .046), (.046, EY + .054), (0, EY + .062), (-.043, EY + .052)], (16, 62, 72), .004)      # the lash line
    a = th(12); r = .026 * (1 + .16 * np.cos(a * 5)); patch(np.c_[.030 + 1.2 * r * np.cos(a), EY - .098 + r * .9 * np.sin(a)], (214, 70, 92), .003)                       # the cheek's blush
    patch(oval(1.10, 1.08), (54, 158, 136), .0195, 2, LID, True); q = np.linspace(-1, 1, 8); mid = np.c_[q * .046, EY - .008 - .026 * (1 - q * q)]
    X = np.vstack([mid + [0, .004], mid - np.c_[0 * q, .004 * (1 - q * q) + .001]]); put(X, [f for i in range(7) for f in ((i, 8 + i, 9 + i), (i, 9 + i, i + 1))], (12, 48, 56), .0215, LID)
    n = 4
    def tube(pts, rs, col):
        pts = [V3(*p) for p in pts]; P = []
        for i, (c, r) in enumerate(zip(pts[:-1], rs)):
            d = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]; d /= np.linalg.norm(d); e1 = np.cross(d, V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(d, e1); P += [c + r * (np.cos(t) * e1 + np.sin(t) * e2) for t in th(n)]
        P.append(pts[-1]); k = len(pts) - 1; F = [f for j in range(k - 1) for i in range(n) for f in ((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n), (j * n + i, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))] + [((k - 1) * n + i, (k - 1) * n + (i + 1) % n, k * n) for i in range(n)]
        P, F = np.array(P), np.array(F); F = F[:, ::-1] if (np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]]) * (P[F].mean(1) - P.mean(0))).sum() < 0 else F
        parts.append((P, F, col)); parts.append((P * V3(-1, 1, 1), F[:, ::-1], col))
    for dx, dz in ((-.026, .000), (0, .010), (.026, .002)): tube([(.078 + dx * .25, .226, .084), (.080 + dx, .222, .122 + dz), (.080 + dx * 1.1, .190, .138 + dz), (.080 + dx, .166, .112 + dz)], (.015, .0155, .012), (34, 36, 34))      # curled toes
    # the beak's dark skin: unlit, laid over the sculpt's own beak (the teal emissive floor lifts any dark to grey-green, as with the Vulnyx nose)
    m = 8; st = np.array([0, .10, .30, .55, .80, 1.]); ctr = np.stack([np.interp(st, [0, .30, 1], [p[k] for p in BK]) for k in range(3)], 1); ctr[0] = (0, .787, .165); rad = np.array([.0585, .0500, .0315, .0245, .0165, .0110]); t = np.arange(m) / m * 2 * np.pi + np.pi / 8
    P = np.vstack([ctr[i] + rad[i] * np.c_[np.cos(t) * (1.06 if i < 2 else 1), np.sin(t), 0 * t] for i in range(6)] + [[BK[2] + (0, 0, .012)]]); F = [f for j in range(5) for i in range(m) for f in ((j * m + i, j * m + (i + 1) % m, (j + 1) * m + (i + 1) % m), (j * m + i, (j + 1) * m + (i + 1) % m, (j + 1) * m + i))] + [(5 * m + i, 5 * m + (i + 1) % m, 6 * m) for i in range(m)]
    F = np.array(F); up = F % m; top = ((up >= 0) & (up < 4)).sum(1) >= 2; top[-m:] = np.arange(m) < 4
    lite = np.isin(np.arange(len(F)) // 2 % m, (1, 2)) & top; lite[-m:] = False
    for msk, col in ((top & ~lite, (44, 40, 46)), (lite, (72, 66, 74)), (~top, (28, 20, 22))): parts.append((P, F[msk], col))
    V, F, C, o = [], [], [], 0
    for P, f, col in parts: u_, f = np.unique(f, return_inverse=True); P = P[u_]; f = f.reshape(-1, 3); V.append(P); F.append(f + o); C.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    return np.vstack(V), np.vstack(F), np.vstack(C)
def shimmer():
    """two blur petals a wing: the wing's own outline as broad flat blades (three lobes), both faces drawn, hidden in the wing sheet at rest"""
    V, F, C, o = [], [], [], 0; W = []
    for p in range(2):
        for x in (1, -1):
            for li, idx in enumerate(((0, 1), (2, 3), (4, 5, 6))):
                a = np.mean([FE[i][0] for i in idx], 0) * .55 + SH * .45; b = np.mean([FE[i][1] for i in idx], 0); e = (b - a) * .95; n_ = V3(-e[1], e[0]); n_ /= np.linalg.norm(n_); wd = (.052, .056, .050)[li]; ts = [(0, .35), (.35, .80), (.70, .9), (.90, .5)]
                pts = [a] + [a + e * t + s * n_ * wd * 1.15 * w for t, w in ts[1:] for s in (1, -1)] + [a + e]; col = [RB[0], RB[1 + li], RB[1 + li], RB[2 + li] , RB[2 + li], RB[3 + li // 2], RB[3 + li // 2], RB[4]]
                f = [(0, 2, 1), (1, 2, 3), (2, 4, 3), (3, 4, 5), (4, 6, 5), (5, 6, 7)]
                for sd in (1, -1):
                    P = np.c_[np.array(pts), np.full(8, ZW + sd * .0004)] * V3(x, 1, 1); V.append(P); g = np.array(f); F.append((g if sd * x > 0 else g[:, ::-1]) + o); C.append(np.c_[np.clip(np.array(col) * .62 + 92, 0, 255).astype(int), np.full(8, 255)]); o += 8; W += [(p, x)] * 8
    V = np.vstack(V); F = np.vstack(F); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); return V, F, np.vstack(C)
def refine(V, F, want, mx):
    """split every edge longer than mx whose two ends are wanted (closed stays closed)"""
    V = list(V); mid = {}; w = want(np.array(V)); out = []
    def m(a, b):
        k = (min(a, b), max(a, b))
        if not (w[a] and w[b]) or np.linalg.norm(V[a] - V[b]) < mx: return None
        if k not in mid: V.append((V[a] + V[b]) / 2); mid[k] = len(V) - 1
        return mid[k]
    for a, b, c in F:
        p, q, r = m(a, b), m(b, c), m(c, a); n = sum(x is not None for x in (p, q, r))
        while n and n < 3 and (p is None or (n == 2 and q is None)): a, b, c, p, q, r = b, c, a, q, r, p
        out += [(a, b, c)] if n == 0 else [(a, p, c), (p, b, c)] if n == 1 else [(p, b, q), (a, p, q), (a, q, c)] if n == 2 else [(a, p, r), (p, b, q), (r, q, c), (p, q, r)]
    return np.array(V), np.array(out)
def finish(V, F, path):
    V, F = refine(V, F, lambda V: onw(V) & (np.abs(V[:, 0]) < .62), .085)
    lab = np.zeros(len(F), int); n = len(fields(V))
    for k in range(n): V, F, lab, _ = cut(V, F, lab, fields(V)[k])
    a = np.linalg.norm(np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]), axis=1)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    cols = np.round(shade(V[F].mean(1), None)).astype(int); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3); sh = np.clip(.80 + .16 * NN[:, 1] + .12 * NN[:, 2], .6, 1.06)[:, None]; m = ~onw(VV); CC[m, :3] = np.clip(CC[m, :3] * sh[m] + .5, 0, 255)
    eV, eF, eC = eyes(); sV, sF, sC = shimmer(); glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)), shimmer=(sV, sF, sC, normals(sV, sF)))); print('body tris', len(FF), 'verts', len(VV), 'eyes', len(eF), 'shimmer', len(sF), 'slivers', (a < 1e-7).sum())

GX = np.linspace(0, .85, 1701); GK = 1 + 1.1 * np.clip((GX - .16) / .12, 0, 1) + 0 * GX; GW = np.where(GX > .16, .16 + (GX - .16) * GK, GX)
def warp(V, back=False):
    """the wings are drawn out while the collapse runs (and put back after), so their feather outline keeps more of the triangles"""
    V = np.array(V, float); A = np.abs(V[:, 0]); x = np.interp(A, GW, GX) if back else A; k = np.interp(x, GX, GK); V[:, 0] = np.sign(V[:, 0]) * (x if back else np.interp(x, GX, GW)); V[:, 1] = .6 + (V[:, 1] - .6) * (1 / k if back else k); return V

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else TRIS
    import trimesh, subprocess, tempfile
    lo, hi, h = V3(-.7612, -.053, -.371), V3(.7612, 1.06, .71), .0058
    V, F = surface(lambda P: (lambda d: np.where(np.abs(d) < .0007, .0007, d))(field(P)), lo, hi, h); m = trimesh.Trimesh(V, F, process=False); ps = m.split(only_watertight=False); print('raw', len(F), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); print('euler', k.euler_number); T_ = tempfile.mkdtemp(); np.savez(T_ + '/i.npz', v=warp(k.vertices), f=k.faces)
    subprocess.run([os.environ.get('BLENDER', '/opt/blender/blender'), '-b', '-P', os.path.join(HERE, 'dec.py'), '--', T_ + '/i.npz', T_ + '/o.npz', str(TRIS)], stdout=subprocess.DEVNULL, check=True); d = np.load(T_ + '/o.npz'); t = trimesh.Trimesh(warp(d['v'], True), d['f'], process=False)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, 'euler', t.euler_number, t.bounds.round(3).tolist()); assert t.is_watertight and t.body_count == 1 and t.euler_number == 2
    finish(np.array(t.vertices), np.array(t.faces), OUT)
