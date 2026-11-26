"""M202: CRAGBEAR (Dewbear's Earth second form) as HER OWN CREATURE, the first of the Dewbear line (Alex 11-26: each second form
is its own new creature introducing the element, never a reskin of the base). Built from the LOCKED art
/root/athernyx/assets/stage2/009-cragbear.png (grimoire-ledger #9) and canon (spirits-species.md: Dewbear = tardigrade ·
Earth line; Second Form Earth = "Stone, crystal, moss-covered growth"). Earth is in the anatomy, not painted on.
    python sculpt_cragbear.py <out.glb> [tris]      (numpy, scipy, trimesh, fast_simplification)
What the picture shows -> what this body carries as SHAPE:
  - a round barrel of a body, head and trunk one piece          -> one squat ball-barrel, the face on its upper front
  - the barrel's staves (vertical lines down the belly)         -> twelve carved stave grooves below the upper band
  - two dark iron hoops round her                               -> two raised hoops (under the face, round the lower belly)
  - a cap of thick moss, draping over both shoulders            -> a lumpy moss layer over the crown and down each shoulder
  - orange mushrooms growing out of the moss                    -> eleven stalked mushrooms on the crown + shoulders, leaning out
  - slate stones set in the moss and on the body                -> five flat slate chips
  - green crystals                                              -> three small crystal points on her right shoulder
  - a heavy frowning brow over round amber eyes                 -> two brow ridges angled down to the middle, amber lens eyes
  - stubby arms at her sides, short thick legs                  -> stub arms with knuckle knobs, four short legs with toe knobs
  - warm light inside the lower belly                           -> a paler amber belly patch (colour)
Where the art is silent (listed in the README): she walks on four legs (a tardigrade: the art shows two feet, the hind pair sits
under the back); a short tail nub (the Dewbear's); the back has moss to mid-height, no staves under it."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
import sculpt_v2 as S
V3, su, ss, ell, cone = S.V3, S.su, S.ss, S.ell, S.cone
C = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
mir = lambda P: np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
def rotz(a): c, s = np.cos(a), np.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def frame(g):
    g = np.array(g, float); g /= np.linalg.norm(g); t = np.cross(g, V3(0, 0, 1) if abs(g[2]) < .9 else V3(1, 0, 0)); t /= np.linalg.norm(t); return np.c_[t, g, np.cross(t, g)]

# ── landmarks (rig_cragbear.py reads these) ──
BC, BR = (0, .50, 0), (.40, .40, .37)                                              # the ball-barrel
HOOPS = (.615, .285)                                                               # the iron hoops' heights
L = dict(f=[(.17, .23, .13), (.17, .12, .14), (.17, .045, .15)], h=[(.17, .23, -.15), (.17, .12, -.16), (.17, .045, -.15)],
         arm=[(.345, .53, .05), (.44, .40, .09), (.455, .32, .10)], tail=[(0, .30, -.33), (0, .27, -.40), (0, .25, -.44)])
EYE, EYE_R = (.114, .718), .057

def barrel(P):
    b = ell(P, BC, BR)
    b = su(b, ell(P, (0, .70, .12), (.28, .17, .24)), .08)                         # the face front, carried a little forward
    x, y, z = P[..., 0], P[..., 1], P[..., 2]; th = np.arctan2(x, z); N = 12
    g = np.abs(((th / (2 * np.pi) * N + .5) % 1) - .5)                            # 0 on a stave seam
    on = (y < HOOPS[0] - .03) & (y > .13)
    return b + .0075 * np.exp(-(g / .055) ** 2) * on                              # the carved seams between the staves
def face(P):
    M = mir(P); d = np.full(P.shape[:-1], 9.)
    br = ell(M, (.120, .796, .312), (.088, .028, .046), rotz(.42))                 # the brow ridge, low at the middle: the frown
    d = np.minimum(d, br)
    d = np.minimum(d, ell(P, (0, .700, .355), (.034, .032, .030)))                  # the nose
    d = np.minimum(d, ell(M, (.075, .655, .335), (.060, .036, .030)))               # the cheeks / muzzle over the hoop
    return d
def hoops(P):
    b = ell(P, BC, BR); return np.minimum.reduce([np.maximum(b - .016, np.abs(P[..., 1] - y) - .026) for y in HOOPS])
def limbs(P):
    M = mir(P); f, h, a = L['f'], L['h'], L['arm']; d = np.full(P.shape[:-1], 9.)
    for lg, zt in ((f, 1), (h, 1)):
        d = np.minimum(d, cone(M, lg[0], lg[1], .085, .078)); d = su(d, cone(M, lg[1], lg[2], .078, .072), .03)
        d = su(d, ell(M, (lg[2][0], .042, lg[2][2] + .02), (.088, .046, .100)), .03)              # the foot
        for k, ox in enumerate((-.045, 0, .045)): d = su(d, ell(M, (lg[2][0] + ox, .030, lg[2][2] + .105), (.026, .024, .026)), .012)   # toe knobs
    d = su(d, cone(M, a[0], a[1], .090, .074), .04); d = su(d, cone(M, a[1], a[2], .074, .066), .03)
    d = su(d, ell(M, (a[2][0] + .005, a[2][1] - .02, a[2][2]), (.068, .074, .070)), .03)            # the fist
    for oz in (-.035, .005, .045): d = su(d, ell(M, (a[2][0] + .025, a[2][1] - .085, a[2][2] + oz), (.024, .026, .022)), .012)   # knuckle knobs
    return d
def tailnub(P): return cone(P, L['tail'][0], L['tail'][2], .060, .036)

def moss_edge(P):
    """the height the moss comes down to, round her: low on the shoulders, high over the face"""
    x, z = P[..., 0], P[..., 2]; th = np.arctan2(x, z); sd = np.abs(np.sin(th))
    return .845 - .33 * sd ** 2.2 - .07 * (np.cos(th) < 0) * (1 - sd) + .028 * np.sin(7 * th + .6) + .018 * np.sin(13 * th + 2.1) - .05 * (x < 0) * sd ** 3
def lumps(P):
    x, y, z = P[..., 0], P[..., 1], P[..., 2]
    return .010 * np.sin(31 * x + 1) * np.sin(29 * y + 2) * np.sin(27 * z) + .007 * np.sin(57 * x + 3) * np.sin(53 * y) * np.sin(61 * z + 1)
def moss(P): return np.maximum(ell(P, BC, BR) - .030 - lumps(P), moss_edge(P) - P[..., 1])

# mushrooms: (polar angle round her from the front, height on the ball, lean out 0..1, stalk length, cap radius)
SHROOMS = [(-.95, .92, .55, .16, .060), (-1.35, .82, .75, .18, .062), (-1.75, .68, .85, .13, .052), (-1.55, .58, .90, .10, .040),
           (.80, .93, .45, .17, .062), (1.25, .84, .70, .16, .058), (1.70, .70, .80, .11, .045), (-.45, .96, .30, .12, .044),
           (.40, .97, .25, .11, .042), (2.4, .88, .50, .12, .048), (-2.5, .86, .50, .11, .046)]
def _surf(th, y):
    """a point on the moss surface at polar angle th, height y (from the front, +x = her left)"""
    k = np.sqrt(max(1e-4, 1 - ((y - BC[1]) / (BR[1] + .03)) ** 2)); p = V3(np.sin(th) * (BR[0] + .03) * k, y, np.cos(th) * (BR[2] + .03) * k)
    n = (p - V3(*BC)) / (V3(*BR) ** 2); n /= np.linalg.norm(n); return p, n
SH = []
for th, y, lean, ln, rc in SHROOMS:
    p, n = _surf(th, y); g = V3(0, 1, 0) * (1 - lean) + n * lean; g /= np.linalg.norm(g); SH.append((p - g * .02, g, ln * .82, rc))
def _shroom(P):
    stalk, cap = np.full(P.shape[:-1], 9.), np.full(P.shape[:-1], 9.)
    for p, g, ln, rc in SH:
        top = p + g * ln; stalk = np.minimum(stalk, cone(P, p, top, .024, .019))
        cap = np.minimum(cap, ell(P, top + g * .004, (rc * 1.3, .044, rc * 1.3), frame(g)))
    return stalk, cap
def shrooms(P):
    lo, hi = V3(-.70, .45, -.55), V3(.70, 1.12, .55); sh = P.shape[:-1]; Q = P.reshape(-1, 3); m = np.all((Q >= lo) & (Q <= hi), 1)
    s, c = np.full(len(Q), 9.), np.full(len(Q), 9.)
    if m.any(): s[m], c[m] = _shroom(Q[m])
    return s.reshape(sh), c.reshape(sh)

# slate chips (centre, radii, tilt axis-angle about z then x) + crystals (centre, size)
SLATES = [((.02, .925, .06), (.075, .022, .060), .25), ((.27, .83, .10), (.060, .020, .050), -.6), ((-.36, .62, .12), (.055, .020, .045), .3),
          ((-.38, .50, .06), (.045, .020, .055), -.2), ((.25, .26, .29), (.060, .028, .020), .35)]
CRYST = [((.33, .76, .16), .040), ((.37, .69, .14), .028), ((-.22, .80, .15), .028)]
def stones(P):
    d = np.full(P.shape[:-1], 9.)
    for c, r, a in SLATES:
        n = (V3(*c) - V3(*BC)) / V3(*BR) ** 2; n /= np.linalg.norm(n)
        q = (P - V3(*c)) @ (frame(n) if r[1] < r[2] else np.eye(3)); bx = np.abs(q) - V3(*r) * .8
        d = np.minimum(d, np.linalg.norm(np.maximum(bx, 0), axis=-1) + np.minimum(bx.max(-1), 0) - .006)
    return d
def crystals(P):
    d = np.full(P.shape[:-1], 9.)
    for c, s in CRYST:
        q = np.abs(P - V3(*c)) * V3(1, .62, 1); d = np.minimum(d, (q.sum(-1) - s) * .577)
    return d

def body(P):
    b = su(barrel(P), face(P), .022); b = np.minimum(b, hoops(P)); b = su(b, limbs(P), .03); b = su(b, tailnub(P), .03)
    b = su(b, moss(P), .012); b = su(b, stones(P), .006); b = su(b, crystals(P), .004)
    return b
def field(P):
    s, c = shrooms(P); return su(su(body(P), s, .014), c, .008)

# ── colour classes (positive inside), cut into the mesh; later classes win ──
PAL = dict(lo='#a24a1c', hi='#e5843a', glow='#f2a24a', seam='#7d3816', hoop='#4b4643', moss='#6d9a35', mossd='#557e2a', stalk='#e8c48a',
           cap='#e39a3e', slate='#5d6267', cryst='#52d8aa', brow='#b85a24', nose='#8a3e18')
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []; th = np.arctan2(x, z)
    out.append(np.minimum(1 - np.sqrt((x / .24) ** 2 + ((y - .40) / .16) ** 2), z - .12))                                  # warm light in the lower belly
    g = np.abs(((th / (2 * np.pi) * 12 + .5) % 1) - .5); out.append(np.where((y < HOOPS[0] - .035) & (y > .14), .024 - g, -1.))   # the stave seams (wide: a thin cut breaks into dashes)
    out.append(np.max([.031 - np.abs(y - h) for h in HOOPS], 0) * (np.sqrt(x ** 2 + z ** 2) > .2))                          # the iron hoops
    out.append(y - moss_edge(V) + .004)                                                                                       # the moss
    out.append(np.where(y - moss_edge(V) > 0, lumps(V) - .006, -1.))                                                          # its darker hollows
    s, c = shrooms(V); out.append(np.where(s < .006, 1., -1.)); out.append(np.where((c < .006) & (c <= s), 1., -1.))
    out.append(np.where(stones(V) < .005, 1., -1.)); out.append(np.where(crystals(V) < .005, 1., -1.))
    M = np.c_[A, y, z]; out.append(np.where(ell(M, (.120, .796, .312), (.088, .028, .046), rotz(.42)) < .004, 1., -1.))   # the brow, a shade darker
    out.append(np.where(ell(V, (0, .700, .355), (.034, .032, .030)) < .004, (y - .690), -1.))                            # the nose tip darker underneath
    return out
ORDER = ('glow', 'seam', 'hoop', 'moss', 'mossd', 'stalk', 'cap', 'slate', 'cryst', 'brow', 'nose')

def eyes():
    """round amber lenses set in the face under the brow: a deep orange ring, a bright amber iris, a dark pupil, a big catchlight
    high + outside and a small one low; and the small frowning mouth as a line of geometry under the nose (a thin colour cut breaks
    into dashes on a decimated face). Unlit."""
    import trimesh
    Vs, Fs, Cs, o = [], [], [], 0
    def lens(c, r, flat, g, col, sub):
        nonlocal o
        b = trimesh.creation.icosphere(subdivisions=sub, radius=r); v = b.vertices; v = v + np.outer(v @ g, g) * (flat - 1)
        Vs.append(v + c); Fs.append(b.faces + o); o += len(v); Cs.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(v), 1)))
    def onface(x, y):
        p = V3(x, y, .75)
        for _ in range(80): p = p - V3(0, 0, 1) * np.clip(field(p[None])[0], -.02, .02) * .8
        g = np.array([(field((p + np.eye(3)[i] * 1e-3)[None]) - field((p - np.eye(3)[i] * 1e-3)[None]))[0] for i in range(3)]); return p, g / np.linalg.norm(g)
    for s in (1, -1):
        p, g = onface(s * EYE[0], EYE[1]); t = np.cross(g, V3(0, 1, 0)); t /= np.linalg.norm(t); u = np.cross(t, g)
        if t[0] * s < 0: t = -t
        lens(p + g * .003, EYE_R, .42, g, (150, 62, 18), 3)                                              # the deep orange ring
        lens(p + g * .010, EYE_R * .80, .40, g, (236, 146, 44), 3)                                       # the amber iris
        lens(p + g * .018, EYE_R * .44, .40, g, (22, 10, 6), 3)                                          # the pupil
        lens(p + g * .030 + t * .016 + u * .018, .0135, .5, g, (255, 252, 240), 2)                       # the big catchlight
        lens(p + g * .028 - t * .014 - u * .017, .0058, .5, g, (255, 222, 180), 1)                       # the small one
    for x in np.linspace(-.030, .030, 9):                                                               # the mouth: short, its ends turned down
        p, g = onface(x, .664 - 6 * x ** 2); lens(p, .0060, .45, g, (70, 28, 12), 1)
    return np.vstack(Vs), np.vstack(Fs), np.vstack(Cs)

def finish(V, Fa, path):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(Fa), -1); pal = [C(PAL[k]) for k in ORDER]
    for k in range(len(ORDER)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL['lo']) * (1 - sh[g]) + C(PAL['hi']) * sh[g]
    eV, eF, eC = eyes(); S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF)))); print('cragbear body tris', len(FF), 'verts', len(VV))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 10000
    import trimesh
    from marching import surface
    def decimate(V, F, n):
        """closed, one piece; a pinch is allowed, an open edge is not"""
        import fast_simplification as fs
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum()); best = (p, t) if best is None or p < best[0] else best
                    if p == 0: return t
        if best is None: raise SystemExit('no closed decimation')
        print('pinched edges', best[0]); return best[1]
    lo, hi, h = V3(-.60, -.033, -.56), V3(.60, 1.14, .56), .0058
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    parts = m.split(only_watertight=False); k = max(parts, key=lambda c: len(c.faces)); print('dropped crumbs', len(parts) - 1, [(len(p.faces), p.centroid.round(2).tolist()) for p in parts if p is not k and len(p.faces) > 60][:12])
    t = decimate(k.vertices, k.faces, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT)
