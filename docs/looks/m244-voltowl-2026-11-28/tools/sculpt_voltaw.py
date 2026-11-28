"""M244 sheet 10: VOLTOWL's four AWAKENED forms (Voltowrak / Voltowaya / Voltwis / Voltoweth), OWNER PREVIEW.
    VOLTAW_FORM=<voltowrak|voltowaya|voltwis|voltoweth> python sculpt_voltaw.py <out.glb> [tris]
Canon: CANON/world/spirits-species.md 'Named, the Athowl line' ('Voltowl (Storm): Voltowrak · Voltowaya · Voltwis (Ace, pure) · Voltoweth');
art LOCKED athernyx assets/stage3/065-068 (PRIVATE, read for shape + colour, never copied here). Built like sheet 8 (m244-mystowl tools): each
starts from the LIVE Voltowl (docs/looks/m202-athowl-redo-2026-11-27/tools/sculpt_voltowl.py, imported, never edited: her round pale-blue body,
white face, frowning brow, violet brow crystal, cyan-blue eyes, fan of pointed tail feathers, lightning veins) and re-shapes her BY NAME.
Sheet 8's spread-wing fix is reused: the blade is cut a clear gap from the head (CWing) and rig_voltaw.py re-skins wing verts the head mask took.
Parts: body, eyes (unlit: eyes, lids, claws, gem, veins), AURA = her motif (the look's glow part; each colour rides one bone, AURA_BONE;
'near' = skinned like the nearest body vertex; 'root' = rides the root, level under / round her whatever her body does)."""
import sys, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(HERE, '../../m202-athowl-redo-2026-11-27/tools'))
FORM = os.environ['VOLTAW_FORM']
import owl_common as C
import sculpt_voltowl as L
from owl_common import Wing, cone, ell, su, ss, V3, C8, yrot, zig
from sculpt_v2 import normals
nz = lambda v: np.asarray(v, float) / np.linalg.norm(v)
L.FORM = FORM; L.AURA = []; L.AURA_BONE = {}
base_head, base_classes = L.head, L.classes
BOLT, BOLT_HI, CRY_A = (214, 246, 255), (246, 252, 255), (168, 214, 255)

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
RNG = np.random.default_rng(65)
FLOOR = .085     # no aura under this (glb): the perch / sleep drop the root ~.06 and the hop dips it .03, and nothing may go under the ground
def bolt(a, b, segs, jag, r0, r1, col, branches=0, depth=0):
    """a lightning bolt a -> b: a zigzag polyline (seeded jitter across the line), tapering; side branches fork off it"""
    a, b = V3(*a), V3(*b); d = b - a; L_ = np.linalg.norm(d); u = d / L_; s1 = nz(np.cross(u, V3(0, 1, 0) if abs(u[1]) < .9 else V3(1, 0, 0))); s2 = np.cross(u, s1)
    t = np.linspace(0, 1, segs + 1); off = RNG.uniform(-1, 1, (segs + 1, 2)) * jag * L_; off[0] = off[-1] = 0
    Q = a + t[:, None] * d + off[:, :1] * s1 + off[:, 1:] * s2; Q[:, 1] = np.maximum(Q[:, 1], FLOOR); out = []
    Qd = np.vstack([np.linspace(Q[i], Q[i + 1], 3)[:-1] for i in range(segs)] + [Q[-1:]])     # sharp corners: a tube needs a few points a leg
    out.append(tube(Qd, r0, r1, col, 5))
    for k in range(branches):
        i = RNG.integers(1, segs); rr = r0 + (r1 - r0) * i / segs; dirn = nz(u + RNG.uniform(-.9, .9) * s1 + RNG.uniform(-.9, .9) * s2)
        out += bolt(Q[i], Q[i] + dirn * L_ * RNG.uniform(.25, .4), max(2, segs // 2), jag, rr * .8, r1 * .6, col, 0, depth + 1)
    return out
def ribbon(Q, w, col, up=(0, 1, 0)):
    """a flat glowing ribbon along a path (both faces), width w (scalar or per point)"""
    Q = np.asarray(Q, float); m = len(Q); T = np.gradient(Q, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True); ww = np.full(m, w) if np.ndim(w) == 0 else np.asarray(w)
    S = np.cross(T, V3(*up)); S /= np.maximum(np.linalg.norm(S, axis=1, keepdims=True), 1e-9); P = np.vstack([Q + S * ww[:, None] / 2, Q - S * ww[:, None] / 2])
    F = np.array([f for i in range(m - 1) for f in ((i, m + i, m + i + 1), (i, m + i + 1, i + 1))]); return [(P, F, col), (P.copy(), F[:, ::-1], col)]
class CWing(Wing):
    """sheet 8: a SPREAD wing passes beside her head: the blade is cut back a clear gap from it (fused, the head's turn tore the wing)"""
    def blade(s, M, grow=0): return np.maximum(Wing.blade(s, M, grow), .040 - L.head(M) - grow)
L.CWing = CWing
L.HEADX = .30                   # rig_voltaw: past this |x| nothing is head (Voltowl's head is .255 wide + tufts to .215)
def classes(V, o):
    out = base_classes(V, o)
    if isinstance(L.WING, CWing):
        # sheet 8's PALE STRIP under each spread wing root: the white-breast class reached up the body side under the blade's root and the
        # pale plumage lip ran along the cut. Here the breast stays a front panel (|x| < .16) and no feather-row lip sits within .06 of the blade.
        x, y, z = V.T; M = np.c_[np.abs(x), y, z]; near = L.WING.blade(M) < .06
        out[2] = np.where(np.abs(x) < .16, out[2], -.05); out[3] = np.where(near, -.05, out[3]); out[4] = np.where(near, -.05, out[4])
    return out
L.classes = classes
def add_aura(parts, bone):
    for P, F, col in parts:
        lin = lambda c: np.round(255 * (np.array(c) / 255.) ** 2.2)
        clash = [c for c, b in L.AURA_BONE.items() if b != bone and np.abs(lin(c) - lin(col)).max() <= 2]
        assert not clash, f'aura colour {col} ({bone}) is within 2 of {clash} ({L.AURA_BONE[clash[0]]}) in the stored colour: the rig picks the bone BY COLOUR'
        L.AURA.append((P, F, col)); L.AURA_BONE[tuple(col)] = bone
def decals(o, parts, talon=(70, 76, 92), tr=.016, gem=1.0, chest_gem=False):
    """Voltowl's own decals (her violet brow crystal, breast lightning veins, talons), with the talon colour / size and gem size by form"""
    GY = .835; g = gem
    o.put(parts, [(0, GY + .045 * g), (.022 * g, GY), (0, GY - .040 * g), (-.022 * g, GY), (0, GY)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (180, 150, 255), .006)
    o.put(parts, [(0, GY + .030 * g), (.010 * g, GY + .004), (0, GY - .010 * g), (-.010 * g, GY + .004), (0, GY + .006)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (236, 224, 255), .009)
    if chest_gem:                                                                                  # Voltoweth: a second violet crystal on her breast (her art)
        cy = .40; o.put(parts, [(0, cy + .055), (.026, cy), (0, cy - .050), (-.026, cy), (0, cy)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (170, 130, 250), .006)
        o.put(parts, [(0, cy + .034), (.011, cy + .004), (0, cy - .012), (-.011, cy + .004), (0, cy + .006)], [(4, 0, 1), (4, 1, 2), (4, 2, 3), (4, 3, 0)], (236, 224, 255), .009)
    else:
        for sg in (1, -1):
            o.stroke(parts, [(sg * .03, .45), (sg * .07, .40), (sg * .05, .35), (sg * .10, .29), (sg * .08, .24)], .008, (236, 246, 255), .004)
            o.stroke(parts, [(sg * .05, .35), (sg * .015, .31), (sg * .03, .26)], .006, (236, 246, 255), .004)
    for x, z in ((-.042, .095), (0, .115), (.042, .095)): o.claw(parts, (.095 + x * 1.1, .034, z + .016), (.095 + x * 1.2, .005, z + .046), tr, talon)
def spread(SH, TIP, ang, feath, cut, shoulder, up0, ymax, bounds, x0=.20, x1=.25, bow=.046, thick=(.054, .036)):
    L.WING = CWing(SH, TIP, ang, feath, bow=bow, thick=thick); L.WING_CUT = cut; L.SHOULDER = shoulder; L.WING_YMAX = ymax; L.BOUNDS = bounds
    L.LM = dict(L.LM, up0=up0, wing_x0=x0, wing_x1=x1)

# ── per form: silhouette + motif ──
if FORM == 'voltowrak':
    # CHAMPION: storm-armoured, wings SPREAD WIDE and raised (her V, bigger), jagged pointed primaries, a heavier frowning brow, gold talons;
    # aura: a crackling crest of bolts up off her crown (head), ice-crystal armour shards on her shoulders + wing roots ('near'), lightning
    # forking below her to the ground (root: it stays level under her).
    L.BALL = ((0, .345, .0), (.300, .265, .280))
    spread((.255, .515, .0), (.930, .900, -.060), 1.45, [(.34, 0, .40, .175, 0), (.88, .070, .27, .060, 1), (.88, .005, .31, .066, 1), (.82, -.060, .32, .064, 1),
           (.72, -.120, .31, .058, 1), (.60, -.165, .27, .052, 1), (.48, -.195, .23, .046, 1), (.36, -.205, .18, .040, 1), (.64, .085, .25, .046, 1)],
           ((.21, .50, .0), .075), ((.14, .49, .0), (.25, .53, .0), .060, .045), 1.05, 1.40, ((-1.02, -.03, -.40), (1.02, 1.16, .42)))
    def head(M):
        return su(base_head(M), cone(M, (0, .79, .20), (0, .825, .215), .055, .010), .03)   # a heavier brow ridge over the beak (the frown)
    L.head = head
    L.decals = lambda o, parts: decals(o, parts, talon=(214, 168, 60), tr=.022)
    def aura():
        crest = []
        for i, (x, h, lean) in enumerate(((0, .30, 0), (.05, .22, .5), (-.05, .22, -.5), (.10, .14, .9), (-.10, .14, -.9))):   # crackling crest over her crown
            crest += bolt((x * .8, .86, .10 - abs(x) * .3), (x + lean * .10, .86 + h, .02 - abs(x) * .5), 4, .10, .022, .004, BOLT_HI)
        add_aura(crest, 'head')
        shards = []
        for sg in (1, -1):                                                                            # ice-crystal armour along her wing root + shoulder
            for k, (t, w, ln) in enumerate(((.10, .06, .13), (.20, .09, .15), (.30, .10, .13), (.16, -.05, .11), (.27, -.03, .10))):
                p = L.WING.SH + L.WING.WU * L.WING.WL * t + L.WING.WW * w; p = p * V3(sg, 1, 1) + V3(0, 0, .045)
                d = nz((L.WING.WW * .8 + L.WING.WU * .5) * V3(sg, 1, 1) + V3(0, 0, .25))
                P = np.array([p + d * ln] + [p + .022 * (np.cos(q) * nz(np.cross(d, V3(0, 0, 1))) + np.sin(q) * V3(0, 0, 1)) for q in np.arange(4) / 4 * 2 * np.pi] + [p - d * .02])
                Fc = np.array([(0, 1 + i, 1 + (i + 1) % 4) for i in range(4)] + [(5, 1 + (i + 1) % 4, 1 + i) for i in range(4)]); c = P.mean(0)
                Fc = np.array([f if (np.cross(P[f[1]] - P[f[0]], P[f[2]] - P[f[0]]) @ (P[f].mean(0) - c)) > 0 else f[::-1] for f in Fc]); shards.append((P, Fc, CRY_A))
        add_aura(shards, 'near')
        below = []
        for a in np.radians((20, 95, 160, 220, 300)):                                               # lightning forking from under her down to the ground
            r = RNG.uniform(.42, .62); below += bolt((.03 * np.cos(a), .16, .03 * np.sin(a)), (r * np.cos(a), FLOOR, r * np.sin(a) * .8), 6, .05, .013, .003, BOLT, 1)
        add_aura(below, 'root')
    L.aura = aura

elif FORM == 'voltowaya':
    # VIRTUOSO: the conductor. A taller, rounder pale-blue body on her short legs, wings raised HIGH and open (arms up, conducting), small horn
    # tufts; aura: a lightning RIBBON in a figure-eight round her (root) and a bright line along each wing's leading edge to the tip ('near').
    L.BALL = ((0, .345, .0), (.280, .275, .262))
    spread((.250, .520, .0), (.640, 1.12, -.050), 1.40, [(.34, 0, .40, .150, 0), (.86, .060, .26, .052, 1), (.86, .000, .29, .058, 1), (.80, -.060, .30, .058, 1),
           (.70, -.112, .29, .052, 1), (.58, -.148, .25, .046, 1), (.46, -.166, .21, .040, 1), (.62, .072, .23, .042, 1)],
           ((.21, .50, .0), .072), ((.14, .49, .0), (.245, .53, .0), .058, .042), 1.20, 1.50, ((-.74, -.03, -.36), (.74, 1.34, .42)))
    L.decals = lambda o, parts: decals(o, parts)
    def aura():
        t = np.linspace(0, 2 * np.pi, 160)[:-1]; t = np.r_[t, t[:1]]; ax, az = .78, .46
        Q = np.c_[ax * np.sin(t), .62 + .30 * np.sin(2 * t), -.16 - .16 * np.cos(t) ** 2]       # a figure-eight up behind her through her wings, the cross behind her neck
        Q[:, :] += np.c_[0 * t, .010 * np.sin(23 * t), .010 * np.cos(17 * t)]           # crackle
        rib = ribbon(Q, .050 + .016 * np.sin(5 * t) ** 2, BOLT, up=(0, 0, 1)); rib += [tube(Q, .006, .006, BOLT_HI, 4)]
        add_aura(rib, 'root')
        edge = []
        for sg in (1, -1):                                                                          # the bright leading edge, out to the tip, trailing on
            WG = L.WING; u = np.linspace(.18, 1.08, 26); w = WG.WW[None] * (.13 * np.clip(1 - u, 0, 1) + .03)[:, None]
            Q = (WG.SH + WG.WU[None] * WG.WL * u[:, None] + w * (u[:, None] < 2)) * V3(sg, 1, 1) + V3(0, 0, .03)
            Q[:, 0] += sg * .02 * np.sin(u * 30); edge.append(tube(Q, .009, .003, (200, 238, 255), 5))
        add_aura(edge, 'near')
    L.aura = aura

elif FORM == 'voltwis':
    # ACE (pure Storm): a lean DIVING falcon of an owl: a slim teardrop body, a smaller head with short swept tufts, long narrow pointed
    # wings swept back + up at rest (the dive), a long pointed tail; aura: a straight SPEAR of lightning she rides inside (root), slanting
    # up behind her, with crackle off it.
    L.BALL = ((0, .350, -.02), (.230, .255, .300))
    spread((.215, .510, -.020), (.640, .930, -.560), 1.25, [(.34, 0, .40, .120, 0), (.90, .040, .32, .042, 1), (.84, -.010, .34, .044, 1), (.76, -.058, .32, .042, 1),
           (.64, -.096, .28, .038, 1), (.52, -.120, .22, .034, 1)],
           ((.19, .50, .0), .065), ((.12, .49, .0), (.215, .52, -.02), .052, .040), .95, 1.30, ((-.80, -.03, -.80), (.80, 1.10, .40)), x0=.18, x1=.215, bow=.040, thick=(.046, .032))
    def head(M):
        d = ell(M, (0, .690, -.005), (.225, .175, .215)); DC = L.DC
        d = su(d, ell(M, DC, (.100, .096, .082), yrot(.30)), .035)
        d = ss(d, ell(M, V3(*DC) + V3(0, 0, .094) @ yrot(.30).T, (.086, .082, .028), yrot(.30)), .010)
        d = su(d, cone(M, (.15, .79, .05), (.21, .84, -.06), .055, .004), .03)                    # short tufts swept straight back
        d = su(d, cone(M, (.0, .83, .13), (.0, .87, .08), .045, .004), .03)
        b = cone(M, (0, .640, .205), (0, .585, .238), .026, .018); b = su(b, cone(M, (0, .590, .236), (0, .548, .228), .018, .003), .02)   # a sharper hooked beak
        return su(d, b, .010)
    L.head = head; L.DC = (.100, .672, .162); L.EYE = dict(L.EYE, c=L.DC, r=.062)
    def trunk(P, M):
        b = ell(M, *L.BALL); b = su(b, ell(M, (0, .47, -.01), (.19, .13, .20)), .08)
        b = su(b, cone(P * V3(.7, 1, 1), (0, .24, -.24), (0, .17, -.50), .070, .008), .05)        # a long pointed tail
        return su(b, L.feet(M), .03)
    L.trunk = trunk
    L.LM = dict(L.LM, tuft=((.15, .79, .05), (.21, .84, -.06)), tuftmask=lambda A: (A[:, 0] > .13) & (A[:, 1] > .78), lids=(0, .665, .15),
                tail1=(0, .22, -.28), tail2=(0, .19, -.38), tailtip=(0, .17, -.50), tailmask=lambda V: (V[:, 2] < -.28) & (V[:, 1] < .28), core=lambda A: ell(A, *L.BALL))
    L.decals = lambda o, parts: decals(o, parts, talon=(60, 66, 84))
    def aura():
        a, b = V3(-.62, .10, -.42), V3(.70, 1.46, -.42); u = nz(b - a); n = 40; t = np.linspace(0, 1, n)
        Q = a + (b - a) * t[:, None]; r = .032 * np.clip(t / .12, 0, 1) ** .5 * np.clip((1 - t) / .55, 0, 1) ** .8 + .002   # the spear: a blunt butt, a long point
        sp = [tube(Q, r, None, BOLT_HI, 8)]; sp += [tube(Q, r * 1.6 + .004, None, (186, 230, 255), 8)]                       # a glow sheath round the core
        sp[1] = (sp[1][0], sp[1][1][:, ::-1], sp[1][2])                                                                     # (seen from inside too)
        for k in range(6):                                                                             # crackle forking off the shaft
            s0 = .15 + .12 * k; p = a + (b - a) * s0; sp += bolt(p, p + nz(V3(RNG.uniform(-1, 1), RNG.uniform(-1, 1), RNG.uniform(-.3, .3)) - u * .2) * .26, 4, .14, .008, .002, BOLT)
        add_aura(sp, 'root')
    L.aura = aura

elif FORM == 'voltoweth':
    # ENIGMA: wings spread broad and level, round-tipped; a paler storm-grey coat; a violet crystal on her breast; aura: the CYCLONE EYE round
    # her (root): spiral bands of cloud winding out and up round her, lightning crackling in them.
    L.BALL = ((0, .345, .0), (.290, .262, .270))
    spread((.255, .515, .0), (.960, .560, -.040), 1.50, [(.40, -.02, .46, .200, 0), (.86, .080, .22, .070, 0), (.80, .150, .26, .068, 1), (.68, .190, .26, .064, 1),
           (.56, .210, .24, .060, 1), (.44, .210, .20, .055, 1), (.92, .010, .14, .070, 0)],
           ((.21, .50, .0), .075), ((.14, .49, .0), (.25, .52, .0), .060, .045), .55, 1.0, ((-1.06, -.03, -.42), (1.06, 1.02, .42)), bow=.040, thick=(.052, .036))
    L.COAT = (C8('#8796ad'), C8('#dfe6f0')); L.COAT_KEY = C8('#dfe6f0'); L.PAL = [C8('#8a9cba'), C8('#f4f7fb'), C8('#f4f7fb'), C8('#7f90ac'), C8('#f4f7fb'), C8('#7d8eaa'), L.BEAK, L.TOE]
    L.decals = lambda o, parts: decals(o, parts, chest_gem=True)
    def aura():
        cl, zz = [], []
        for k in range(4):                                                                           # four spiral cloud bands, winding out and up round her
            t = np.linspace(0, 1, 90); th = 2 * np.pi * (k / 4 + .9 * t); r = .78 + .40 * t        # a vortex BEHIND her (her art's backdrop): the eye is her
            Q = np.c_[r * np.sin(th), .62 + .46 * r * np.cos(th), -.46 + .16 * np.abs(np.sin(th)) * t]; cl += ribbon(Q, .07 + .12 * t, (196, 210, 230) if k % 2 else (172, 190, 216), up=(0, 0, 1))
        add_aura(cl, 'root')
        for a in np.radians((40, 150, 250, 320)):                                                     # lightning crackling in the cloud
            p = V3(.95 * np.sin(a), .62 + .40 * np.cos(a), -.42); zz += bolt(p, p + V3(.18 * np.cos(a), -.18 * np.sin(a), 0), 5, .12, .010, .002, BOLT, 1)
        add_aura(zz, 'chest')
    L.aura = aura

# ── the aura part: built after the body (decals lay on her field), written with body + eyes ──
_glb = C.glb
def glb_with_aura(path, parts):
    L.aura(); V, Fs, Cc, o = [], [], [], 0
    L.AURA[:] = [(np.c_[P[:, 0], np.maximum(P[:, 1], FLOOR - .02), P[:, 2]], f, col) for P, f, col in L.AURA]   # the safety under the floor rule
    for P, f, col in L.AURA: V.append(P); Fs.append(f + o); Cc.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(P), 1))); o += len(P)
    V, Fs, Cc = np.vstack(V), np.vstack(Fs), np.vstack(Cc); print('aura tris', len(Fs), 'verts', len(V))
    # sheet 8's PALE STRIP under the spread wing roots, found: the coat is shaded light-on-top by the surface normal (owl_common finish), and
    # the spread blade's root is a bar whose TOP faces up, so from the game's slightly-high camera it read as a white stripe across her
    # shoulders. On the coat at the blade root + shoulder the shade is turned over: the up-facing top painted darker.
    VV, FF, CC, NN = parts['body']; CC = CC.copy(); M = np.c_[np.abs(VV[:, 0]), VV[:, 1:]]; pal = np.array(L.PAL)
    coat = ~(np.abs(CC[:, None, :3].astype(int) - pal[None]).max(2) == 0).any(1); near = coat & (L.WING.blade(M) < .05) & (M[:, 0] > .14) & (L.WING.loc(M)[0] < .40)
    sh = np.clip(.42 - .30 * NN[:, 1], .05, 1)[near, None];      # the lit top of the root painted DOWN (the light lifts it back to the wing's tone)
    CC[near, :3] = np.round(L.COAT[0] * (1 - sh) + L.COAT[1] * sh)
    L.STRIP_FIX = int(near.sum()); print('wing-root coat re-shaded', L.STRIP_FIX); parts = dict(parts, body=(VV, FF, CC, NN))
    return _glb(path, dict(parts, aura=(V, Fs, Cc, normals(V, Fs))))
C.glb = glb_with_aura
_init = C.Owl.__init__
def init(s, F): _init(s, F); L._owl = s
C.Owl.__init__ = init
sys.modules['sculpt_voltaw'] = L          # rig_owl.py imports 'sculpt_' + form: it gets the re-shaped Voltowl module

if __name__ == '__main__':
    C.Owl(L).run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 6000)
