"""M244 sheet 14 (sprites, 2026-11-28): MESAMERE's four awakened forms, OWNER PREVIEW. Canon spirits-species.md 'Mesamere (Earth):
Mesathar (Champion, pure) · Mesamelle · Mesamis · Mesamun'. Locked art athernyx assets/stage3 049-052 (looked at, never traced, never in this repo).
    python sculpt_mesaaw.py <form> <out.glb>        form = mesathar | mesamelle | mesamis | mesamun
Starts from the LIVE Mesamere (m202-shellmere-line tools/sculpt_mesamere.py, imported, never edited) and re-shapes him BY NAME: shell centre +
radii (dome / rim / plastron follow), scute seats, head centre HC + neck, legs LEGS (the rig reads them: he WALKS on four legs, the base
Shellmere rig), tail, moss lumps (MOSS / MR), colours, the shell marks (runes()). His MOTIF is a separate 'aura' part (unlit, it glows), each
piece on one bone (written to <out>-aura.json for the rig). The free-piece helpers (sphere / tube / hull / ribbon / surf / spike) are sheet 11's
(m244-tidemere tools/sculpt_tideaw.py), read and run by name.
  MESATHAR  (Champion, pure Earth)  massive: a huge high shell of raised grey STONE PLATES with deep seams, moss on the plates, pillar legs,
            amber glowing cracks over his chest plate and down his fore legs.
  MESAMELLE (Virtuoso)  a long neck carried high, a rounder IRIDESCENT OPAL shell (every scute a glowing pastel panel), slimmer legs.
  MESAMIS   (Ace)  a quick low runner: a low golden dome ringed in moss, head out front, wide sturdy legs, a longer tail, golden dust behind.
  MESAMUN   (Enigma)  tall AMBER CRYSTAL SPIRES rising from a mossy cap on her shell, little pink flowers in the moss, dark scaly legs (no buildings)."""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
LINE = os.path.join(HERE, '../../m202-shellmere-line-2026-11-27/tools'); sys.path.insert(0, LINE)
FORM = sys.argv[1] if __name__ == '__main__' else os.environ['MESAAW_FORM']
import sculpt_mesamere as F
import shell_common as C
from shell_common import cone, ell, su, ss, V3
from sculpt_v2 import normals
S = F.S; S.TRIS = 4800; rng = np.random.default_rng({'mesathar': 49, 'mesamelle': 50, 'mesamis': 51, 'mesamun': 52}[FORM])
AURA = []                                             # (P, F, col, bone)
TIDE = os.path.join(HERE, '../../m244-tidemere-2026-11-28/tools/sculpt_tideaw.py'); _src = open(TIDE).read()
a_, b_ = _src.index('# ── free pieces for the aura ──'), _src.index('# ── her shape, by name ──'); exec(compile(_src[a_:b_], 'sculpt_tideaw(helpers)', 'exec'), globals())
for _n in ('sphere', 'tube', 'hull', 'ribbon', 'surf', 'spike', 'coral'): assert _n in globals(), _n

def patch(d, r, col, bone, lift=.005, k=16):
    """a panel lying ON the dome: a two-ring disc of radius r round the surface point toward d, every point cast back onto the surface"""
    p = surf(d); n, t1, t2 = S.frame(p); a = np.arange(k) / k * 2 * np.pi; P = [p]
    for rr in (r * .55, r):
        tg = p + rr * (np.cos(a)[:, None] * t1 + np.sin(a)[:, None] * t2); U = tg - S.SC; U /= np.linalg.norm(U, axis=1, keepdims=True); P += list(S.ray(np.tile(S.SC, (k, 1)), U, 2.))
    P = np.array(P); P = P + S.grad(P, 3e-3) * lift
    Fc = [(0, 1 + i, 1 + (i + 1) % k) for i in range(k)] + [f for i in range(k) for j in [(i + 1) % k] for f in ((1 + i, 1 + k + i, 1 + k + j), (1 + i, 1 + k + j, 1 + j))]
    Fc = np.array(Fc); v = P[Fc[0]]
    if np.cross(v[1] - v[0], v[2] - v[0]) @ n < 0: Fc = Fc[:, ::-1]
    bot = P - S.grad(P, 3e-3) * (lift + .004); P2 = np.vstack([P, bot]); m = len(P); Fb = Fc[:, ::-1] + m                   # a thin closed slab (back face)
    rim = [(1 + k + i, 1 + k + (i + 1) % k) for i in range(k)]; Fs = [f for a2, b2 in rim for f in ((a2, b2 + m, b2), (a2, a2 + m, b2 + m))]
    Fs = np.array(Fs); vs = P2[Fs[0]]
    if np.cross(vs[1] - vs[0], vs[2] - vs[0]) @ (vs[0] - p) < 0: Fs = Fs[:, ::-1]
    AURA.append((P2, np.vstack([Fc, Fb, Fs]), col, bone))
def vein(Q, col, bone, wd=.0065):
    """a glowing crack along surface points Q (a strip lifted off the body, closed into a slab)"""
    P, Fc, _ = S.strip(np.asarray(Q, float), col, wd, .0045); n = len(P); G = S.grad(P, 3e-3); P2 = np.vstack([P, P - G * .006])
    AURA.append((P2, np.vstack([Fc, Fc[:, ::-1] + n]), col, bone))
def cast(o, tg):
    """surface points from origin o toward targets tg"""
    tg = np.asarray(tg, float); U = tg - o; U /= np.linalg.norm(U, axis=1, keepdims=True); return S.ray(np.tile(o, (len(tg), 1)), U, 2.)
def jagline(a, b, n, amp):
    T = np.linspace(0, 1, n); P = np.outer(1 - T, a) + np.outer(T, b); P[1:-1] += rng.normal(0, amp, (n - 2, 3)) * (1, 1, 0); return P

# ── his shape, by name ──
def reshape(SC, SR, HC_off, legs, leg_r=(.128, .112), pad=1.0, neck=None, tail=None, slab=(.019, .010), plast_y=.240, cut=.262, bounds_top=None):
    S.SC, S.SR = V3(*SC), V3(*SR); S.HC = C.HC0 + V3(*HC_off); S.LEGS = [tuple(map(tuple, l)) for l in legs]
    def dome(M):
        d = ss(ell(M, S.SC, S.SR), M[..., 1] - cut, .03); g = S.scute_gap(M)
        return d + slab[0] * np.exp(-(g / .017) ** 2) * (M[..., 1] > cut + .04) - slab[1] * np.clip(g / .09, 0, 1) * (M[..., 1] > cut + .08)
    def moss(M):                                                                                      # the lumps SMOOTH-unioned (a soft min): no tunnels between them
        d = np.linalg.norm(M[..., None, :] - F.MOSS, axis=-1) - F.MR; m = d.min(-1); return m - .012 * np.log(np.exp(-(d - m[..., None]) / .012).sum(-1))
    def rim(M): return su(ell(M, (0, cut + .043, S.SC[2]), (S.SR[0] + .01, .062, S.SR[2] + .06)), moss(M), .02)
    def plastron(M): return su(ell(M, (0, plast_y, S.SC[2] + .02), (.76 * S.SR[0], .12, .84 * S.SR[2])), ell(M, (0, plast_y + .015, S.SC[2] + .31), (.25, .11, .16)), .05)
    def legs_(M):
        d = 9
        for a, b in S.LEGS:
            a, b = V3(*a), V3(*b); d = np.minimum(d, cone(M, a, b + V3(0, max(.030, leg_r[1] - .082), 0), *leg_r))      # a thick leg's round end kept off the floor
            d = su(d, ell(M, b + V3(.006, -.017, .012), (.118 * pad, .046, .122 * pad)), .03)
            for t in (-.6, 0, .6): d = su(d, ell(M, b + V3((.075 * np.sin(t) + .012) * pad, -.030, .100 * np.cos(t) * pad), (.036 * pad, .032, .036 * pad)), .014)
        return d
    def claws(M):
        d = 9
        for a, b in S.LEGS:
            b = V3(*b)
            for t in (-.6, 0, .6): d = np.minimum(d, ell(M, b + V3((.090 * np.sin(t) + .014) * pad, -.034, .124 * np.cos(t) * pad), (.022 * pad, .019, .022 * pad)))
        return d
    S.dome, S.rim, S.plastron, S.legs, S.claws = dome, rim, plastron, legs_, claws
    if neck: S.neck = lambda M: cone(M, *neck)
    if tail: S.tail = lambda P: cone(P, *tail)
    x = max(abs(l[1][0]) for l in legs) + .16; z0 = min(S.SC[2] - S.SR[2] - .12, (tail[1][2] - .05) if tail else -9)
    S.BOUNDS = (V3(-max(x, S.SR[0] + .1), -.033, z0), V3(max(x, S.SR[0] + .1), max(bounds_top or 0, S.SC[1] + S.SR[1] + .16, S.HC[1] + .26), S.HC[2] + .26))
    C.scutes(S, vz=(-.56 * S.SR[2], .02, .58 * S.SR[2]), cx=.62 * S.SR[0], cz=(-.55 * S.SR[2], .02, .55 * S.SR[2]), mk=9, my=cut + .05)
def moss_ring(n, lift, jit, rr, y=None, k=.985):
    t = np.linspace(.08, np.pi - .05, n); yy = y if y is not None else S.dome_y_lip
    return [(k * S.SR[0] * np.sin(a) + rng.normal(0, jit), yy + lift + rng.normal(0, .012), S.SC[2] + k * (S.SR[2] + .06) * np.cos(a)) for a in t]
def colours(skin, shell, groove, plast, claw, moss, plate):
    S.SKIN, S.SHELLC, S.GROOVE, S.PLAST, S.CLAWC, S.BLUSH = map(S.C8, (skin, shell, groove, plast, claw, skin)); S.HEADC = S.SKIN
    S.PAL[:] = [S.PLAST, S.SHELLC, S.GROOVE, S.CLAWC, S.BLUSH, S.C8(moss), S.C8(plate)]
def no_runes(): return []
S.dome_y_lip = .335

if FORM == 'mesathar':
    reshape((0, .315, -.09), (.62, .62, .66), (0, .010, .110), [((.300, .275, .270), (.445, .062, .420)), ((.300, .255, -.360), (.445, .062, -.500))],
            (.160, .142), 1.25, neck=((0, .350, .210), (0, .440, .500), .140, .128), slab=(.026, .024))
    colours('#cc8a3a', '#aaa49a', '#4e483e', '#e8963a', '#efe2c4', '#6aa83c', '#8a5e30'); S.runes = no_runes
    F.MOSS = np.array([tuple(surf(d)) for d in ((0, 1, .2), (.45, .7, -.3), (.55, .55, .45), (.2, .85, -.6), (.62, .3, .0), (.3, .9, .55), (.5, .5, -.75))] +
                      moss_ring(8, .01, .02, 0)); F.MR = rng.uniform(.045, .070, len(F.MOSS))
    AMB = (255, 176, 70)
    o = V3(0, .26, .20)                                                                                      # cracks over the chest plate (the art's amber lines)
    for x in (-.14, -.05, .05, .14): vein(cast(o, jagline(V3(x, .30, .9), V3(x * 1.2, .15, .9), 9, .012)), AMB, 'shell')
    for y in (.30, .22): vein(cast(o, jagline(V3(-.22, y, .9), V3(.22, y, .9), 11, .010)), AMB, 'shell')
    for i, s in ((0, 'l'), (0, 'r')):                                                                          # and down each fore leg, on the leg bone
        x = 1 if s == 'l' else -1; a, b = np.array(S.LEGS[0][0]) * (x, 1, 1), np.array(S.LEGS[0][1]) * (x, 1, 1); c = (a + b) / 2
        for off in (.6, -.5):
            tg = np.array([a + (b - a) * t + (x * .02, 0, .2 + .05 * off) for t in np.linspace(.15, .85, 8)]); tg[1:-1, 0] += rng.normal(0, .015, 6)
            vein(cast(c + (0, 0, -.02), tg + (x * .1 * off, 0, 0)), AMB, 'leg0_' + s, .0055)
elif FORM == 'mesamelle':
    reshape((0, .300, -.13), (.47, .44, .55), (0, .260, .150), [((.225, .268, .225), (.335, .062, .335)), ((.225, .248, -.330), (.335, .062, -.435))],
            (.104, .088), .95, neck=((0, .330, .190), (0, .655, .600), .120, .100), slab=(.014, .006))
    colours('#d29a40', '#ece6ee', '#8c7c64', '#f0bc52', '#f2e4c2', '#78ae4c', '#9a6830'); S.runes = no_runes
    F.MOSS = np.array([S.SC + V3(0, .1, 0)]); F.MR = np.array([.01])                      # no moss on her shell (buried: the art's moss is on her legs)
    OPAL = [(255, 196, 222), (176, 232, 255), (214, 196, 255), (190, 250, 214), (255, 232, 170), (170, 214, 255)]
    k = 0
    for c in S.SCUTES:                                                                                         # every scute an opal panel (the costals mirrored)
        for s in ((1,) if abs(c[0]) < 1e-6 else (1, -1)):
            cc = np.array([c[0] * s, c[1], c[2]]); r = .135 if abs(c[0]) < 1e-6 else .125; patch(cc - S.SC, r, OPAL[k % 6], 'shell'); patch(cc - S.SC, r * .5, OPAL[(k + 2) % 6], 'shell', .009); k += 1
    for i, m in enumerate(S.MARG[1:-1]):                                                                       # and the marginals, smaller
        for s in (1, -1): mm = np.array([m[0] * s, m[1] + .03, m[2]]); patch(mm - S.SC, .075, OPAL[(i + 3 * (s > 0)) % 6], 'shell')
elif FORM == 'mesamis':
    reshape((0, .285, -.12), (.50, .38, .60), (0, -.020, .090), [((.255, .262, .250), (.405, .062, .385)), ((.255, .242, -.350), (.405, .062, -.470))],
            (.136, .118), 1.15, neck=((0, .330, .200), (0, .420, .500), .128, .120), tail=((0, .230, -.560), (0, .140, -.800), .066, .024), slab=(.022, .012), plast_y=.236)
    colours('#f2b236', '#f0a224', '#8e5810', '#f8c84e', '#f4e6c6', '#62a83a', '#a8742c'); S.runes = no_runes
    F.MOSS = np.array(moss_ring(15, .008, .004, 0)); F.MR = np.full(len(F.MOSS), .044)
    DUST, DUST2 = (255, 214, 120), (250, 190, 90)
    for s in (1, -1):                                                                                          # golden dust kicked up behind the hind feet
        b = np.array(S.LEGS[1][1]) * (s, 1, 1)
        for j, (dz, dy, r) in enumerate(((-.10, .050, .046), (-.20, .062, .040), (-.30, .078, .032), (-.15, .110, .026))):
            c = b + (s * .03 * j, dy, dz); import trimesh; t = trimesh.creation.icosphere(1); AURA.append((c + np.array(t.vertices) * (r, r * .7, r * 1.2), np.array(t.faces), DUST if j % 2 == 0 else DUST2, 'root'))
    for j in range(9):                                                                                         # and specks flying off the back
        a = rng.uniform(-1, 1); sphere((a * .45, .20 + rng.uniform(0, .30), S.SC[2] - S.SR[2] - .10 - rng.uniform(0, .25)), rng.uniform(.010, .018), DUST, 'shell', 1)
elif FORM == 'mesamun':
    reshape((0, .300, -.09), (.54, .42, .60), (0, .000, .100), [((.250, .268, .250), (.380, .062, .370)), ((.250, .248, -.345), (.380, .062, -.460))],
            (.124, .108), 1.0, slab=(.020, .012))
    colours('#7a5a3e', '#f2a628', '#8a4e10', '#c88a38', '#e6d6b4', '#6aa83c', '#5a4028'); S.runes = no_runes
    cap = [tuple(surf((rng.uniform(-1.1, 1.1), 1, rng.uniform(-1.1, 1.1)))) for _ in range(26)]
    F.MOSS = np.array(cap); F.MR = rng.uniform(.055, .080, len(F.MOSS))
    AMB, AMB2, PINK, PINK2 = (255, 184, 70), (255, 214, 120), (246, 150, 196), (255, 196, 222)
    for d, h, r, lean in (((0, 1, -.05), .48, .060, (0, 0, 0)), ((.30, .85, .25), .34, .050, (.25, 0, .1)), ((-.28, .85, .20), .30, .046, (-.25, 0, .1)),
                          ((.38, .75, -.35), .26, .044, (.3, 0, -.15)), ((-.40, .72, -.30), .36, .050, (-.3, 0, -.15)), ((.10, .9, -.55), .22, .040, (0, 0, -.3)),
                          ((-.12, .92, .45), .20, .036, (0, 0, .25)), ((.52, .55, .05), .17, .034, (.45, 0, 0)), ((-.54, .52, -.05), .19, .036, (-.45, 0, 0))):   # the spires
        p = surf(d) - V3(0, .02, 0); u = np.asarray(lean, float) + V3(0, 1, 0); u /= np.linalg.norm(u); a6 = np.arange(6) / 6 * 2 * np.pi
        t1 = np.cross(u, V3(0, 0, 1)); t1 /= np.linalg.norm(t1); t2 = np.cross(u, t1)
        ring = lambda c, rr: c + rr * (np.cos(a6)[:, None] * t1 + np.sin(a6)[:, None] * t2)
        hull(np.vstack([ring(p - u * .03, r), ring(p + u * h * .80, r * .9), [p + u * h]]), AMB if h > .25 else AMB2, 'shell')
    for _ in range(14):                                                                                        # little pink flowers in the moss
        q = surf((rng.uniform(-.8, .8), .9, rng.uniform(-.8, .8))) + V3(0, .055, 0); col = PINK if rng.random() < .5 else PINK2
        tube([q - V3(0, .05, 0), q], .005, .004, (110, 170, 80), 'shell', 4); sphere(q + V3(0, .010, 0), .022, col, 'shell', 1)
else: raise SystemExit('form?')

_glb = S.glb
def glb_with_aura(path, parts):
    V, Fs, Cc, bones, o = [], [], [], [], 0
    for P, f, col, bone in AURA:
        V.append(P); Fs.append(f + o); Cc.append(np.c_[np.broadcast_to(np.round(255 * (np.array(col, float) / 255.) ** 2.2), (len(P), 3)), np.full(len(P), 255)]); bones.append([len(P), bone]); o += len(P)
    V, Fs, Cc = np.vstack(V), np.vstack(Fs), np.vstack(Cc); print('aura tris', len(Fs), 'verts', len(V))
    json.dump(bones, open(path.replace('.glb', '-aura.json'), 'w'))
    return _glb(path, dict(parts, aura=(V, Fs, Cc, normals(V, Fs))))
S.glb = glb_with_aura
sys.modules['sculpt_mesamere'] = F
if __name__ == '__main__': C.build(S, sys.argv[2])
