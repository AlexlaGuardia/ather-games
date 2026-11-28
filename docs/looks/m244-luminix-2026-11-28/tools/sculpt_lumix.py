"""M244 sheet 9: LUMINIX's four AWAKENED forms (Lumixok / Marisse / Lumixis / Lumixeth), OWNER PREVIEW.
    python sculpt_lumix.py <lumixok|marisse|lumixis|lumixeth> <out.glb>
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' ('Luminix (Water): Lumixok . Marisse (Virtuoso, pure) . Lumixis . Lumixeth')
+ 'Luminore and Luminix lose their flight (Alex, 2026-11-28)': the second form is the waiting egg, THE AWAKENING IS THE BREAK-OUT. Art
LOCKED athernyx assets/stage3/045-048 (PRIVATE, read for shape + colour, never copied here).
Built like sheet 7 (m244-luminore-2026-11-28/tools/sculpt_lumore.py): each starts from the LIVE Luminix egg (docs/looks/m202-luminara-line-
2026-11-27/tools/sculpt_luminix.py, imported, never edited: her teal water body paler down the front, the curling crown fin, the swirls and
bubbles, dark teal eyes, the pale belly lamp) re-shaped by name into what broke out of the shell: up on two LEGS with two ARMS (hands with a
hint of fingers, or flippers), taller, the shell's plate seams and hatch line gone. Glow = her own body: no lantern, no sigil, no lure.
Parts: body, eyes (unlit: swirls, bubbles, face lines, armour, her lights), lamp, AURA = her lamp again + what lies on the ground (the broken
shell / the wave, on S.AURA_DEFAULT = 'ground', which folds away while she walks or runs: it stays where she hatched) + her motif
(per-colour bone in S.AURA_BONE; 'root' = on the ground and kept in every clip; rig_lumix.py)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-luminara-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['LUMIX_FORM']
import lum_common as C
import sculpt_luminix as L
from lum_common import cone, ell, su, V3
from sculpt_v2 import glb, normals, cut
S = L.S; S.FORM = FORM; S.AURA_BONE = {}; S.AURA_DEFAULT = 'ground'; S.aura_parts = lambda: []
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
egg_deco, egg_head, egg_abd = S.deco, S.head, S.abdomen
HATCH = L.HATCH

# ── the broken-out body: limbs (landmarks the rig reads: SHO / ELB / HND a side, HIP / KNEE / ANK / TOE a side; right side, x > 0) ──
S.HIP, S.KNEE, S.ANK, S.TOE = V3(.125, .12, .02), V3(.145, -.10, .05), V3(.145, -.27, .03), V3(.150, -.30, .10)
S.SHO, S.ELB, S.HND = V3(.255, .47, .04), V3(.340, .31, .08), V3(.355, .19, .12)
S.R_ARM, S.R_LEG, S.R_FIST = (.056, .046), (.078, .060), .056
S.HAND = 'fingers'    # 'fingers' (a fist with three finger stubs) or 'flipper' (a flat paddle)
S.BOUNDS = (V3(-.70, -.46, -.50), V3(.70, 1.16, .58))
def legs(M):
    a, b, c, t = S.HIP, S.KNEE, S.ANK, S.TOE; r0, r1 = S.R_LEG
    d = su(cone(M, a, b, r0, r1), cone(M, b, c, r1, r1 * .9), .03)
    return su(d, ell(M, t, (r1 * 1.10, .036, r1 * 1.45)), .03)                                         # a flat webbed foot
def arms(M):
    r0, r1 = S.R_ARM; ax = nz(S.HND - S.ELB)
    d = su(cone(M, S.SHO, S.ELB, r0, r1), cone(M, S.ELB, S.HND, r1, r1 * .9), .025); f = S.R_FIST; fc = S.HND + ax * .025
    if S.HAND == 'flipper': return su(d, ell(M, fc + ax * f * .5, (f * 1.05, f * 1.25, f * .42)), .03)    # a flat flipper paddle
    d = su(d, ell(M, fc, (f, f * .9, f)), .02)
    side = nz(np.cross(ax, V3(1, 0, 0))); out = nz(np.cross(side, ax))
    for k in (-1., 0., 1.):                                                                               # three finger stubs out of the fist
        b = fc + ax * f * .55 + side * k * f * .52 + out * f * .15; d = su(d, cone(M, b, b + ax * f * .62 + side * k * f * .12, f * .30, f * .20), .010)
    return d
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(S.abdomen(M), S.thorax(M), .14); d = su(d, S.head(M), .14); d = su(d, legs(M), .05); return su(d, arms(M), .045)
S.legs, S.arms, S.field = legs, arms, field
def ear_fins(M, d, big=1., dy=0.):
    """the side fins of her head (the art's pointed ear fins): flat blades swept out and back"""
    d = su(d, ell(M, (.17 + .07 * big, .69 + .03 * big + dy, .07), (.090 * big, .050 * big, .020)), .03)
    return su(d, ell(M, (.20 + .11 * big, .72 + .04 * big + dy, .04), (.065 * big, .034 * big, .017)), .03)
def crown_fin(M, d, big=1.):
    """a big flat crown fin (thin side to side) swept up and back, and a second behind it"""
    d = su(d, ell(M, (0, .84 + .04 * big, .02), (.030, .110 * big, .120 * big)), .04); d = su(d, ell(M, (0, .90 + .06 * big, -.08 * big), (.026, .090 * big, .110 * big)), .03)
    return su(d, ell(M, (0, .78, -.18), (.026, .070 * big, .100 * big)), .03)
# the shell is gone: no plate seams (that class never fires); the hatch line comes off in deco()
egg_classes = S.classes
def classes(V):
    k = egg_classes(V); k[2] = np.full(len(V), -.05); return k
S.classes = classes
KEEP_SMILE = False
def no_smile(parts):
    """drop the egg's hatch line, and her small smile (a SEAMLIN strip under the eyes) unless this form keeps it"""
    out = []
    for p in parts:
        col = tuple(int(x) for x in p[2])
        if col == tuple(HATCH): continue
        if not KEEP_SMILE and col == tuple(S.SEAMLIN) and p[0][:, 1].mean() < .615: continue
        out.append(p)
    return out
base_eyes = C.eyes
C.eyes = lambda S_: no_smile(base_eyes(S_))
MOUTH, TONGUE, FANG, BROW, LINE = (40, 22, 40), (220, 110, 120), (250, 252, 246), (22, 58, 70), (24, 56, 66)
S.DECO = S.DECO + [MOUTH, TONGUE, FANG, BROW, LINE]
def mouth_at(dn=-.42, w=.040, h=.55, tongue=True):
    p = S.ray(S.HC, nz(V3(0, dn, 1))[None], .5)[0]; n, t1, t2 = S.frame(p); out = []
    P_, F_, _ = S.disc(p, n, t1, t2, w, MOUTH, .0045, 18); P_[1:] = p + n * .0045 + (P_[1:] - p - n * .0045) * V3(1, h, 1); out.append((P_, F_, MOUTH))
    if tongue: out.append(S.disc(p - V3(0, w * .30, -.002), n, t1, t2, w * .45, TONGUE, .0060, 12))
    return out, p, n
def brows(inner_y, outer_y, z=.36, wd=.014):
    out = []
    for sx in (1, -1):
        Q = C.onsurf(S, S.HC, np.c_[sx * np.linspace(.05, .21, 8), np.linspace(inner_y, outer_y, 8), np.full(8, z)]); Q = Q + S.grad(Q, 3e-3) * .010
        out.append(C.tube(Q, wd, wd * .65, BROW, 6))
    return out
def body_lights(n, seed, col, ymax=.86):
    """small clear lights dotted over her body (cast onto her, kept off the face)"""
    rng = np.random.default_rng(seed); out = []; c = V3(0, .42, 0)
    while len(out) < n:
        u = rng.standard_normal(3); u /= np.linalg.norm(u)
        if u[2] > .45 and u[1] > .15: continue
        p = S.ray(c, u[None], 1.2)[0]
        if p[1] > ymax: continue
        r = rng.uniform(.006, .012); out.append(S.ball(p, V3(r, r, r), col, 4, 6))
    return out
# ── the broken shell (aura, at the ground): two open halves (teal outside, glowing pale aqua inside), a jagged broken rim ──
SHELLO, SHELLI, SHELLRIM = (58, 150, 164), (190, 250, 246), (230, 255, 252)
def shell_half(c, r, up, yaw, seed, deep=1.0):
    """an open half egg: outer shell + inner glowing faces, a jagged broken rim. c = the bowl's lowest point (on the ground)"""
    rng = np.random.default_rng(seed); nu, nv = 10, 40; up = nz(up); t1 = nz(np.cross(up, V3(np.sin(yaw), 0, np.cos(yaw)))); t2 = np.cross(up, t1)
    rim = np.pi / 2 * deep * (1 + .16 * np.sin(np.arange(nv) * 2.1 + seed) + .10 * rng.uniform(-1, 1, nv)); rim[::3] *= .86
    P = []
    for i in range(nu + 1):
        th = rim * i / nu; a = np.arange(nv) / nv * 2 * np.pi
        P.append((-np.cos(th))[:, None] * up + (np.sin(th) * np.cos(a))[:, None] * t1 + (np.sin(th) * np.sin(a))[:, None] * t2)
    U = np.vstack(P); ctr = c + up * r; X = ctr + U * r; Xi = ctr + U * r * .90
    F = np.array([f for i in range(nu) for j in range(nv) for a, b, cc, d in [(i * nv + j, i * nv + (j + 1) % nv, (i + 1) * nv + j, (i + 1) * nv + (j + 1) % nv)] for f in ((a, cc, d), (a, d, b))])
    f0 = F[len(F) // 2]
    if np.cross(X[f0[1]] - X[f0[0]], X[f0[2]] - X[f0[0]]) @ (X[f0[0]] - ctr) < 0: F = F[:, ::-1]
    k0 = nu * nv; Fr = np.array([f for j in range(nv) for f in ((k0 + j, k0 + (j + 1) % nv, len(X) + k0 + j), (k0 + (j + 1) % nv, len(X) + k0 + (j + 1) % nv, len(X) + k0 + j))])
    lift = V3(0, S.GROUND_Y + .002 - min(X[:, 1].min(), Xi[:, 1].min()), 0); X, Xi = X + lift, Xi + lift       # rests ON the ground (her feet's level)
    R = np.vstack([X, Xi]); Fr2 = np.vstack([Fr, Fr[:, ::-1]])
    return [(X, F, SHELLO), (Xi, F[:, ::-1], SHELLI), (R, Fr2, SHELLRIM)]
def on_ground(parts):
    lo = min(p[0][:, 1].min() for p in parts); return [(p[0] + V3(0, S.GROUND_Y + .002 - lo, 0), *p[1:]) for p in parts]
def drops(cs, rs, col):
    return [S.ball(V3(*c), V3(r, r * 1.15, r), col, 5, 8) for c, r in zip(cs, rs)]
def tendril(p0, u, L_, drop, curl, r0, r1, col, n=26, seed=0):
    """a soft trailing tendril from p0: out along u, sagging down by `drop`, its tip curling round (curl turns)"""
    t = np.linspace(0, 1, n); u = nz(u); h = nz(V3(u[0], 0, u[2])) if abs(u[1]) < .99 else V3(1, 0, 0)
    side = nz(np.cross(V3(0, 1, 0), h)); Q = p0 + np.outer(t, u * L_ * .45) + np.outer(t ** 1.4, h * L_ * .30) - np.outer(t ** 1.6, V3(0, drop, 0))
    a = curl * 2 * np.pi * np.clip((t - .72) / .28, 0, 1) ** 1.3; cr = .05 * np.clip((t - .65) / .35, 0, 1)
    Q = Q + np.outer(cr * np.sin(a), side) + np.outer(cr * (1 - np.cos(a)), V3(0, 1, 0)) + np.outer(.02 * np.sin(t * 9 + seed), side)
    return C.tube(Q, r0, r1, col, 6)
def two_faced(P, F, col): return [(P, F, col), (P, F[:, ::-1], col)]

if FORM == 'lumixok':
    # CHAMPION: the armoured one, roaring, bursting out of a WAVE. Heavier and wider (thick arms, big clawed hands, a wide stance), shell
    # armour on her shoulders + knees + a chest rim round her lamp, a big ROARING mouth with fangs, angry brows, ear fins + a bigger crown fin.
    S.TRIS = 11500; S.AC, S.AR_ = V3(0, .31, .01), V3(.355, .340, .330)
    S.SHO, S.ELB, S.HND = V3(.290, .45, .03), V3(.410, .31, .09), V3(.430, .16, .15); S.R_ARM, S.R_FIST = (.078, .066), .078
    S.HIP, S.KNEE, S.ANK, S.TOE = V3(.155, .11, .02), V3(.195, -.11, .05), V3(.200, -.27, .03), V3(.205, -.30, .10); S.R_LEG = (.094, .072)
    S.LAMP_R = .25; S.LAMP_COLS = ((150, 232, 236), (196, 246, 244), (236, 255, 250))
    def head(M):
        d = su(ell(M, S.HC, S.HR), ell(M, (0, .58, .24), (.21, .14, .17)), .06)
        return ear_fins(M, crown_fin(M, d, 1.0), 1.1, .05)
    S.head = head
    ARMOR, ARMHI, ARMRIM = (44, 118, 132), (70, 150, 160), (150, 214, 214)
    S.DECO = S.DECO + [ARMOR, ARMHI, ARMRIM]
    def plate(c, rad, col=ARMOR):
        P, F, _ = S.ball(V3(*c), V3(*rad), col, 8, 14); m = P[:, 1] > c[1] - rad[1] * .25; return P, F, col   # a dome of shell armour
    def deco():
        parts = no_smile(egg_deco()); mo, p, n = mouth_at(-.36, .070, 1.05); parts += mo
        for dx, up in ((.040, -1), (-.040, -1), (.022, 1), (-.022, 1)):                                    # four fangs, down from the top + up from the bottom
            b = p + V3(dx, .030 if up < 0 else -.034, 0) + n * .006; parts.append(C.crystal(b, V3(0, float(up), .25), .010, .032, FANG, 4, .004))
        parts += brows(.705, .770, .36, .017)
        for sx in (1, -1):
            q = V3(sx * S.SHO[0], S.SHO[1] + .07, S.SHO[2] - .01)                                          # a pauldron: two stacked shell plates + a spike
            parts.append(plate(q, (.120, .085, .115))); parts.append(plate(q + V3(sx * .05, -.06, 0), (.095, .060, .100), ARMHI))
            parts.append(C.crystal(q + V3(sx * .04, .06, -.02), V3(sx * .6, 1, -.3), .030, .10, ARMRIM, 4, .02))
            k = V3(sx * S.KNEE[0], S.KNEE[1] + .01, S.KNEE[2] + .055); parts.append(plate(k, (.070, .065, .050)))           # knee guards
        lp = S.ray(S.AC, nz(S.LAMP_U)[None], .7)[0]; nn, t1, t2 = S.frame(lp); a = np.linspace(0, 2 * np.pi, 33)
        Q = lp[None] + .26 * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2 * 1.05); Q = C.onsurf(S, S.AC, Q); parts.append(C.tube(Q + S.grad(Q, 3e-3) * .010, .016, .016, ARMRIM, 6))
        return parts
    S.deco = deco
    WAVE1, WAVE2, WAVE3, FOAM, SPRAY = (44, 140, 168), (78, 178, 198), (128, 210, 220), (236, 252, 252), (210, 246, 250)
    def aura_parts():
        out = []; ph = np.linspace(np.pi - 1.9, np.pi + 1.9, 48); H = .22 + .56 * np.cos((ph - np.pi) / 1.9 * np.pi / 2) ** 2   # the WAVE behind her
        ks = np.array([0, .25, .5, .7, .85, 1.]); kr = np.array([.34, .20, .08, 0, -.10, -.18]); ky = np.array([0, .35, .75, 1., .98, .72])   # its profile: up the back, over the crest, the lip curling at her
        sg = np.linspace(0, 1, 31); pr = np.interp(sg, ks, kr); py = np.interp(sg, ks, ky)
        for _ in range(3): pr[1:-1] = (pr[:-2] + pr[1:-1] + pr[2:]) / 3; py[1:-1] = (py[:-2] + py[1:-1] + py[2:]) / 3
        R = .60 + pr[None, :] + .03 * np.sin(ph * 7)[:, None]; G_ = np.stack([R * np.sin(ph)[:, None], py[None, :] * H[:, None], R * np.cos(ph)[:, None]], -1)
        for col, a, b in ((WAVE1, 0, 13), (WAVE2, 13, 22), (WAVE3, 22, 27), (FOAM, 27, 30)):
            P = G_[:, a:b + 1].reshape(-1, 3); m = b - a + 1
            F = np.array([f for u in range(len(ph) - 1) for v in range(m - 1) for f in ((u * m + v, (u + 1) * m + v, (u + 1) * m + v + 1), (u * m + v, (u + 1) * m + v + 1, u * m + v + 1))])
            out += two_faced(P, F, col)
        out.append(C.tube(G_[:, -1], .026, .026, FOAM, 6))                                                 # foam along the curling lip
        rng = np.random.default_rng(5)
        for k in range(16): q = G_[rng.integers(4, 44), 0]; out.append(C.blob(S, q * V3(.97, 1, .97) + V3(0, .03, 0), rng.uniform(.035, .06), FOAM, 5, 8, k))   # foam where it breaks on the ground
        rng = np.random.default_rng(4); cs = [(rng.uniform(-.7, .7), rng.uniform(.10, .95), rng.uniform(-.6, .3)) for _ in range(14)]
        cs = [c for c in cs if abs(c[0]) > .38 or c[2] < -.42]
        out = on_ground(out)
        out += drops(cs, rng.uniform(.018, .034, len(cs)), SPRAY)                                          # spray flying round her
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {SPRAY: 'chest'}

elif FORM == 'marisse':
    # VIRTUOSO, pure Water: the soft one, round and smiling, a curling crown fin, flipper arms (one flung out), her body DOTTED WITH CLEAR
    # LIGHTS, bubbles rising round her, the two shell halves at her feet.
    S.TRIS = 10000; KEEP_SMILE = True; S.HAND = 'flipper'; S.AC, S.AR_ = V3(0, .34, -.01), V3(.330, .345, .320)
    S.SHO, S.ELB, S.HND = V3(.270, .46, .04), V3(.380, .42, .12), V3(.470, .40, .20); S.R_ARM, S.R_FIST = (.060, .048), .060
    S.HIP, S.KNEE, S.ANK, S.TOE = V3(.135, .12, .04), V3(.150, -.06, .07), V3(.150, -.20, .05), V3(.155, -.23, .11); S.R_LEG = (.088, .070)
    LIGHT, LIGHT2 = (250, 255, 255), (214, 250, 255)
    S.DECO = S.DECO + [LIGHT, LIGHT2]
    def deco():
        return no_smile(egg_deco()) + body_lights(30, 11, LIGHT) + body_lights(16, 12, LIGHT2)
    S.deco = deco
    BUBA, BUBA2 = (200, 246, 255), (236, 254, 255)
    def aura_parts():
        out = []
        for i, (a, b) in enumerate(((-.52, .20), (-.30, .40))): out += shell_half(V3(a, .002, b), .15, V3(.30, 1, .25 - .3 * i), .5 + i, 41 + i, .95)
        rng = np.random.default_rng(6); cs = [(sx * rng.uniform(.40, .62), rng.uniform(.55, 1.10), rng.uniform(-.25, .25)) for sx in (1, -1) for _ in range(5)]
        out += drops(cs, rng.uniform(.016, .036, len(cs)), BUBA)
        out += drops([(c[0] - .008, c[1] + .010, c[2] + .012) for c in cs], [.006] * len(cs), BUBA2)            # each bubble's glint
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {BUBA: 'head', BUBA2: 'head'}

elif FORM == 'lumixis':
    # ACE: the dart racer, built to run: LEAN (no egg left in her), long legs and long arms with clawed fingers, a big swept crown fin + ear
    # fins, a finned TAIL, a glowing belly, a sly grin; a splash kicked up behind her heels.
    S.TRIS = 10500; S.AC, S.AR_ = V3(0, .36, -.02), V3(.225, .300, .215); C.axis(S, (0, .96, .28))
    S.HC, S.HR = V3(0, .68, .17), V3(.230, .215, .225)
    S.HIP, S.KNEE, S.ANK, S.TOE = V3(.105, .14, .00), V3(.125, -.12, .08), V3(.125, -.34, .00), V3(.130, -.37, .09); S.R_LEG = (.060, .044)
    S.SHO, S.ELB, S.HND = V3(.190, .50, .03), V3(.280, .33, .10), V3(.300, .19, .17); S.R_ARM, S.R_FIST = (.040, .032), .040
    S.LAMP_R = .17; S.BOUNDS = (V3(-.60, -.50, -.86), V3(.60, 1.18, .58))
    def thorax(M): return ell(M, (0, .50, .04), (.175, .15, .16))
    def abdomen(M):
        d = egg_abd(M); t0, t1, t2 = V3(0, .16, -.16), V3(0, .10, -.42), V3(0, .22, -.66)
        d = su(d, cone(M, t0, t1, .085, .050), .05); d = su(d, cone(M, t1, t2, .050, .020), .04)
        return su(d, ell(M, t2 + V3(0, .07, -.03), (.014, .10, .055)), .03)                                # the tail and its fin
    def head(M):
        d = su(ell(M, S.HC, S.HR), ell(M, (0, .62, .26), (.17, .11, .16)), .06)                            # a longer snout
        return ear_fins(M, crown_fin(M, d, 1.15), 1.2)
    S.thorax, S.abdomen, S.head = thorax, abdomen, head
    def deco():
        parts = no_smile(egg_deco()); xs = np.linspace(-1, 1, 13)
        Q = [S.ray(S.HC, nz(V3(np.sin(x * .40), -.40 + .10 * x * x - .05 * x, 1)), .5)[0] for x in xs]   # a wide sly grin, one corner up
        parts.append(S.strip(np.array(Q), LINE, .0045, .0035)); return parts
    S.deco = deco
    SPLASH, SPLASH2 = (150, 226, 236), (226, 252, 252)
    def aura_parts():
        out = []; rng = np.random.default_rng(8)
        for k in range(9):                                                                                 # a splash kicked up behind her heels
            a = -1.1 + 2.2 * k / 8; base = V3(.12 * np.sin(a), 0, -.28 + .05 * np.cos(a)); d = nz(V3(.55 * np.sin(a), 1, -.55))
            out.append(C.crystal(base, d, .022, .22 + .10 * (k % 3), SPLASH if k % 2 else SPLASH2, 4, .02, tw=k))
        out = on_ground(out); out += drops([(rng.uniform(-.25, .25), rng.uniform(.25, .45), rng.uniform(-.65, -.40)) for _ in range(6)], rng.uniform(.012, .022, 6), SPLASH2)
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {SPLASH: 'root', SPLASH2: 'root'}

elif FORM == 'lumixeth':
    # ENIGMA: the drifting one. Round and calm, a small smile, little flippers at her sides, and LONG TRAILING TENDRILS falling from her
    # crown and sides down to the ground, curling at their ends (pale lilac-blue water).
    S.TRIS = 10000; KEEP_SMILE = True; S.HAND = 'flipper'; S.AC, S.AR_ = V3(0, .35, -.01), V3(.320, .335, .310)
    S.SHO, S.ELB, S.HND = V3(.270, .44, .03), V3(.330, .32, .07), V3(.350, .23, .10); S.R_ARM, S.R_FIST = (.054, .044), .052
    S.HIP, S.KNEE, S.ANK, S.TOE = V3(.130, .12, .03), V3(.145, -.08, .05), V3(.145, -.22, .03), V3(.150, -.25, .10); S.R_LEG = (.080, .062)
    def deco(): return no_smile(egg_deco())
    S.deco = deco
    TEND, TEND2, TEND3 = (150, 170, 228), (120, 206, 222), (190, 196, 240)
    def aura_parts():
        out = []
        for k in range(18):                                                                                # from her crown: out and down to the ground
            az = np.pi * (-1 + 2 * (k + .5) / 18) * .92; el = .55 + .25 * (k % 2); u = V3(np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el) - .25)
            p0 = S.ray(S.HC, nz(u)[None], .6)[0] - nz(u) * .01; L_ = .55 + .12 * (k % 3); dr = p0[1] - (S.GROUND_Y + .07 + .04 * (k % 2))
            out.append(tendril(p0, u, L_, dr, 1.2 + .2 * (k % 2), .030, .008, (TEND, TEND2, TEND3)[k % 3], 30, k))
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {TEND: 'head', TEND2: 'head', TEND3: 'head'}
else:
    raise SystemExit('form?')

def finish(S_, V, F, path, eye):
    """lum_common.finish + the AURA part (her lamp again + what lies on the ground + her motif)"""
    V, F = S.refine(V, F, lambda V: (V[:, 2] > .26) & (V[:, 1] > .52), .024)
    lab = np.full(len(F), -1)
    for k in range(len(S.PAL)): V, F, lab, side = cut(V, F, lab, S.classes(V)[k]); lab = np.where(side, k, lab)
    N = S.grad(V, .006); cols = np.array([S.PAL[k] if k >= 0 else S.GOLD for k in lab]); key, inv = np.unique(np.c_[F.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN = V[key[:, 0]], N[key[:, 0]]; CC = np.c_[key[:, 1:], np.full(len(key), 255)].astype(float); FF = inv.reshape(-1, 3)
    sh = np.clip(.5 + .5 * NN[:, 1], 0, 1); CC[:, :3] = CC[:, :3] * (.86 + .14 * sh[:, None])
    lP, lF, lC = C.lamp(S)
    gl = np.exp(-np.linalg.norm(VV - S.LAMP_AT, axis=1) ** 2 / .03); CC[:, :3] = np.minimum(255, CC[:, :3] * (1 + .22 * gl[:, None]) + 30 * gl[:, None])
    eV, eF, eC = S.join(eye); lCa = np.c_[lC, np.full(len(lC), 255)]
    S.GROUND_Y = float(VV[:, 1].min())   # her feet's level: the shell lies there (the rig puts it at y = 0)
    mV, mF, mC = S.join(S.aura_parts())
    aV = np.vstack([lP, mV]); aF = np.vstack([lF, mF + len(lP)]).astype(int); aC = np.vstack([lCa, mC])
    glb(path, dict(body=(VV, FF, np.round(CC), NN), eyes=(eV, eF, eC, normals(eV, eF)), lamp=(lP, lF, lCa, normals(lP, lF)), aura=(aV, aF, np.round(aC), normals(aV, aF))))
    print('body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'lamp tris', len(lF), 'aura tris', len(aF), 'verts', len(aV))
C.finish = finish
if __name__ == '__main__': C.build(S, sys.argv[2])
