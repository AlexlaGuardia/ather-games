"""M244 sheet 7: LUMINORE's four AWAKENED forms (Orebrak / Lumoraya / Lumorvex / Lumorun), OWNER PREVIEW.
    python sculpt_lumore.py <orebrak|lumoraya|lumorvex|lumorun> <out.glb>
Canon: CANON/world/spirits-species.md 'Named, the Luminara line' ('Luminore (Earth): Orebrak (Champion, pure) . Lumoraya . Lumorvex . Lumorun')
+ 'Luminore and Luminix lose their flight (Alex, 2026-11-28)': the second form is the waiting egg, THE AWAKENING IS THE BREAK-OUT. Art
LOCKED athernyx assets/stage3/029-032 (PRIVATE, read for shape + colour, never copied here).
Each starts from the LIVE Luminore egg (docs/looks/m202-luminara-line-2026-11-27/tools/sculpt_luminore.py, imported, never edited: her warm
brown stone, amber eyes, the CROWN of amber crystals packed in moss, the amber belly lamp) and re-shapes her by name into what broke out of
the shell: a small upright brute on two thick LEGS with two ARMS and fists (the egg had stubby feet and no arms), taller, the shell's plate
seams and hatch line gone (she is out). Glow = her own body: no lantern, no sigil, no coins, no lure.
Parts: body, eyes (unlit: crystals, moss, face lines, the chest crack), lamp, AURA = her lamp again + the broken shell + her motif
(per-colour bone in S.AURA_BONE, the rest on S.AURA_DEFAULT; rig_lumore.py)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-luminara-line-2026-11-27/tools'))
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['LUMORE_FORM']
import lum_common as C
import sculpt_luminore as L
from lum_common import cone, ell, su, V3
from sculpt_v2 import glb, normals, cut
S = L.S; S.FORM = FORM; S.AURA_BONE = {}; S.AURA_DEFAULT = 'root'; S.aura_parts = lambda: []
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
egg_deco = S.deco
HATCH = (255, 196, 84)

# ── the broken-out body: limbs (landmarks the rig reads: SHO / ELB / HND a side, HIP / KNEE / ANK / TOE a side; right side, x > 0) ──
S.HIP, S.KNEE, S.ANK, S.TOE = V3(.120, .10, .02), V3(.140, -.10, .05), V3(.140, -.25, .03), V3(.145, -.28, .10)
S.SHO, S.ELB, S.HND = V3(.265, .46, .04), V3(.350, .30, .08), V3(.365, .18, .12)
S.R_ARM, S.R_LEG, S.R_FIST = (.060, .050), (.080, .062), .066
S.BOUNDS = (V3(-.66, -.40, -.42), V3(.66, .94, .56))
def legs(M):
    a, b, c, t = S.HIP, S.KNEE, S.ANK, S.TOE; r0, r1 = S.R_LEG
    d = su(cone(M, a, b, r0, r1), cone(M, b, c, r1, r1 * .9), .03)
    return su(d, ell(M, t, (r1 * 1.15, .040, r1 * 1.45)), .03)                                        # a broad flat foot
def arms(M):
    r0, r1 = S.R_ARM
    d = su(cone(M, S.SHO, S.ELB, r0, r1), cone(M, S.ELB, S.HND, r1, r1 * .9), .025)
    return su(d, ell(M, S.HND + nz(S.HND - S.ELB) * .03, (S.R_FIST, S.R_FIST * .9, S.R_FIST)), .02)    # the fist
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = su(S.abdomen(M), S.thorax(M), .14); d = su(d, S.head(M), .16); d = su(d, legs(M), .05); return su(d, arms(M), .045)
S.legs, S.arms, S.field = legs, arms, field
# the shell is gone: no plate seams (that class never fires), a smoother stone; the hatch line and the egg's smile come off in deco()
egg_classes = S.classes
def classes(V):
    k = egg_classes(V); k[2] = np.full(len(V), -.05); return k
S.classes = classes
LIMB_SHADE = S.PAL[4]
def no_smile(parts):
    """drop the egg's hatch line and her small smile (a SEAMLIN strip under the eyes); the lid lines (above the mouth) stay"""
    out = []
    for p in parts:
        col = tuple(int(x) for x in p[2])
        if col == HATCH: continue
        if col == tuple(S.SEAMLIN) and p[0][:, 1].mean() < .615: continue
        out.append(p)
    return out
base_eyes = C.eyes
C.eyes = lambda S_: no_smile(base_eyes(S_))
MOUTH, TONGUE, FANG, BROW, LINE = (96, 30, 22), (226, 112, 96), (252, 246, 228), (58, 32, 16), (60, 30, 14)
AMBER, AMBERHI, MOSS, MOSS2 = L.AMBER, L.AMBERHI, L.MOSS, L.MOSS2
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
def back_crystals(n, seed, big=1.):
    """amber crystals down her back and shoulders (the art's ridge), cast onto her"""
    rng = np.random.default_rng(seed); out = []
    for k in range(n):
        sx = 1 if k % 2 else -1; y = .62 - .40 * (k // 2) / max(1, n // 2); q = V3(sx * rng.uniform(.14, .26), y, -.30 + rng.uniform(-.04, .04))
        p = C.onsurf(S, V3(0, y, .02), [q])[0]; m = S.grad(p[None], 3e-3)[0]
        out.append(C.crystal(p - m * .015, m + V3(0, .5, -.2), .036 * big, .10 * big, AMBER if k % 3 else AMBERHI, 4, .025, tw=k))
    return out
# ── the broken shell (aura, on the root at the ground): two open halves (stone outside, glowing amber inside), shards ──
SHELLO, SHELLI, SHELLRIM = (124, 78, 40), (255, 190, 90), (250, 214, 130)
def shell_half(c, r, up, yaw, seed, deep=1.0):
    """an open half egg: outer stone + inner glowing faces, a jagged broken rim. c = the bowl's lowest point (on the ground)"""
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
def shard(c, ax, s, col=SHELLO):
    P, F, _ = C.crystal(V3(*c), nz(ax), .055 * s, .12 * s, col, 4, .06 * s, tw=.4); return P, F, col
def two_faced(P, F, col): return [(P, F, col), (P, F[:, ::-1], col)]

if FORM == 'orebrak':
    # CHAMPION, pure Earth: the angry one. Heavier and wider (thick arms, big fists, a wide stance), a fanged roar, brows down, crystals
    # down her back; motif: amber SHELL SHARDS hanging round her where the shell burst, and PRISM LIGHT fanning out of her blazing chest.
    S.TRIS = 11000; S.AC, S.AR_ = V3(0, .30, .01), V3(.345, .330, .325)
    S.SHO, S.ELB, S.HND = V3(.285, .44, .03), V3(.400, .30, .09), V3(.420, .15, .15); S.R_ARM, S.R_FIST = (.075, .064), .082
    S.HIP, S.KNEE, S.ANK, S.TOE = V3(.150, .10, .02), V3(.190, -.10, .05), V3(.195, -.25, .03), V3(.200, -.28, .10); S.R_LEG = (.090, .070)
    S.LAMP_R = .25; S.LAMP_COLS = ((255, 176, 60), (255, 214, 110), (255, 244, 190))
    def deco():
        parts = no_smile(egg_deco()); mo, p, n = mouth_at(-.40, .052, .70)
        parts += mo + back_crystals(10, 3, 1.15)
        for sx, dx in ((1, .030), (-1, -.030), (1, .012), (-1, -.012)):                                    # four fangs, up from the lower lip + down
            up = .4 if abs(dx) > .02 else -.4
            b = p + V3(dx, -.022 if up > 0 else .016, 0) + n * .006; parts.append(C.crystal(b, V3(0, up, .3), .009, .028, FANG, 4, .004))
        parts += brows(.700, .760, .36, .016)                                                                # angry: low inside, high out
        for sx in (1, -1):                                                                                   # amber crystals on the shoulders
            q = C.onsurf(S, S.AC, [(sx * .27, .50, -.04)])[0]; parts.append(C.crystal(q, V3(sx * .7, .7, -.1), .040, .12, AMBER, 4, .03))
        return parts
    S.deco = deco
    PRISM = [(255, 120, 120), (255, 196, 96), (250, 240, 120), (130, 230, 150), (120, 190, 255), (190, 150, 255)]
    SHARDC = (176, 116, 50)
    def aura_parts():
        out = []
        for i, (a, b) in enumerate(((-.62, -.02), (.58, .02))): out += shell_half(V3(a, .002, b), .15, V3(-np.sign(a) * .35, 1, .15), 1.2 * i + .3, 4 + i, .9)
        rng = np.random.default_rng(9)
        for k, (x, y, z) in enumerate(((.58, .66, .10), (-.62, .58, .05), (.48, .92, -.05), (-.46, .96, 0), (.66, .80, -.22), (-.66, .84, -.20), (.30, .02, .40), (-.30, .02, .36))):
            if y < .1: P, F_, col = shard((x, 0, z), (rng.uniform(-1, 1), .3, rng.uniform(-1, 1)), .7); out.append((P + V3(0, S.GROUND_Y + .002 - P[:, 1].min(), 0), F_, col))            # two shards fallen on the ground
            else: out.append(shard((x, y, z), rng.uniform(-1, 1, 3), .55 + .2 * (k % 2), SHARDC))
        o = V3(.10, .27, .38)                                                                                   # prism light: six bands fanning up + out of her chest
        for k, col in enumerate(PRISM):
            d0 = nz(V3(1, .38 + .07 * k, .25)); w = nz(np.cross(d0, V3(0, 0, 1))); L_ = .70
            P = np.array([o + w * .010, o - w * .010, o + d0 * L_ - w * .055 + w * .11 * 0, o + d0 * L_ + w * .055]) + V3(0, .022 * k - .05, .004 * k)
            out += two_faced(P, np.array([(0, 1, 2), (0, 2, 3)]), col)
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {SHARDC: 'chest', **{c: 'abd' for c in PRISM}}

elif FORM == 'lumoraya':
    # VIRTUOSO: the joyful one, ARMS FLUNG OUT and up, a big open smile, the two shell halves glowing at her feet and RAYS of light behind her.
    S.TRIS = 10000
    S.SHO, S.ELB, S.HND = V3(.265, .47, .04), V3(.420, .52, .08), V3(.540, .63, .10); S.R_ARM, S.R_FIST = (.056, .046), .058
    def deco():
        parts = no_smile(egg_deco()); mo, p, n = mouth_at(-.40, .046, .45); parts += mo
        xs = np.linspace(-1, 1, 15); Q = [S.ray(V3(0, .585 + .010 * x * x, .20) + V3(0, .012 * x * x, 0), nz(V3(np.sin(x * .34), -.02, np.cos(x * .34))), .5)[0] for x in xs]
        parts.append(S.strip(np.array(Q), LINE, .0045, .0032))                                                # the wide smile line over the open mouth
        return parts + back_crystals(6, 5)
    S.deco = deco
    RAY, RAY2 = (255, 228, 150), (255, 242, 196)
    def aura_parts():
        out = []
        for i, (a, b) in enumerate(((-.50, .14), (.50, .14))): out += shell_half(V3(a, .002, b), .17, V3(-np.sign(a) * .25, 1, .25), .4 + i, 21 + i, 1.0)
        c = V3(0, .55, -.34)                                                                                  # rays fanning behind her, a sunburst
        for k in range(13):
            a = -np.pi * .10 + np.pi * 1.20 * k / 12; d = V3(np.cos(a), np.sin(a), 0); w = V3(-np.sin(a), np.cos(a), 0) * .05
            P = np.array([c + d * .50 - w * .4, c + d * .50 + w * .4, c + d * 1.02 + w, c + d * 1.02 - w])
            out += two_faced(P, np.array([(0, 1, 2), (0, 2, 3)]), RAY if k % 2 else RAY2)
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {RAY: 'chest', RAY2: 'chest'}

elif FORM == 'lumorvex':
    # ACE: the fast one, built to run (leaner, longer legs, leaning in), a startled O of a mouth with a BEAM of light blasting out of it, and
    # shell SHARDS flying off behind her as she bursts away.
    S.TRIS = 10000; S.AC, S.AR_ = V3(0, .32, -.01), V3(.300, .310, .300)
    S.HIP, S.KNEE, S.ANK, S.TOE = V3(.115, .10, .02), V3(.130, -.12, .06), V3(.130, -.28, .02), V3(.135, -.31, .09); S.R_LEG = (.072, .055)
    S.SHO, S.ELB, S.HND = V3(.255, .46, .04), V3(.340, .32, .02), V3(.350, .22, .10); S.R_ARM, S.R_FIST = (.054, .046), .058
    S.BOUNDS = (V3(-.66, -.44, -.42), V3(.66, .94, .56))
    def deco():
        parts = no_smile(egg_deco()); mo, p, n = mouth_at(-.40, .036, 1.0); S.MOUTH_AT = (p, n); return parts + mo + back_crystals(4, 7)
    S.deco = deco
    BEAM, BEAM2, SHARDC = (255, 232, 120), (255, 250, 200), (150, 96, 44)
    def aura_parts():
        p, n = S.MOUTH_AT; d = nz(n + V3(0, .95, 0)); out = []
        Q = p + np.outer(np.linspace(.01, .60, 9), d); out.append(C.tube(Q, .024, .10, BEAM, 10)); out.append(C.tube(Q[1:] + d * .01, .012, .06, BEAM2, 8))
        e = Q[-1]; t1 = nz(np.cross(d, V3(1, 0, 0))); t2 = np.cross(d, t1)                                  # the flare: spikes out of the beam's end
        for k in range(8):
            a = k / 8 * 2 * np.pi; s = np.cos(a) * t1 + np.sin(a) * t2; out.append(C.crystal(e, nz(d * .8 + s), .028, .16 + .05 * (k % 2), BEAM if k % 2 else BEAM2, 4, .02))
        rng = np.random.default_rng(3)
        for k, (x, y, z) in enumerate(((.42, .70, -.40), (.55, .46, -.55), (.30, .95, -.52), (-.42, .74, -.44), (-.54, .40, -.58), (.10, .62, -.70), (-.20, .98, -.62))):
            out.append(shard((x, y, z), rng.uniform(-1, 1, 3), .55 + .15 * (k % 3), SHARDC))
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {BEAM: 'head', BEAM2: 'head', SHARDC: 'chest'}

elif FORM == 'lumorun':
    # ENIGMA: the hushed one. Eyes closed (the rig keeps her lids shut), head bowed, a flat quiet mouth, arms hanging still at her sides, a
    # glowing CRACK running down her chest where the light breaks through, the two shell halves at her feet.
    S.TRIS = 10000; S.AC, S.AR_ = V3(0, .31, .00), V3(.335, .325, .315)
    S.SHO, S.ELB, S.HND = V3(.270, .45, .02), V3(.320, .29, .03), V3(.330, .15, .06); S.R_ARM, S.R_FIST = (.060, .052), .064
    EYE_COLS = {tuple(S.REMAP[C.EYE_LIT[k]]) for k in ('rim', 'iris', 'pupil')} | {(255, 253, 244), (255, 236, 200)}
    C.eyes = lambda S_: [p for p in no_smile(base_eyes(S_)) if tuple(int(x) for x in p[2]) not in EYE_COLS]   # her eyes are CLOSED: no open eye drawn
    def deco():
        parts = no_smile(egg_deco())
        E, n = S.eye_normal()
        for sx in (1, -1):                                                                                   # each closed eye: a soft downward arc of lashes
            Q = np.array([E + V3(x, -.018 * (1 - (x / .060) ** 2) + .004, 0) for x in np.linspace(-.060, .060, 11)]) * V3(sx, 1, 1)
            Q = C.onsurf(S, S.HC, Q); parts.append(C.tube(Q + S.grad(Q, 3e-3) * .004, .0070, .0070, LINE, 6))
        m = S.ray(S.HC, nz(V3(0, -.42, 1))[None], .5)[0]; Q = C.onsurf(S, S.HC, m + np.outer(np.linspace(-.04, .04, 7), V3(1, 0, 0)) + np.outer(np.r_[0, .004, .006, .006, .006, .004, 0], V3(0, 1, 0)))
        parts.append(C.tube(Q + S.grad(Q, 3e-3) * .004, .0055, .0055, LINE, 5))                              # a flat, quiet mouth
        return parts + back_crystals(6, 9)
    S.deco = deco
    CRACK, CRACK2 = (255, 246, 200), (255, 214, 120)
    def aura_parts():
        out = []
        for i, (a, b) in enumerate(((-.46, .14), (.46, .14))): out += shell_half(V3(a, .002, b), .15, V3(-np.sign(a) * .55, 1, .2), .9 + i, 31 + i, .85)
        Q = C.jag(S, S.AC, V3(.01, .42, .30), V3(-.01, .10, .31), 6, .028, 4); Q = Q + S.grad(Q, 3e-3) * .052           # down her chest, over the lamp
        out.append(C.tube(Q, .015, .009, CRACK, 6))
        for k, (a, b) in enumerate((((.0, .36, .30), (.10, .28, .30)), ((.0, .26, .32), (-.10, .20, .31)), ((.0, .40, .31), (-.08, .37, .30)))):
            Q2 = C.jag(S, S.AC, V3(*a), V3(*b), 3, .012, 10 + k); Q2 = Q2 + S.grad(Q2, 3e-3) * .050; out.append(C.tube(Q2, .009, .004, CRACK2, 5))
        return out
    S.aura_parts = aura_parts
    S.AURA_BONE = {CRACK: 'abd', CRACK2: 'abd'}
else:
    raise SystemExit('form?')

def finish(S_, V, F, path, eye):
    """lum_common.finish + the AURA part (her lamp again + the shell + her motif)"""
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
