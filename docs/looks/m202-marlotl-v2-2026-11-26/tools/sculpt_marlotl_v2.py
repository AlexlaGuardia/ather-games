"""M202 v2 (head + eyes redo, 11-26; body, gills, crest, tail, legs unchanged from v1 docs/looks/m202-marlotl-2026-11-26): MARLOTL (Manalotl's Water second form) as HER OWN CREATURE, the first of the Manalotl line (Alex 11-26: "this first
evolution is its own new creature and should introduce the element that will then fork into four more"). Built from the
LOCKED art /root/athernyx/assets/stage2/002-marlotl.png (grimoire-ledger #2, LOCKED v2) and canon: spirits-species.md (Second
Form: Water = "Flowing patterns, aquatic adaptation", "Calmer, more fluid"), the Bk5 page (spirit-tales-5, Brook becomes a
Marlotl: "the silver light pooled in her frills", "the patterns of her skin began to flow", "the colour of water with the light
held in it, clear and pink and moving", "her endless gentle smile did not change"). Water is in the anatomy, not painted on.
    python sculpt_marlotl.py <out.glb> [tris]      (numpy, scipy, trimesh, fast_simplification)
What the picture shows -> what this body carries as SHAPE:
  - a broad round axolotl head, wide-set round black eyes, a gentle smile -> the Manalotl head family kept: wide flat-fronted
                                                                          head, bead eyes, the smile cut into the face
  - six big feathery gill frills, splayed like fronds                     -> three gills a side, each a stalk with a WEBBED blade
                                                                          (a fin membrane between the fronds) and fronds
                                                                          standing past its edge: the frills became fins
  - a long tail with a broad fin sweeping up                              -> a flat-sided tail inside a tall paddle fin whose end
                                                                          rises, its edge rippled
  - a fin spike rising off her back                                       -> a dorsal crest from behind the head to the tail fin
  - splayed legs, webbed four-fingered hands                              -> sprawled legs (elbows out), four fingers, webbed
  - pale speckles all over                                                -> pale spots (colour), denser on the back
  - aqua-teal, belly paler                                                -> teal coat, pale mint belly, paler frill + fin tips
Where the art is silent (each makes her MORE her own creature; listed in the README): the dorsal crest runs the whole back
(the art shows only its peak); fin rays on the tail fin and crest (pale lines); a slimmer, longer trunk than the Manalotl
(a swimmer's); a soft pink blush under each eye and at the gill roots (the Bk5 page: "clear and pink"); the hind feet webbed
too. The bubbles round her and the light running through her frills are effects (M204 glow slice)."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools'))
import sculpt_v2 as S
V3, su, ss, ell, cone = S.V3, S.su, S.ss, S.ell, S.cone
C = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)])
mir = lambda P: np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)

# ── landmarks (rig_marlotl.py reads these) ──
DY = .04                                                                          # the upper body drawn this much lower than its numbers below (a low belly)
L = dict(head=(0, .36, .40), chest=(0, .27, .20), pelvis=(0, .27, -.34),
         f=[(.125, .185, .205), (.255, .115, .225), (.262, .036, .270)],         # shoulder, elbow, wrist (elbows OUT: a sprawl), ground numbers
         h=[(.115, .190, -.355), (.255, .120, -.395), (.262, .036, -.360)],       # hip, knee, ankle
         tail=[(0, .27, -.40), (0, .275, -.62), (0, .31, -.84), (0, .39, -1.02), (0, .50, -1.15)], tailr=[.112, .084, .060, .040, .018])
HC, HR = (0, .370, .405), (.258, .198, .216)                                          # v2 head dome centre + radii (number space)
TC = S.catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 6)
up = lambda P: P + V3(0, DY, 0)                                                   # an upper-body part, evaluated at its own numbers

def head(P):
    """v2 (Alex 11-26 "the head and eyes look a bit weird"): a round DOME, not v1's flat wide lozenge: taller, a touch
    narrower, the forehead carried up and forward so the eyes sit IN the face (the art), not perched on its top edge"""
    P = up(P); h = ell(P, (0, HC[1], HC[2]), HR)                                       # the dome
    h = su(h, ell(P, (0, .352, .505), (.212, .162, .128)), .06)                 # the broad soft front (the face the eyes sit in)
    h = su(h, ell(P, (0, .290, .435), (.198, .092, .170)), .05)                 # the jaw, full under the smile
    return h

# gills: three a side, rooted behind the eyes, splayed out like fronds
GILLS = [((.185, .470, .300), (.50, .80, -.33), .345), ((.215, .395, .290), (.86, .28, -.42), .360), ((.200, .315, .300), (.86, -.18, -.47), .290)]
def _gframe(d):
    u = V3(*d) / np.linalg.norm(d); v = np.cross(u, V3(0, 0, 1)); v /= np.linalg.norm(v); n = np.cross(u, v); return u, v, n
def gill1(M, root, d, ln):
    """one gill (M already mirrored): stalk, webbed blade, fronds past its edge; returns (sdf, t along it, blade sdf)"""
    u, v, n = _gframe(d); q = M - V3(*root); t = np.clip((q @ u) / ln, 0, 1); a = q @ u; b = q @ v; c = q @ n
    st = cone(M, root, V3(*root) + u * ln, .028, .007)
    hw = .060 * np.sin(np.pi * np.clip((a / ln) * .92 + .04, 0, 1)) ** .75                       # the blade's half-width
    bl = np.maximum.reduce([np.abs(b) - hw, np.abs(c) - .0085, -a + .04, a - ln * .97])            # a thin webbed blade
    d = su(st, bl, .012); fr = np.full(M.shape[:-1], 9.)
    for k in range(7):
        s = .12 + k * .12; p0 = V3(*root) + u * ln * s; w = .060 * np.sin(np.pi * min(s * .92 + .04, 1)) ** .75 * 1.30 + .012
        for sg in (1, -1): fr = np.minimum(fr, cone(M, p0, p0 + v * sg * w + u * w * .55, .0105, .0045))
    return su(d, fr, .008), t, bl
def box(fn, P, lo, hi):
    """fn only inside the box (its far value elsewhere: 9): the dense march evaluates millions of points"""
    sh = P.shape[:-1]; Q = P.reshape(-1, 3); m = np.all((Q >= lo) & (Q <= hi), 1); out = np.full(len(Q), 9.)
    if m.any(): out[m] = fn(Q[m])
    return out.reshape(sh)
GLO, GHI = V3(-.62, .05, -.20), V3(.62, .86, .42)
def _gills(P):
    M = mir(up(P)); d = np.full(P.shape[:-1], 9.)
    for g in GILLS: d = np.minimum(d, gill1(M, *g)[0])
    return d
def gills(P): return np.minimum(box(_gills, P, GLO, GHI), np.maximum(np.abs(P[..., 0]) - .62, .05))
def gill_t(P):
    """how far out along her nearest gill (0 root .. 1 tip), and whether on a blade"""
    M = mir(up(P)); best, t, bl = np.full(P.shape[:-1], 9.), np.zeros(P.shape[:-1]), np.full(P.shape[:-1], 9.)
    for g in GILLS:
        d, tt, b = gill1(M, *g); w = d < best; best = np.where(w, d, best); t = np.where(w, tt, t); bl = np.where(w, b, bl)
    return best, t, bl

def trunk(P):
    P = up(P); b = ell(P, (0, .27, -.07), (.150, .132, .365))                              # long and slim: a swimmer's trunk
    b = su(b, cone(P, (0, .275, .22), (0, .27, -.36), .128, .110), .05)
    return b

def legs(P):
    M = mir(P); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .046, .036); d = su(d, cone(M, f[1], f[2], .036, .029), .03)
    d = su(d, ell(M, (.270, .022, .298), (.042, .020, .040)), .025)                                # the palm
    t = cone(M, h[0], h[1], .052, .038); t = su(t, cone(M, h[1], h[2], .038, .031), .03)
    t = su(t, ell(M, (.274, .022, -.335), (.044, .020, .042)), .025)
    for k, a in enumerate(np.radians([-50, -17, 17, 50])):                                         # four fingers, fanned
        dirf = V3(np.sin(a) * .9 + .25, 0, np.cos(a)); dirf /= np.linalg.norm(dirf); p0 = V3(.274, .020, .300)
        d = su(d, cone(M, p0, p0 + dirf * .072 + V3(0, -.006, 0), .0135, .0090), .012)
        dirh = V3(np.sin(a) * .9 + .30, 0, np.cos(a) * .55 - .35); dirh /= np.linalg.norm(dirh); p1 = V3(.278, .020, -.330)
        t = su(t, cone(M, p1, p1 + dirh * .068 + V3(0, -.006, 0), .0135, .0090), .012)
    d = su(d, ell(M, (.297, .010, .330), (.058, .0085, .040)), .006)                                # the web between them
    t = su(t, ell(M, (.312, .010, -.355), (.052, .0085, .040)), .006)
    return su(d, t, .001)

def _tail_y(z): return np.interp(-z, [.40, .62, .84, 1.02, 1.15], [.27, .275, .31, .39, .50])
def tail(P):
    Q = up(P) * V3(1.75, 1, 1); d = np.full(P.shape[:-1], 9.)                                          # flat-sided (a swimmer's tail)
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(Q, a[:3], b[:3], a[3], b[3]))
    return d / 1.4
def finshape(P):
    """the tail fin: a tall paddle round the tail, its end sweeping up, its edge rippled"""
    x, y, z = P[..., 0], P[..., 1] + DY, P[..., 2]; zz = -z; ty = _tail_y(z)
    up = np.interp(zz, [.40, .60, .85, 1.05, 1.20, 1.28], [0, .110, .200, .260, .250, 0]) + .012 * np.sin(zz * 38)
    dn = np.interp(zz, [.50, .70, .95, 1.15, 1.26], [0, .075, .115, .085, 0]) + .007 * np.sin(zz * 33 + 1)
    return np.maximum.reduce([np.abs(x) - .0095, y - (ty + up), (ty - dn) - y, zz - 1.27, .42 - zz])
def crest(P):
    """the dorsal crest: from behind the head down the back into the tail fin, its top rippled"""
    x, y, z = P[..., 0], P[..., 1] + DY, P[..., 2]
    top = np.interp(-z, [-.24, -.16, -.02, .14, .30, .44], [.47, .535, .545, .525, .485, .45]) + .008 * np.sin(z * 52)
    return np.maximum.reduce([np.abs(x) - .0090, y - top, .33 - y, z - .24, -.46 - z])

def body(P):
    b = su(trunk(P), head(P), .07); b = su(b, np.minimum(box(legs, P, V3(-.42, -.05, -.62), V3(.42, .30, .52)), .3), .035)
    b = su(b, tail(P), .05); b = su(b, finshape(P), .012); b = su(b, crest(P), .014)
    return b
def field(P): return su(body(P), gills(P), .016)

# ── colour classes (positive inside), cut into the mesh; later classes win ──
PAL = dict(lo='#2b7f8a', hi='#5fbfbb', belly='#9fdcc8', fin='#7fcfc6', ray='#c6f2ea', gill='#3c9ea2', gtip='#a6e3d8', groot='#e2a6a2',
           blush='#e7aaa3', lid='#86d6cc', spot='#e4fbf3', mouth='#173a42', nose='#173a42')
def _spots():
    rng = np.random.default_rng(2); out = []
    while len(out) < 70:
        z = rng.uniform(-1.05, .58); x = rng.uniform(-.25, .25); p = V3(x, 1.0, z)
        for _ in range(50): p = p - V3(0, 1, 0) * np.clip(body(p[None])[0], -.02, .02) * .8
        if p[1] < .13 or body(p[None])[0] > .004 or any(np.linalg.norm(p - q) < .045 for q, _ in out): continue
        if p[2] > .44 and .05 < abs(p[0]) < .23 and .27 < p[1] < .45: continue     # keep clear of the eyes, lids + blush
        out.append((p, (.0085, .011, .014)[len(out) % 3]))
    return out
SPOTS = _spots()
def classes(V):
    x, y, z = V.T; A = np.abs(x); out = []; yu = y + DY
    out.append(np.minimum.reduce([.19 - y + .04 * np.clip(A - .06, 0, 1), .135 - A + .3 * np.clip(.24 - y, 0, .1), z + .44, .56 - z]))   # pale belly + chin
    fs = -np.minimum(finshape(V), crest(V))
    out.append(np.where(fs > -.004, (np.abs(yu - _tail_y(z)) - .05 * (z < -.42)) * (z < -.42) + (yu - .40) * (z >= -.42) + .0, -1.))           # fin membrane paler, off the tail itself
    out.append(np.where(fs > -.004, .0045 - np.abs(((z * 21 + 1.7 * (yu - _tail_y(z))) % 1) - .5) / 21 * 2, -1.))                           # fin rays
    gd, gt, gb = gill_t(V)
    out.append(np.where(gd < .006, 1., -1.))                                                                                                  # gill
    out.append(np.where(gd < .006, gt - .55 + .05 * np.sin(z * 90), -1.))                                                                   # paler toward the tips (the silver light pools there)
    out.append(np.where(gd < .006, .09 - gt, -1.) * 1.)                                                                                       # pink at the roots
    el = np.sqrt((A - EYE[0]) ** 2 + (yu - EYE[1]) ** 2); out.append(np.where(z > .52, .0060 - np.abs(el - EYE_R - .008), -1.))              # v2: a pale lid ring round each eye (the art's light rim)
    out.append(.032 - np.sqrt(((A - .180) * .9) ** 2 + ((yu - .322) * 1.6) ** 2 + (z - .55) ** 2 * .3))                                      # the blush, under and outside each eye
    d = np.full(len(V), -9.)
    for c, r in SPOTS: d = np.maximum(d, r - np.linalg.norm(V - c, axis=1))
    out.append(d)
    sm = .292 + 2.2 * x ** 2
    out.append(np.full(len(V), -1.))                                                                                                          # v2: the smile is a line of geometry now (eyes()), not a colour cut: the cut broke into dashes on the decimated face
    out.append(.0098 - np.sqrt((A - .034) ** 2 + (yu - .352) ** 2 + (z - .64) ** 2 * .2))                                                    # nostrils, between the eyes and a little under
    return out
ORDER = ('belly', 'fin', 'ray', 'gill', 'gtip', 'groot', 'lid', 'blush', 'spot', 'mouth', 'nose')

EYE, EYE_R = (.148, .404), .056
SMILE_W, SMILE = .102, (lambda x: .290 + 2.1 * x ** 2)                              # v2 smile half-width + its curve (number space)                                                   # v2 eye: |x|, y (number space), radius (v1: .150, .445, .043)
def eyes():
    """v2: the art's eyes. Big round glossy lenses set IN the face at mid-height (v1: small black beads perched on the head's
    top edge), each a dark blue ring round a black pupil, a big catchlight high and outside, a small one low and inside.
    Each lens is flattened along the face normal so it sits in the face like the base Manalotl's, not a ball on it. Unlit."""
    import trimesh
    Vs, Fs, Cs, o = [], [], [], 0
    def lens(c, r, flat, g, col, sub):
        nonlocal o
        b = trimesh.creation.icosphere(subdivisions=sub, radius=r); v = b.vertices; v = v + np.outer(v @ g, g) * (flat - 1)
        Vs.append(v + c); Fs.append(b.faces + o); o += len(v); Cs.append(np.tile((*np.round(255 * (np.array(col) / 255.) ** 2.2), 255), (len(v), 1)))
    for s in (1, -1):
        p = V3(s * EYE[0], EYE[1] - DY, .75)
        for _ in range(60): p = p - V3(0, 0, 1) * np.clip(field(p[None])[0], -.02, .02) * .8
        g = np.array([(field((p + np.eye(3)[i] * 1e-3)[None]) - field((p - np.eye(3)[i] * 1e-3)[None]))[0] for i in range(3)]); g /= np.linalg.norm(g)
        t = np.cross(g, V3(0, 1, 0)); t /= np.linalg.norm(t); u = np.cross(t, g)                  # the face's own right + up at the eye
        if t[0] * s < 0: t = -t
        lens(p + g * .004, EYE_R, .42, g, (30, 48, 74), 3)                                              # the dark blue ring (the iris)
        lens(p + g * .012, EYE_R * .74, .40, g, (6, 7, 10), 3)                                          # the pupil
        lens(p + g * .030 + t * .018 + u * .021, .0140, .5, g, (255, 255, 250), 2)                      # the big catchlight, high + outside
        lens(p + g * .028 - t * .015 - u * .018, .0060, .5, g, (205, 232, 240), 1)                      # the small one, low + inside
    for x in np.linspace(-SMILE_W, SMILE_W, 29):                                                     # v2: the smile, a gentle curve a third of the face wide, its ends lifting
        p = V3(x, SMILE(x) - DY, .75)
        for _ in range(60): p = p - V3(0, 0, 1) * np.clip(field(p[None])[0], -.02, .02) * .8
        g = np.array([(field((p + np.eye(3)[i] * 1e-3)[None]) - field((p - np.eye(3)[i] * 1e-3)[None]))[0] for i in range(3)]); g /= np.linalg.norm(g)
        lens(p, .0064, .45, g, (23, 58, 66), 1)
    return np.vstack(Vs), np.vstack(Fs), np.vstack(Cs)

def finish(V, Fa, path):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(Fa), -1); pal = [C(PAL[k]) for k in ORDER]
    for k in range(len(ORDER)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL['lo']) * (1 - sh[g]) + C(PAL['hi']) * sh[g]
    eV, eF, eC = eyes(); S.glb(path, dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF)))); print('marlotl body tris', len(FF), 'verts', len(VV), 'spots', len(SPOTS))

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
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
    lo, hi, h = V3(-.62, -.033, -1.30), V3(.62, .86, .66), .0062
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    parts = m.split(only_watertight=False); k = max(parts, key=lambda c: len(c.faces)); print('dropped crumbs', len(parts) - 1, [len(p.faces) for p in parts if p is not k][:12])
    t = decimate(k.vertices, k.faces, TRIS); print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    finish(np.array(t.vertices), np.array(t.faces), OUT)
