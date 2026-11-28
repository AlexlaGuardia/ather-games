"""M244 sheet 8: MYSTOWL's four AWAKENED forms (Mystowk / Mystowelle / Mystowis / Mysteth), OWNER PREVIEW.
    MYSTAW_FORM=<mystowk|mystowelle|mystowis|mysteth> python sculpt_mystaw.py <out.glb>
Canon: CANON/world/spirits-species.md 'Named, the Athowl line' ('Mystowl (Mana): Mystowk · Mystowelle · Mystowis · Mysteth (Enigma, pure)');
art LOCKED-AFK athernyx assets/stage3/053-056 (PRIVATE, read for shape + colour, never copied here). Built like sheets 5 + 6 (m244-luminarc
tools): each starts from the LIVE Mystowl (docs/looks/m202-athowl-redo-2026-11-27/tools/sculpt_mystowl.py, imported, never edited: her egg,
her huge grey eye discs, ragged tufts, layered feather rows, gold flank glyph panels) and re-shapes her BY NAME: a new silhouette + her motif bold.
Parts: body, eyes (unlit: eyes, lids, claws, gold marks), AURA = her motif (the look's glow part; each colour rides one bone, AURA_BONE,
'near' = skinned like the nearest body vertex; rig_mystaw.py). Marks are PATTERN only: plain gold rings, blank scrolls, eye shapes (no runes)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-athowl-redo-2026-11-27/tools'))
FORM = os.environ['MYSTAW_FORM']
import owl_common as C
import sculpt_mystowl as L
from owl_common import Wing, cone, ell, su, ss, V3, C8, yrot
from sculpt_v2 import normals
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
L.FORM = FORM; L.AURA = []; L.AURA_BONE = {}
base_decals, base_head, base_classes = L.decals, L.head, L.classes
GOLD, GOLD_HI, GOLD_D = (240, 200, 90), (255, 226, 130), (196, 150, 52)

# ── builders for the aura (free 3D pieces, not laid on her) ──
def torus(c, n, R, r, col, nu=72, nv=8):
    n = nz(n); t1 = nz(np.cross(n, V3(1, 0, 0) if abs(n[0]) < .9 else V3(0, 1, 0))); t2 = np.cross(n, t1)
    u, v = np.meshgrid(np.arange(nu) / nu * 2 * np.pi, np.arange(nv) / nv * 2 * np.pi, indexing='ij'); u, v = u.ravel(), v.ravel()
    ring = np.cos(u)[:, None] * t1 + np.sin(u)[:, None] * t2; P = V3(*c) + ring * (R + r * np.cos(v))[:, None] + n * (r * np.sin(v))[:, None]
    F = np.array([f for i in range(nu) for j in range(nv) for a, b, cc, d in [(i * nv + j, i * nv + (j + 1) % nv, ((i + 1) % nu) * nv + j, ((i + 1) % nu) * nv + (j + 1) % nv)] for f in ((a, cc, d), (a, d, b))])
    f0 = F[0]; out = P[f0[0]] - (V3(*c) + ring[f0[0]] * R)
    return P, (F if np.cross(P[f0[1]] - P[f0[0]], P[f0[2]] - P[f0[0]]) @ out > 0 else F[:, ::-1]), col
def tube(Q, r0, r1, col, n=6):
    Q = np.asarray(Q, float); m = len(Q); T = np.gradient(Q, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True); rr = np.linspace(r0, r1, m); P = []
    for i in range(m):
        a = nz(np.cross(T[i], V3(0, 1, 0) if abs(T[i][1]) < .9 else V3(1, 0, 0))); b = np.cross(T[i], a)
        P += [Q[i] + rr[i] * (np.cos(q) * a + np.sin(q) * b) for q in np.arange(n) / n * 2 * np.pi]
    P = np.array(P + [Q[0], Q[-1]]); F = [f for i in range(m - 1) for j in range(n) for f in ((i * n + j, (i + 1) * n + j, (i + 1) * n + (j + 1) % n), (i * n + j, (i + 1) * n + (j + 1) % n, i * n + (j + 1) % n))]
    F += [(m * n, j, (j + 1) % n) for j in range(n)] + [(m * n + 1, (m - 1) * n + (j + 1) % n, (m - 1) * n + j) for j in range(n)]
    F = np.array(F); c = P[:m * n].reshape(m, n, 3).mean(1)
    if (np.cross(P[F[0][1]] - P[F[0][0]], P[F[0][2]] - P[F[0][0]]) @ (P[F[0][0]] - c[0])) < 0: F = F[:, ::-1]
    return P, F, col
def box(c, ax, half, col):
    """an oriented box: centre c, axes ax (3 unit vectors), half sizes"""
    c = V3(*c); A = [nz(a) * h for a, h in zip(ax, half)]; P = np.array([c + sx * A[0] + sy * A[1] + sz * A[2] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)])
    F = np.array([(0, 1, 3), (0, 3, 2), (4, 6, 7), (4, 7, 5), (0, 4, 5), (0, 5, 1), (2, 3, 7), (2, 7, 6), (0, 2, 6), (0, 6, 4), (1, 5, 7), (1, 7, 3)])
    out = [(P[f].mean(0) - c) @ np.cross(P[f[1]] - P[f[0]], P[f[2]] - P[f[0]]) for f in F]; F = np.array([f if o > 0 else f[::-1] for f, o in zip(F, out)]); return P, F, col
def scroll(c, facing, w, h, roll_r, curl, cols):
    """a BLANK scroll: a parchment sheet (bowed) between two rolls, top and bottom (no writing on it, ever)"""
    f = nz(facing); up = V3(0, 1, 0); s = nz(np.cross(up, f)); parts = []
    nu, nv = 9, 7; uu, vv = np.meshgrid(np.linspace(-1, 1, nu), np.linspace(-1, 1, nv), indexing='ij')
    P = V3(*c) + (uu * w)[..., None] * s + (vv * h)[..., None] * up + (curl * (1 - uu ** 2) + .4 * curl * vv)[..., None] * f
    P = P.reshape(-1, 3); Fq = [f_ for i in range(nu - 1) for j in range(nv - 1) for a, b, c_, d in [(i * nv + j, (i + 1) * nv + j, (i + 1) * nv + j + 1, i * nv + j + 1)] for f_ in ((a, b, c_), (a, c_, d))]
    Fq = np.array(Fq); parts += [(P + f * .004, Fq, cols[0]), (P - f * .004, Fq[:, ::-1], cols[1])]
    for sg in (1, -1):
        y = V3(*c) + up * (sg * h) + f * (curl * .0 + .4 * curl * sg)
        parts.append(tube(np.array([y - s * w * 1.12, y + s * w * 1.12]), roll_r, roll_r, cols[2], 8))
    return parts
class CWing(Wing):
    """a SPREAD wing passes beside her big head: the blade is cut back a clear gap from the head (fused, the head's turn tore the wing)"""
    def blade(s, M, grow=0): return np.maximum(Wing.blade(s, M, grow), .040 - L.head(M) - grow)
L.CWing = CWing
def classes(V, o):
    out = base_classes(V, o)
    if isinstance(L.WING, CWing): out[4] = np.full(len(V), -.05)
    return out
L.classes = classes
def add_aura(parts, bone):
    for P, F, col in parts:
        lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
        clash = [c for c, b in L.AURA_BONE.items() if b != bone and np.abs(lin(c) - lin(col)).max() <= 2]
        assert not clash, f'aura colour {col} ({bone}) is within 2 of {clash} ({L.AURA_BONE[clash[0]]}) in the stored colour: the rig picks the bone BY COLOUR'
        L.AURA.append((P, F, col)); L.AURA_BONE[tuple(col)] = bone

# ── per form: silhouette (module constants + head / trunk rebuilt by name) and the motif ──
if FORM == 'mystowk':
    # CHAMPION: fierce, broad; her wings SPREAD WIDE and raised at rest (as Voltowl's raised V, the rig's up0), primaries fingered out; heavy
    # gold talons; a violet brow gem in a gold frame; a frowning brow; behind her a HALO of plain gold rings (aura, on the chest).
    L.EGG = ((0, .345, 0), (.345, .285, .335))
    L.WING_YMAX = 1.35; L.WING_CUT = ((.24, .50, .0), .08); L.SHOULDER = ((.17, .48, .0), (.30, .53, .0), .070, .050)
    L.WING = CWing((.300, .500, .000), (.920, .780, -.060), 1.45, [(.36, 0, .40, .175, 0), (.88, .070, .26, .060, 1), (.86, .005, .30, .066, 1), (.80, -.060, .31, .064, 1),
                  (.70, -.120, .30, .058, 1), (.58, -.165, .26, .052, 1), (.46, -.190, .22, .046, 1), (.62, .080, .24, .046, 1)], bow=.050, thick=(.050, .034))
    L.BOUNDS = ((-1.02, -.03, -.42), (1.02, 1.12, .42))
    L.LM = dict(L.LM, up0=1.05, wing_x0=.24, wing_x1=.30, core=lambda A: ell(A, *L.EGG))
    L.EYE = dict(L.EYE, brow=(46, 26, 84))
    def head(M):
        d = base_head(M)
        return su(d, cone(M, (0, .80, .25), (0, .835, .265), .060, .010), .03)          # a heavier brow ridge over the beak (the frown)
    L.head = head
    def decals(o, parts):
        sv = L.EYE; base_decals(o, parts)
        # her gem: a violet diamond in a gold frame where Mystowl wears the gold third eye (drawn proud over it)
        th = np.arange(4) / 4 * 2 * np.pi + np.pi / 2
        dia = lambda k: np.c_[k * .052 * np.cos(th), .868 + k * .066 * np.sin(th)]
        o.put(parts, np.vstack([[0, .868], dia(1.0)]), [(0, 1 + i, 1 + (i + 1) % 4) for i in range(4)], GOLD, .0060)
        o.put(parts, np.vstack([[0, .868], dia(.68)]), [(0, 1 + i, 1 + (i + 1) % 4) for i in range(4)], (150, 70, 210), .0072)
        o.disc2(parts, -.010, .885, .010, (235, 210, 255), .0080, 8)
        for x, z in ((-.065, .13), (0, .155), (.065, .13)): o.claw(parts, (.140 + x * 1.1, .044, z + .022), (.140 + x * 1.25, .026, z + .070), .028, (226, 178, 64))   # heavy GOLD talons
    L.decals = decals
    def aura():
        out = [torus((0, .80, -.30), (0, 0, 1), .60, .016, GOLD), torus((0, .80, -.31), (0, 0, 1), .70, .010, GOLD_HI), torus((0, .80, -.29), (0, 0, 1), .46, .008, GOLD_D)]
        add_aura(out, 'chest')
    L.aura = aura

elif FORM == 'mystowelle':
    # VIRTUOSO: the performer, poised and upright: a taller slimmer egg, LONG swept tufts, a long fan of tail feathers under her, gold brow arcs
    # and gold chevrons down her chest; round her a ring of six BLANK floating scrolls (aura, on the chest; nothing written on them).
    L.EGG = ((0, .345, 0), (.305, .300, .300))
    L.BOUNDS = ((-.56, -.03, -.46), (.56, 1.24, .42))
    def head(M):
        d = ell(M, (0, .735, -.01), (.315, .225, .275)); DC = L.DC
        d = su(d, ell(M, DC, (.160, .158, .110), yrot(.32)), .04)
        d = ss(d, ell(M, V3(*DC) + V3(0, 0, .135) @ yrot(.32).T, (.135, .133, .045), yrot(.32)), .012)
        for a, b, ra, rb in (((.21, .85, .12), (.31, 1.16, -.02), .080, .012), ((.25, .86, .08), (.36, 1.12, -.06), .062, .006), ((.17, .87, .12), (.23, 1.10, .02), .052, .006)):
            d = su(d, cone(M, a, b, ra, rb), .03)                                                  # long swept tufts, raked back
        for a, b in (((.26, .70, .12), (.36, .64, .09)), ((.27, .77, .08), (.37, .73, .04))):
            d = su(d, cone(M, a, b, .046, .006), .025)
        b = cone(M, (0, .665, .275), (0, .600, .310), .030, .022); b = su(b, cone(M, (0, .605, .308), (0, .560, .310), .022, .004), .02)
        return su(d, b, .010)
    L.head = head
    def trunk(P, M):
        b = ell(M, *L.EGG); b = su(b, ell(M, (0, .47, .0), (.27, .17, .26)), .10)
        for x, ln in ((0, .0), (.06, .02), (.12, .05)):                                          # a long fan of tail feathers down behind her
            b = su(b, cone(M, (x * .5, .24, -.22), (x * 1.2, .05 + ln, -.40), .060, .010), .035)
        return su(b, L.feet(M), .03)
    L.trunk = trunk
    L.LM = dict(L.LM, tuft=((.21, .85, .12), (.31, 1.16, -.02)), tuftmask=lambda A: (A[:, 0] > .16) & (A[:, 1] > .86), tail1=(0, .22, -.22), tail2=(0, .14, -.31), tailtip=(0, .06, -.40),
                tailmask=lambda V: (V[:, 2] < -.25) & (V[:, 1] < .26), core=lambda A: ell(A, *L.EGG))
    def decals(o, parts):
        base_decals(o, parts)
        for sg in (1, -1):                                                                          # gold brow arcs over each eye
            q = np.linspace(0, 1, 14); o.stroke(parts, np.c_[sg * (.05 + .25 * q), .835 + .05 * np.sin(np.pi * q) - .03 * q], .014, GOLD, .0050)
        for k, y in enumerate((.43, .37, .31)):                                                     # gold chevrons down her chest
            q = np.linspace(-1, 1, 17); o.stroke(parts, np.c_[q * (.13 - .02 * k), y + .055 * np.abs(q)], .013, GOLD, .0050)
    L.decals = decals
    def aura():
        out = []
        for i, (deg, y) in enumerate(((58, .30), (112, .62), (165, .36), (-165, .66), (-112, .32), (-58, .60))):
            a = np.radians(deg); r = .80; c = (r * np.sin(a), y, r * np.cos(a) * .85 - .04)
            out += scroll(c, (np.sin(a), .0, np.cos(a)), .095, .13, .024, .035, ((246, 226, 170), (226, 200, 140), (196, 150, 70)))
        add_aura(out, 'chest')
    L.aura = aura

elif FORM == 'mystowis':
    # ACE: the diver. A compact teardrop body; LONG narrow pointed wings swept BACK and up at rest (her dive), short raked tufts; a bold GOLD
    # MASK round both eyes and across the brow (aura, on the head: it glows).
    L.EGG = ((0, .345, -.01), (.300, .270, .310))
    L.WING_YMAX = 1.30; L.WING_CUT = ((.22, .50, .0), .07); L.SHOULDER = ((.15, .48, .0), (.27, .53, -.02), .060, .045)
    L.WING = CWing((.270, .500, -.020), (.700, .900, -.520), 1.25, [(.34, 0, .40, .130, 0), (.90, .040, .32, .044, 1), (.84, -.010, .34, .046, 1), (.76, -.060, .32, .044, 1),
                  (.64, -.100, .28, .040, 1), (.52, -.125, .22, .036, 1)], bow=.040, thick=(.044, .030))
    L.BOUNDS = ((-.85, -.03, -.80), (.85, 1.14, .42))
    L.LM = dict(L.LM, up0=.95, wing_x0=.22, wing_x1=.27, core=lambda A: ell(A, *L.EGG), tuft=((.22, .84, .10), (.33, .95, -.08)), tuftmask=lambda A: (A[:, 0] > .17) & (A[:, 1] > .84))
    def head(M):
        d = ell(M, (0, .735, -.01), (.320, .215, .275)); DC = L.DC
        d = su(d, ell(M, DC, (.160, .158, .110), yrot(.32)), .04)
        d = ss(d, ell(M, V3(*DC) + V3(0, 0, .135) @ yrot(.32).T, (.135, .133, .045), yrot(.32)), .012)
        for a, b, ra, rb in (((.22, .84, .10), (.33, .95, -.08), .075, .010), ((.26, .83, .05), (.36, .90, -.10), .058, .006)):
            d = su(d, cone(M, a, b, ra, rb), .03)                                                  # short tufts raked straight back
        b = cone(M, (0, .665, .275), (0, .600, .310), .030, .022); b = su(b, cone(M, (0, .605, .308), (0, .560, .310), .022, .004), .02)
        return su(d, b, .010)
    L.head = head
    def trunk(P, M):
        b = ell(M, *L.EGG); b = su(b, ell(M, (0, .47, -.01), (.27, .16, .26)), .10)
        b = su(b, cone(P * V3(.8, 1, 1), (0, .22, -.24), (0, .16, -.42), .075, .010), .05)        # a longer pointed tail
        return su(b, L.feet(M), .03)
    L.trunk = trunk
    L.LM = dict(L.LM, tail1=(0, .20, -.26), tail2=(0, .17, -.34), tailtip=(0, .15, -.42), tailmask=lambda V: (V[:, 2] < -.28) & (V[:, 1] < .26))
    def aura():
        o = L._owl; out = []; DC = V3(*L.DC); G = (242, 196, 70)
        for sg in (1, -1):                                                                          # a ring round each eye disc + the band between, laid on her face
            a = np.linspace(0, 2 * np.pi, 33)[:-1]
            ring = lambda r: np.c_[sg * (DC[0] + r * .82 * np.cos(a)), DC[1] + .010 + r * np.sin(a)]      # x kept inside her face (past it the decal laid onto her side)
            o.ring(out, ring(.205), ring(.160), G, .0085)
        q = np.linspace(-1, 1, 9); o.stroke(out, np.c_[q * .06, .80 + .018 * (1 - q * q)], .050, G, .0090)           # the bridge over the brow
        def keep(P, F, col):
            F = F[(P[F][:, :, 2] > -.02).all(1)]; u, inv = np.unique(F, return_inverse=True); return P[u], inv.reshape(F.shape), col
        out = [keep(*x) for x in out]                    # where the face turns away (under the eye, over the crown) a laid
        add_aura(out, 'head')                                                                       # decal ran down her side to the back: keep only the face-front faces
    L.aura = aura

elif FORM == 'mysteth':
    # ENIGMA (pure): wings SPREAD broad and level, round-tipped, with EYES down both of them (gold-ringed, violet, aura on the wings: 'near');
    # a real THIRD EYE open on her brow; a long tail fan; plain gold rays fanning up behind her head (aura, on the chest).
    L.EGG = ((0, .345, 0), (.335, .285, .325))
    L.WING_YMAX = 1.0; L.WING_CUT = ((.24, .50, .0), .08); L.SHOULDER = ((.17, .48, .0), (.30, .52, .0), .070, .050)
    L.WING = CWing((.300, .500, .000), (.940, .500, -.040), 1.50, [(.40, -.02, .46, .200, 0), (.86, .080, .22, .070, 0), (.80, .150, .26, .068, 1), (.68, .190, .26, .064, 1),
                  (.56, .210, .24, .060, 1), (.44, .210, .20, .055, 1), (.92, .010, .14, .070, 0)], bow=.040, thick=(.050, .034))
    L.BOUNDS = ((-1.06, -.03, -.50), (1.06, 1.12, .42))
    L.LM = dict(L.LM, up0=.55, wing_x0=.24, wing_x1=.30, core=lambda A: ell(A, *L.EGG))
    def trunk(P, M):
        b = ell(M, *L.EGG); b = su(b, ell(M, (0, .47, .0), (.29, .17, .27)), .10)
        for x, ln in ((0, .0), (.07, .02), (.14, .05)):                                          # a long tail fan
            b = su(b, cone(M, (x * .5, .24, -.22), (x * 1.3, .05 + ln, -.44), .066, .012), .035)
        return su(b, L.feet(M), .03)
    L.trunk = trunk
    L.LM = dict(L.LM, tail1=(0, .22, -.22), tail2=(0, .14, -.33), tailtip=(0, .06, -.44), tailmask=lambda V: (V[:, 2] < -.25) & (V[:, 1] < .26))
    def aura():
        o = L._owl; out = []
        WG = L.WING; t_w = [(.30, -.10), (.44, -.12), (.58, -.10), (.72, -.07), (.40, .05), (.56, .07), (.70, .08), (.84, .04), (.52, .17)]
        for sg in (1, -1):
            for t, w in t_w:                                                                       # eyes down her wings, laid on the wing's front
                p = WG.SH + WG.WU * WG.WL * t + WG.WW * w; x, y = sg * p[0], p[1]; r = .046 - .010 * t
                a = np.linspace(0, 2 * np.pi, 21)[:-1]; el = lambda k: np.c_[x + k * r * 1.25 * np.cos(a), y + k * r * np.sin(a)]
                o.ring(out, el(1.0), el(.78), (236, 190, 76), .0070); o.put(out, np.vstack([[x, y], el(.80)]), [(0, 1 + i, 1 + (i + 1) % 20) for i in range(20)], (226, 214, 240), .0068)
                o.disc2(out, x, y, r * .55, (130, 70, 200), .0080, 14); o.disc2(out, x, y, r * .26, (44, 22, 74), .0090, 10)
        add_aura(out, 'near')
        third = []; th = np.linspace(0, 2 * np.pi, 33)[:-1]; GY = .872
        al = lambda k: np.c_[k * .085 * np.cos(th), GY + k * .052 * np.sign(np.sin(th)) * np.abs(np.sin(th)) ** 1.2]
        o.ring(third, al(1), al(.80), GOLD, .0080); o.put(third, np.vstack([[0, GY], al(.82)]), [(0, 1 + i, 1 + (i + 1) % 32) for i in range(32)], (232, 222, 246), .0078)
        o.disc2(third, 0, GY, .034, (140, 78, 214), .0090, 16); o.disc2(third, 0, GY, .016, (28, 12, 40), .0100, 10); o.disc2(third, -.012, GY + .014, .008, (255, 252, 240), .0110, 8)
        add_aura(third, 'head')
        rays = []
        for i, a in enumerate(np.linspace(-1.0, 1.0, 7)):                                       # plain gold rays fanning up behind her head
            b0 = V3(np.sin(a) * .30, .90 + np.cos(a) * .18, -.22); b1 = V3(np.sin(a) * .72, .90 + np.cos(a) * .55, -.26)
            rays.append(tube(np.array([b0, (b0 + b1) / 2, b1]), .013, .003, GOLD_HI if i % 2 else (250, 214, 104)))
        add_aura(rays, 'chest')
    L.aura = aura

# ── the aura part: built after the body (decals lay on her field), written with body + eyes ──
_glb = C.glb
def glb_with_aura(path, parts):
    L.aura(); V, Fs, Cc, o = [], [], [], 0
    for P, f, col in L.AURA: V.append(P); Fs.append(f + o); Cc.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    V, Fs, Cc = np.vstack(V), np.vstack(Fs), np.vstack(Cc); print('aura tris', len(Fs), 'verts', len(V))
    return _glb(path, dict(parts, aura=(V, Fs, Cc, normals(V, Fs))))
C.glb = glb_with_aura
_init = C.Owl.__init__
def init(s, F): _init(s, F); L._owl = s
C.Owl.__init__ = init
sys.modules['sculpt_mystaw'] = L          # rig_owl.py imports 'sculpt_' + form: it gets the re-shaped Mystowl module

if __name__ == '__main__':
    C.Owl(L).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6500)
